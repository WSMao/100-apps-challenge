import AppKit
import Combine
import SwiftUI

@MainActor
final class PinnedMapWindowManager: NSObject, ObservableObject, NSWindowDelegate {
    private var windows: [String: NSPanel] = [:]
    @Published private(set) var pinnedApplicationIDs = Set<String>()

    private let store: ShortcutStore?
    private let contentNavigation: SharedContentNavigation?
    private let clipboardWriter: (String) -> Bool

    init(
        store: ShortcutStore? = nil,
        contentNavigation: SharedContentNavigation? = nil,
        clipboardWriter: @escaping (String) -> Bool = SystemClipboardWriter.write
    ) {
        self.store = store
        self.contentNavigation = contentNavigation
        self.clipboardWriter = clipboardWriter
        super.init()
    }

    func isPinned(applicationID: String) -> Bool {
        pinnedApplicationIDs.contains(applicationID)
    }

    func toggle(application: ShortcutApplication) {
        if isPinned(applicationID: application.id) {
            close(applicationID: application.id)
        } else {
            show(application: application)
        }
    }

    func show(application: ShortcutApplication) {
        if let existingWindow = windows[application.id] {
            existingWindow.contentViewController = NSHostingController(
                rootView: makeContentView(for: application)
            )
            existingWindow.placeInVisibleFrame()
            existingWindow.makeKeyAndOrderFront(nil)
            return
        }

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 380, height: 480),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        panel.title = "\(application.name) 參考內容"
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isReleasedWhenClosed = false
        panel.delegate = self
        panel.contentViewController = NSHostingController(
            rootView: makeContentView(for: application)
        )
        windows[application.id] = panel
        pinnedApplicationIDs.insert(application.id)
        panel.centerInVisibleFrame()
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
    }

    @ViewBuilder
    private func makeContentView(for application: ShortcutApplication) -> some View {
        if let store, let contentNavigation {
            PinnedApplicationView(
                store: store,
                contentNavigation: contentNavigation,
                applicationID: application.id,
                onTogglePin: { [weak self] in self?.close(applicationID: application.id) },
                clipboardWriter: clipboardWriter
            )
        } else {
            ShortcutMapView(
                application: application,
                isPinned: true,
                onTogglePin: { [weak self] in self?.close(applicationID: application.id) }
            )
        }
    }

    func close(applicationID: String) {
        guard let window = windows[applicationID] else { return }
        window.close()
    }

    func windowWillClose(_ notification: Notification) {
        guard let closedWindow = notification.object as? NSWindow else { return }
        guard let applicationID = windows.first(where: { $0.value === closedWindow })?.key else { return }
        windows.removeValue(forKey: applicationID)
        pinnedApplicationIDs.remove(applicationID)
    }
}

/// Floating window view showing ordered type-icon sheet tabs and read-only cheatsheet content.
struct PinnedApplicationView: View {
    @ObservedObject var store: ShortcutStore
    @ObservedObject var contentNavigation: SharedContentNavigation
    let applicationID: String
    let onTogglePin: () -> Void
    var clipboardWriter: (String) -> Bool = SystemClipboardWriter.write

    @State private var tableNav: TableKeyboardNavigation?
    @State private var keyMonitor: Any?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var navigationChangeToken = 0

    private var navigationPublisher: AnyPublisher<Void, Never> {
        if let tableNav {
            return tableNav.objectWillChange.map { _ in () }.eraseToAnyPublisher()
        }
        return Empty<Void, Never>().eraseToAnyPublisher()
    }

    private var application: ShortcutApplication? {
        store.application(id: applicationID)
    }

    private var currentSheet: AppSheet? {
        guard let application else { return nil }
        return contentNavigation.selectedSheet(for: application.id, in: application.sheets)
    }

    var body: some View {
        let _ = navigationChangeToken
        Group {
            if let application {
                VStack(alignment: .leading, spacing: 12) {
                    header(for: application)
                    contentTabs(for: application)
                    Divider()
                    detailView(for: application)
                }
                .padding(14)
            } else {
                Text("找不到此 App。").foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 360, minHeight: 460)
        .background(Color(nsColor: .windowBackgroundColor))
        .onReceive(navigationPublisher) { _ in
            navigationChangeToken &+= 1
        }
        .onAppear {
            setupNavigation()
        }
        .onDisappear {
            teardownNavigation()
        }
        .onChange(of: currentSheet?.id) { newSheetID in
            if let newSheetID, tableNav?.selectedSheetID != newSheetID {
                tableNav?.selectSheet(id: newSheetID)
            }
        }
        .alert("無法完成操作", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("好", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .overlay(alignment: .bottom) {
            if let successMessage {
                Text(successMessage)
                    .accessibilityIdentifier("key-value.copy-feedback")
                    .padding(8)
                    .background(.regularMaterial, in: Capsule())
                    .padding()
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            self.successMessage = nil
                        }
                    }
            }
        }
    }

    private func header(for application: ShortcutApplication) -> some View {
        HStack(spacing: 8) {
            ApplicationIconView(application: application, size: 24)
            Text(application.name)
                .font(.headline)
            Spacer()
            Button(action: onTogglePin) {
                Image(systemName: "pin.slash.fill")
            }
            .buttonStyle(.borderless)
            .help("關閉固定的 App 視窗")
            .accessibilityLabel("關閉固定的 App 視窗")
            .accessibilityIdentifier("pinned.unpin-button")
        }
    }

    private func contentTabs(for application: ShortcutApplication) -> some View {
        let selectedID = currentSheet?.id
        let isTabBarFocused = tableNav?.focusArea == .tabs
        return GeometryReader { geometry in
            let overflow = TabOverflowLayout(
                sheets: application.sheets,
                availableWidth: geometry.size.width > 0 ? geometry.size.width : nil,
                maxVisible: 3,
                selectedID: selectedID,
                isCompact: true
            )
            HStack(spacing: 6) {
                ForEach(overflow.visibleSheets) { sheet in
                    let isSelected = sheet.id == selectedID
                    let isFocused = isTabBarFocused && isSelected
                    Button {
                        NSApp.keyWindow?.makeFirstResponder(nil)
                        tableNav?.focusArea = .tabs
                        contentNavigation.selectSheet(sheet, for: application.id)
                        tableNav?.selectSheet(id: sheet.id)
                    } label: {
                        Label(sheet.name, systemImage: sheet.kind == .shortcuts ? "keyboard" : "list.bullet.rectangle")
                            .font(.caption)
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(isSelected ? Color.accentColor.opacity(0.18) : .clear, in: Capsule())
                            .overlay {
                                Capsule().stroke(
                                    isSelected ? Color.accentColor : Color(nsColor: .separatorColor),
                                    lineWidth: isFocused ? 2 : 1
                                )
                            }
                    }
                    .buttonStyle(.plain)
                    .fixedSize(horizontal: true, vertical: false)
                    .accessibilityIdentifier("pinned.sheet-tab.\(sheet.id)")
                    .accessibilityValue(isSelected ? "已選取" : "未選取")
                }
                if !overflow.overflowSheets.isEmpty {
                    Menu("") {
                        ForEach(overflow.overflowSheets) { sheet in
                            Button {
                                NSApp.keyWindow?.makeFirstResponder(nil)
                                contentNavigation.selectSheet(sheet, for: application.id)
                                tableNav?.selectSheet(id: sheet.id)
                            } label: {
                                Label(sheet.name, systemImage: sheet.kind == .shortcuts ? "keyboard" : "list.bullet.rectangle")
                            }
                        }
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                    .accessibilityIdentifier("pinned.tab-overflow-menu")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .frame(height: 28)
    }

    @ViewBuilder
    private func detailView(for application: ShortcutApplication) -> some View {
        switch currentSheet?.kind ?? .shortcuts {
        case .shortcuts:
            ShortcutMapView(
                application: application,
                isPinned: true,
                onTogglePin: onTogglePin,
                sheetID: currentSheet?.id
            )
        case .keyValue:
            KeyValueCheatsheetView(
                store: store,
                contentNavigation: contentNavigation,
                applicationID: application.id,
                sheetID: currentSheet?.id,
                onError: { errorMessage = $0 },
                onCopySuccess: { successMessage = $0 },
                clipboardWriter: clipboardWriter,
                isReadOnly: true,
                navigation: tableNav
            )
        }
    }

    private func setupNavigation() {
        let nav = TableKeyboardNavigation(
            store: store,
            applicationID: applicationID,
            editSession: nil,
            clipboardWriter: clipboardWriter
        )
        nav.isPinnedWindow = true
        nav.focusArea = .tabs
        nav.onCopyResult = { success, fieldName in
            if success {
                successMessage = "\(fieldName) 已複製。"
            } else {
                errorMessage = "無法複製 \(fieldName) 到剪貼簿。"
                successMessage = nil
            }
        }
        if let current = currentSheet {
            nav.selectedSheetID = current.id
        }
        tableNav = nav
        if keyMonitor == nil {
            keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                guard let window = event.window,
                      window is NSPanel,
                      window.styleMask.contains(.titled),
                      window.attachedSheet == nil,
                      window.sheetParent == nil,
                      let nav = tableNav else {
                    return event
                }
                if let current = currentSheet, nav.selectedSheetID != current.id {
                    nav.selectedSheetID = current.id
                }
                let previousSheetID = nav.selectedSheetID
                if nav.consumes(keyDown: event) {
                    if nav.selectedSheetID != previousSheetID, let sel = nav.currentSheet {
                        contentNavigation.selectSheet(sel, for: applicationID)
                    }
                    return nil
                }
                return event
            }
        }
    }

    private func teardownNavigation() {
        if let keyMonitor {
            NSEvent.removeMonitor(keyMonitor)
            self.keyMonitor = nil
        }
    }
}
