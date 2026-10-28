import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var store: ShortcutStore?
    private var statusBarController: StatusBarController?
    private var pinnedWindowManager: PinnedMapWindowManager?
    private var hotKeyManager: GlobalHotKeyManager?
    private var dashboardWindowController: DashboardWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        do {
            let store = try ShortcutStore()
            let pinnedWindowManager = PinnedMapWindowManager()
            self.store = store
            self.pinnedWindowManager = pinnedWindowManager
            statusBarController = StatusBarController(
                store: store,
                pinnedWindowManager: pinnedWindowManager,
                onOpenDashboard: { [weak self] in self?.openDashboard() }
            )
            let manager = try GlobalHotKeyManager { [weak self] in
                self?.statusBarController?.showPopover()
            }
            hotKeyManager = manager
            do {
                try manager.register(store.hotKey)
            } catch {
                showError(error, title: "全域快捷鍵無法使用")
            }
        } catch {
            showError(error, title: "DashCues 啟動失敗")
            NSApp.terminate(nil)
        }
    }

    private func openDashboard() {
        guard let store else { return }
        NSApp.setActivationPolicy(.regular)
        if dashboardWindowController == nil {
            dashboardWindowController = DashboardWindowController(
                store: store,
                onHotKeyChanged: { [weak self] configuration in
                    guard let self else { throw AppDelegateError.unavailable }
                    try self.updateHotKey(configuration)
                },
                onClose: { [weak self] in
                    self?.dashboardWindowController = nil
                    NSApp.setActivationPolicy(.accessory)
                }
            )
        }
        dashboardWindowController?.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
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
}

private enum AppDelegateError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        "DashCues 尚未完成初始化，請重新啟動 App。"
    }
}

private final class StatusBarController: NSObject {
    private let store: ShortcutStore
    private let pinnedWindowManager: PinnedMapWindowManager
    private let onOpenDashboard: () -> Void
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private let contextMenu = NSMenu()
    private var popoverPanel: PopoverPanel?
    private let panelSize = NSSize(width: 620, height: 480)
    private let panelPadding: CGFloat = 8
    private var pendingSingleClickWorkItem: DispatchWorkItem?

    init(
        store: ShortcutStore,
        pinnedWindowManager: PinnedMapWindowManager,
        onOpenDashboard: @escaping () -> Void
    ) {
        self.store = store
        self.pinnedWindowManager = pinnedWindowManager
        self.onOpenDashboard = onOpenDashboard
        super.init()

        if let button = statusItem.button {
            button.image = Self.statusBarIconImage()
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
                navigation: navigation
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

    init(
        store: ShortcutStore,
        onHotKeyChanged: @escaping @MainActor (HotKeyConfiguration) throws -> Void,
        onClose: @escaping () -> Void
    ) {
        self.onClose = onClose
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 920, height: 680),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "DashCues"
        window.setFrameAutosaveName("DashCuesDashboard")
        window.contentViewController = NSHostingController(
            rootView: DashboardView(store: store, onHotKeyChanged: onHotKeyChanged)
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

    func windowWillClose(_ notification: Notification) {
        onClose()
    }
}
