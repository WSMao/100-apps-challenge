import Combine

/// Keyboard focus for the menu-bar popover: the "open DashCues" button first, then every app in list order.
@MainActor
final class PopoverNavigation: ObservableObject {
    enum FocusArea { case applications, shortcuts }

    @Published private(set) var focusArea: FocusArea = .applications
    @Published private(set) var selectedShortcutID: String?
    @Published private(set) var focusOnOpenButton = false
    @Published private(set) var selectedApplicationID: String?
    @Published var searchFocused = true
    @Published var searchText = "" {
        didSet {
            guard searchText != oldValue else { return }
            if let id = selectedApplicationID, orderedIDs.contains(id) { return }
            selectedApplicationID = orderedIDs.first
            leaveShortcuts()
        }
    }

    private let store: ShortcutStore
    private let onOpenDashboard: () -> Void
    private let onClose: () -> Void

    init(store: ShortcutStore, onOpenDashboard: @escaping () -> Void, onClose: @escaping () -> Void) {
        self.store = store
        self.onOpenDashboard = onOpenDashboard
        self.onClose = onClose
        selectedApplicationID = orderedIDs.first
    }

    private func matchesSearch(_ application: ShortcutApplication) -> Bool {
        let text = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty
            || application.name.localizedCaseInsensitiveContains(text)
            || application.bundleIdentifier.localizedCaseInsensitiveContains(text)
    }

    var pinnedApplications: [ShortcutApplication] { store.pinnedApplications.filter(matchesSearch) }
    var otherApplications: [ShortcutApplication] { store.otherApplications.filter(matchesSearch) }

    private var orderedIDs: [String] {
        (pinnedApplications + otherApplications).map(\.id)
    }

    func openDashboard() {
        onOpenDashboard()
    }

    func focusOpenButton() {
        focusOnOpenButton = true
        leaveShortcuts()
    }

    func focusApplication(_ id: String) {
        focusOnOpenButton = false
        if selectedApplicationID != id { leaveShortcuts() }
        focusArea = .applications
        selectedApplicationID = id
    }

    private func leaveShortcuts() {
        focusArea = .applications
        selectedShortcutID = nil
    }

    private var currentShortcutIDs: [String] {
        selectedApplicationID.flatMap { store.application(id: $0) }?.shortcuts.map(\.id) ?? []
    }

    /// Returns true when the key was handled.
    func handle(keyCode: UInt16) -> Bool {
        if searchFocused { return handleSearchKey(keyCode: keyCode) }
        switch keyCode {
        case 53:
            onClose()
        case 36, 76:
            guard focusOnOpenButton else { return false }
            onOpenDashboard()
        case 124:
            guard !focusOnOpenButton, focusArea == .applications, let first = currentShortcutIDs.first else { return true }
            focusArea = .shortcuts
            selectedShortcutID = first
        case 123:
            guard focusArea == .shortcuts else { return true }
            leaveShortcuts()
        case 125:
            move(by: 1)
        case 126:
            move(by: -1)
        default:
            return false
        }
        return true
    }

    /// While the search field has focus only Esc and the down arrow are intercepted; everything else is typing.
    private func handleSearchKey(keyCode: UInt16) -> Bool {
        switch keyCode {
        case 53:
            if searchText.isEmpty { onClose() } else { searchText = "" }
            return true
        case 125:
            searchFocused = false
            if let first = orderedIDs.first { focusApplication(first) }
            return true
        case 126:
            searchFocused = false
            focusOpenButton()
            return true
        default:
            return false
        }
    }

    private func move(by delta: Int) {
        if focusArea == .shortcuts {
            let ids = currentShortcutIDs
            guard let current = selectedShortcutID.flatMap({ ids.firstIndex(of: $0) }) else { return }
            selectedShortcutID = ids[min(max(current + delta, 0), ids.count - 1)]
            return
        }
        let ids = orderedIDs
        if focusOnOpenButton {
            if delta > 0 {
                focusOnOpenButton = false
                searchFocused = true
            }
            return
        }
        guard let current = selectedApplicationID.flatMap({ ids.firstIndex(of: $0) }) else {
            searchFocused = true
            return
        }
        let target = current + delta
        if target < 0 {
            searchFocused = true
        } else if target < ids.count {
            selectedApplicationID = ids[target]
        }
    }
}
