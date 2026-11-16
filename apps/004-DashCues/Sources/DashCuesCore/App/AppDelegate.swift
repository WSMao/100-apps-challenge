import AppKit
import SwiftUI

@MainActor
public final class AppDelegate: NSObject, NSApplicationDelegate {
    private var store: ShortcutStore?
    private var statusBarController: StatusBarController?
    private var pinnedWindowManager: PinnedMapWindowManager?
    private var hotKeyManager: GlobalHotKeyManager?
    private var dashboardWindowController: DashboardWindowController?
    private var contentNavigation: SharedContentNavigation?
    private var clipboardWriter: ((String) -> Bool)?

    public override init() {
        super.init()
    }

    public func applicationDidFinishLaunching(_ notification: Notification) {
        setupMainMenu()
        NSApp.setActivationPolicy(.accessory)
        do {
            let environment = ProcessInfo.processInfo.environment
            let storageURL = environment["DASHCUES_UI_TEST_STORAGE_PATH"].map(URL.init(fileURLWithPath:))
            let store = try ShortcutStore(storageURL: storageURL)
            let defaults: UserDefaults
            if environment["DASHCUES_UI_TESTING"] == "1" {
                if let suiteName = environment["DASHCUES_UI_TEST_DEFAULTS_SUITE"],
                   !suiteName.isEmpty,
                   let testDefaults = UserDefaults(suiteName: suiteName) {
                    defaults = testDefaults
                } else {
                    if environment["DASHCUES_UI_TEST_RESET_DEFAULTS"] == "1" {
                        UserDefaults.standard.removeObject(forKey: "DashCues.selectedContentType")
                        UserDefaults.standard.removeObject(forKey: "DashCues.selectedCheatsheetIDs")
                        UserDefaults.standard.removeObject(forKey: "DashCues.recentContentSearches")
                    }
                    defaults = .standard
                }
            } else {
                defaults = .standard
            }
            let contentNavigation = SharedContentNavigation(defaults: defaults)
            let clipboardWriter: (String) -> Bool =
                environment["DASHCUES_UI_TESTING"] == "1"
                    && environment["DASHCUES_UI_TEST_CLIPBOARD_FAILURE"] == "1"
                    ? { _ in false }
                    : SystemClipboardWriter.write
            let pinnedWindowManager = PinnedMapWindowManager(
                store: store,
                contentNavigation: contentNavigation,
                clipboardWriter: clipboardWriter
            )
            self.store = store
            self.pinnedWindowManager = pinnedWindowManager
            self.contentNavigation = contentNavigation
            self.clipboardWriter = clipboardWriter
            statusBarController = StatusBarController(
                store: store,
                contentNavigation: contentNavigation,
                pinnedWindowManager: pinnedWindowManager,
                clipboardWriter: clipboardWriter,
                onOpenDashboard: { [weak self] in self?.openDashboard() }
            )
            if environment["DASHCUES_UI_TESTING"] != "1" {
                let manager = try GlobalHotKeyManager { [weak self] in
                    self?.statusBarController?.showPopover()
                }
                hotKeyManager = manager
                do {
                    try manager.register(store.hotKey)
                } catch {
                    showError(error, title: "全域快捷鍵無法使用")
                }
            }
            if environment["DASHCUES_UI_TESTING"] == "1" {
                openDashboard()
            }
        } catch {
            if ProcessInfo.processInfo.environment["DASHCUES_UI_TESTING"] != "1" {
                showError(error, title: "DashCues 啟動失敗")
            }
            NSApp.terminate(nil)
        }
    }

    private func openDashboard() {
        guard let store, let contentNavigation, let clipboardWriter else { return }
        NSApp.setActivationPolicy(.regular)
        if dashboardWindowController == nil {
            dashboardWindowController = DashboardWindowController(
                store: store,
                contentNavigation: contentNavigation,
                onHotKeyChanged: { [weak self] configuration in
                    guard let self else { throw AppDelegateError.unavailable }
                    try self.updateHotKey(configuration)
                },
                clipboardWriter: clipboardWriter,
                onClose: { [weak self] in
                    self?.dashboardWindowController = nil
                    NSApp.setActivationPolicy(.accessory)
                }
            )
        }
        dashboardWindowController?.showWindow(nil)
        dashboardWindowController?.window?.makeKeyAndOrderFront(nil)
        NSRunningApplication.current.activate(options: .activateIgnoringOtherApps)
    }

    private func updateHotKey(_ configuration: HotKeyConfiguration) throws {
        guard let store, let hotKeyManager else { throw AppDelegateError.unavailable }
        try hotKeyManager.register(configuration)
        do {
            try store.updateHotKey(configuration)
        } catch {
            try hotKeyManager.register(store.hotKey)
            throw error
        }
    }

    private func showError(_ error: Error, title: String) {
        let alert = NSAlert(error: error)
        alert.messageText = title
        alert.runModal()
    }

    private func setupMainMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "結束 DashCues", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        NSApp.mainMenu = mainMenu
    }
}

private enum AppDelegateError: LocalizedError {
    case unavailable
    case missingTestDefaults

    var errorDescription: String? {
        switch self {
        case .unavailable: return "DashCues 尚未完成初始化，請重新啟動 App。"
        case .missingTestDefaults: return "UI 測試必須指定獨立的偏好設定套件。"
        }
    }
}

private final class StatusBarController: NSObject {
    private let store: ShortcutStore
    private let contentNavigation: SharedContentNavigation
    private let pinnedWindowManager: PinnedMapWindowManager
    private let clipboardWriter: (String) -> Bool
    private let onOpenDashboard: () -> Void
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private let contextMenu = NSMenu()
    private var popoverPanel: PopoverPanel?
    private let panelSize = NSSize(width: 620, height: 480)
    private let panelPadding: CGFloat = 8
    private var pendingSingleClickWorkItem: DispatchWorkItem?

    init(
        store: ShortcutStore,
        contentNavigation: SharedContentNavigation,
        pinnedWindowManager: PinnedMapWindowManager,
        clipboardWriter: @escaping (String) -> Bool,
        onOpenDashboard: @escaping () -> Void
    ) {
        self.store = store
        self.contentNavigation = contentNavigation
        self.pinnedWindowManager = pinnedWindowManager
        self.clipboardWriter = clipboardWriter
        self.onOpenDashboard = onOpenDashboard
        super.init()

        if let button = statusItem.button {
            button.image = Self.statusBarIconImage()
            button.setAccessibilityLabel("DashCues")
            button.setAccessibilityIdentifier("dashcues.status-item")
            button.target = self
            button.action = #selector(handleStatusItemClick(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        let quitItem = NSMenuItem(title: "Quit", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        contextMenu.addItem(quitItem)
    }

    private static func statusBarIconImage() -> NSImage {
        let image = NSImage(systemSymbolName: "bolt.fill", accessibilityDescription: "DashCues")
            ?? NSImage(systemSymbolName: "keyboard", accessibilityDescription: "DashCues")
            ?? NSImage()
        image.isTemplate = true
        image.size = NSSize(width: 16, height: 16)
        return image
    }



    @objc private func handleStatusItemClick(_ sender: Any?) {
        guard let event = NSApp.currentEvent else {
            togglePopover()
            return
        }

        if event.type == .rightMouseUp {
            pendingSingleClickWorkItem?.cancel()
            pendingSingleClickWorkItem = nil
            closePopover()
            statusItem.menu = contextMenu
            statusItem.button?.performClick(nil)
            statusItem.menu = nil
            return
        }

        guard event.type == .leftMouseUp else { return }
        if event.clickCount >= 2 {
            pendingSingleClickWorkItem?.cancel()
            pendingSingleClickWorkItem = nil
            closePopover()
            onOpenDashboard()
            return
        }

        pendingSingleClickWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            self?.togglePopover()
        }
        pendingSingleClickWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + NSEvent.doubleClickInterval, execute: workItem)
    }

    private func togglePopover() {
        if popoverPanel?.isVisible == true {
            closePopover()
        } else {
            showPopover()
        }
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }

    func showPopover() {
        guard let button = statusItem.button else { return }
        NSApp.activate(ignoringOtherApps: true)
        let panel = popoverPanel ?? makePopoverPanel()
        popoverPanel = panel
        let navigation = MainActor.assumeIsolated {
            PopoverNavigation(
                store: store,
                contentNavigation: contentNavigation,
                onOpenDashboard: { [weak self] in
                    self?.closePopover()
                    self?.onOpenDashboard()
                },
                onClose: { [weak self] in self?.closePopover() }
            )
        }
        panel.navigation = navigation
        panel.contentViewController = NSHostingController(
            rootView: ShortcutPopoverView(
                store: store,
                pinnedWindowManager: pinnedWindowManager,
                navigation: navigation,
                contentNavigation: contentNavigation,
                clipboardWriter: clipboardWriter
            )
        )

        position(panel: panel, relativeTo: button)
        panel.makeKeyAndOrderFront(nil)
    }

    private func closePopover() {
        popoverPanel?.orderOut(nil)
    }

    private func makePopoverPanel() -> PopoverPanel {
        let panel = PopoverPanel(
            contentRect: NSRect(origin: .zero, size: panelSize),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = true
        panel.backgroundColor = .windowBackgroundColor
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.isMovable = false
        panel.level = .statusBar
        panel.collectionBehavior = [.moveToActiveSpace]
        panel.delegate = self
        return panel
    }

    private func position(panel: NSPanel, relativeTo button: NSStatusBarButton) {
        guard let buttonWindow = button.window else { return }
        let buttonFrameOnScreen = buttonWindow.convertToScreen(button.frame)
        let targetScreen = buttonWindow.screen ?? NSScreen.main ?? NSScreen.screens.first
        let visibleFrame = (targetScreen?.visibleFrame ?? .zero).insetBy(dx: panelPadding, dy: panelPadding)
        var origin = NSPoint(
            x: buttonFrameOnScreen.midX - (panelSize.width / 2),
            y: buttonFrameOnScreen.minY - panelSize.height - panelPadding
        )
        origin.x = min(max(origin.x, visibleFrame.minX), visibleFrame.maxX - panelSize.width)
        origin.y = min(max(origin.y, visibleFrame.minY), visibleFrame.maxY - panelSize.height)
        panel.setFrameOrigin(origin)
    }
}

extension StatusBarController: NSWindowDelegate {
    func windowDidResignKey(_ notification: Notification) {
        guard let panel = popoverPanel else { return }
        guard notification.object as? NSWindow === panel else { return }
        closePopover()
    }
}

private final class PopoverPanel: NSPanel {
    var navigation: PopoverNavigation?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    override func sendEvent(_ event: NSEvent) {
        if event.type == .keyDown,
           event.modifierFlags.intersection([.command, .control, .option]).isEmpty,
           MainActor.assumeIsolated({ navigation?.handle(keyCode: event.keyCode) }) == true {
            return
        }
        super.sendEvent(event)
    }
}

private final class DashboardWindowController: NSWindowController, NSWindowDelegate {
    private let onClose: () -> Void
    private let editSession: KeyValueEditSession

    init(
        store: ShortcutStore,
        contentNavigation: SharedContentNavigation,
        onHotKeyChanged: @escaping @MainActor (HotKeyConfiguration) throws -> Void,
        clipboardWriter: @escaping (String) -> Bool,
        onClose: @escaping () -> Void
    ) {
        self.onClose = onClose
        let editSession = KeyValueEditSession(store: store)
        self.editSession = editSession
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 920, height: 680),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "DashCues"
        if ProcessInfo.processInfo.environment["DASHCUES_UI_TESTING"] != "1" {
            window.setFrameAutosaveName("DashCuesDashboard")
        }
        window.contentViewController = NSHostingController(
            rootView: DashboardView(
                store: store,
                contentNavigation: contentNavigation,
                editSession: editSession,
                onHotKeyChanged: onHotKeyChanged,
                clipboardWriter: clipboardWriter
            )
        )
        super.init(window: window)
        window.delegate = self
        window.centerInVisibleFrame()
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func showWindow(_ sender: Any?) {
        window?.placeInVisibleFrame()
        super.showWindow(sender)
        window?.placeInVisibleFrame()
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard editSession.hasUnsavedChanges else { return true }
        let alert = NSAlert()
        alert.messageText = "有未儲存的變更"
        alert.informativeText = "要儲存、捨棄，還是繼續編輯這個項目？"
        alert.addButton(withTitle: "儲存")
        alert.addButton(withTitle: "捨棄")
        alert.addButton(withTitle: "繼續編輯")
        switch alert.runModal() {
        case .alertFirstButtonReturn:
            return editSession.save()
        case .alertSecondButtonReturn:
            editSession.cancel()
            return true
        default:
            return false
        }
    }

    func windowWillClose(_ notification: Notification) {
        onClose()
    }
}
