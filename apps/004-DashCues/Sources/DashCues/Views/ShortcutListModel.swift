import AppKit
import Combine

enum ShortcutField: CaseIterable {
    case title, keys, tags
}

struct TagSuggestion: Identifiable, Equatable {
    let name: String
    let isNew: Bool
    var id: String { (isNew ? "new:" : "tag:") + name }
}

struct ScrollRequest: Equatable {
    let id: String
    let token: Int
}

@MainActor
final class ShortcutListModel: ObservableObject {
    @Published private(set) var selection: Set<String> = []
    @Published private(set) var editingID: String?
    @Published private(set) var editingField: ShortcutField?
    @Published var workingItem: ShortcutItem?
    @Published private(set) var pendingItem: ShortcutItem?
    @Published private(set) var recordingPreview: String?
    @Published private(set) var scrollTarget: ScrollRequest?
    @Published private(set) var suggestionIndex: Int?
    @Published private(set) var focusToken = 0
    @Published var tagDraft = "" {
        didSet { if tagDraft != oldValue { suggestionIndex = nil } }
    }
    @Published var requestsDeleteConfirmation = false

    // Search state. Keyword, tags and key combination are combined with AND.
    @Published var searchText = "" {
        didSet {
            guard searchText != oldValue else { return }
            searchSuggestionIndex = nil
            searchChanged()
        }
    }
    @Published private(set) var searchTags: [String] = [] { didSet { searchChanged() } }
    @Published private(set) var searchKeys: [String] = [] { didSet { searchChanged() } }
    @Published private(set) var isRecordingSearchKeys = false
    @Published private(set) var searchSuggestionIndex: Int?
    @Published private(set) var searchFocusToken = 0
    @Published var searchFocused = false

    var onError: (String) -> Void = { _ in }
    weak var listView: NSView?
    weak var editingRowView: NSView?
    weak var searchBarView: NSView?

    private let store: ShortcutStore
    private(set) var applicationID: String
    private var cursorID: String?
    private var anchorID: String?
    private var fieldOriginal: ShortcutItem?
    private var isListActive = false
    private var scrollToken = 0
    private var monitors: [Any] = []

    init(store: ShortcutStore, applicationID: String) {
        self.store = store
        self.applicationID = applicationID
    }

    /// Saved shortcuts, plus the unsaved new row, with the row being edited replaced by its working copy.
    var rows: [ShortcutItem] {
        let items = allRows
        guard isSearching else { return items }
        // The row being created or edited stays visible even if it does not match yet.
        return items.filter { $0.id == editingID || $0.id == pendingItem?.id || matchesSearch($0) }
    }

    private var allRows: [ShortcutItem] {
        var items = store.application(id: applicationID)?.shortcuts ?? []
        if let pendingItem { items.append(pendingItem) }
        if let editingID, let workingItem, let index = items.firstIndex(where: { $0.id == editingID }) {
            items[index] = workingItem
        }
        return items
    }

    // MARK: - Actions

    func setApplication(_ id: String) {
        guard id != applicationID else { return }
        finishEditing()
        clearSearch()
        applicationID = id
        selection = []
        cursorID = nil
        anchorID = nil
    }

    func addNew() {
        finishEditing()
        let item = ShortcutItem(title: "", keys: [], tags: [])
        pendingItem = item
        isListActive = true
        selection = [item.id]
        cursorID = item.id
        anchorID = item.id
        requestScroll(item.id)
        resignTextFocus()
        beginEditing(item, field: .title)
    }

    func click(_ id: String, field: ShortcutField?, modifiers: NSEvent.ModifierFlags) {
        isListActive = true
        if editingID == id {
            if let field { setField(field) }
            return
        }
        finishEditing()
        resignTextFocus()
        let ids = rows.map(\.id)
        guard ids.contains(id) else { return }

        if modifiers.contains(.shift), let anchor = anchorID, let a = ids.firstIndex(of: anchor),
           let b = ids.firstIndex(of: id) {
            selection = Set(ids[min(a, b)...max(a, b)])
            cursorID = id
        } else if modifiers.contains(.command) {
            if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
            cursorID = id
            anchorID = id
        } else if let field, selection == [id], let item = rows.first(where: { $0.id == id }) {
            beginEditing(item, field: field)
        } else {
            selection = [id]
            cursorID = id
            anchorID = id
        }
    }

    func requestDelete() {
        guard !selection.isEmpty else { return }
        requestsDeleteConfirmation = true
    }

    func confirmDelete() {
        let ids = rows.map(\.id)
        let firstIndex = ids.firstIndex { selection.contains($0) } ?? 0
        do {
            try store.deleteShortcuts(ids: selection, applicationID: applicationID)
        } catch {
            onError(error.localizedDescription)
        }
        let remaining = rows.map(\.id)
        selection = []
        cursorID = nil
        anchorID = nil
        if !remaining.isEmpty {
            let next = remaining[min(firstIndex, remaining.count - 1)]
            selection = [next]
            cursorID = next
            anchorID = next
        }
    }

    /// Leaves input mode. The shortcut is kept only if it has a name or a key combination.
    func finishEditing(revertCurrentField: Bool = false) {
        if !revertCurrentField, editingField == .tags { commitDraft() }
        guard let id = editingID, var item = workingItem else { return }
        if revertCurrentField, let field = editingField, let original = fieldOriginal {
            switch field {
            case .title: item.title = original.title
            case .keys: item.keys = original.keys
            case .tags: item.tags = original.tags
            }
        }
        let wasPending = pendingItem?.id == id
        editingID = nil
        editingField = nil
        workingItem = nil
        fieldOriginal = nil
        recordingPreview = nil
        tagDraft = ""
        if wasPending { pendingItem = nil }
        resignTextFocus()

        do {
            if item.isBlank {
                if !wasPending {
                    try store.deleteShortcut(id: id, applicationID: applicationID)
                }
                selection.remove(id)
                if cursorID == id { cursorID = nil }
            } else if wasPending || store.application(id: applicationID)?.shortcuts.first(where: { $0.id == id }) != item {
                try store.saveShortcut(item, applicationID: applicationID)
            }
        } catch {
            onError(error.localizedDescription)
        }
    }

    // MARK: - Keyboard

    /// Returns true when the key was consumed.
    func handleKey(keyCode: UInt16, flags: NSEvent.ModifierFlags, characters: String?) -> Bool {
        let flags = flags.intersection([.command, .control, .option, .shift])
        let isReturn = keyCode == 36 || keyCode == 76
        let isEscape = keyCode == 53
        let isTab = keyCode == 48
        let noCommandModifiers = flags.intersection([.command, .control, .option]).isEmpty

        if let field = editingField {
            if field == .keys {
                if flags.isEmpty && isEscape { finishEditing(revertCurrentField: true); return true }
                if flags.isEmpty && isReturn { finishEditing(); return true }
                if isTab && noCommandModifiers { moveField(backwards: flags.contains(.shift)); return true }
                workingItem?.keys = ShortcutKeyFormatter.keys(keyCode: keyCode, flags: flags, characters: characters)
                recordingPreview = nil
                return true
            }
            if field == .tags { return handleTagKey(keyCode: keyCode, flags: flags) }
            if isEscape && flags.isEmpty { finishEditing(revertCurrentField: true); return true }
            if isReturn && noCommandModifiers { finishEditing(); return true }
            if isTab && noCommandModifiers { moveField(backwards: flags.contains(.shift)); return true }
            return false
        }

        guard !selection.isEmpty else { return false }
        if isEscape && flags.isEmpty {
            selection = []
            cursorID = nil
            anchorID = nil
            return true
        }
        if isReturn && flags.isEmpty {
            guard selection.count == 1, let item = rows.first(where: { selection.contains($0.id) }) else {
                return true
            }
            beginEditing(item, field: .title)
            return true
        }
        if (keyCode == 125 || keyCode == 126) && noCommandModifiers {
            moveCursor(by: keyCode == 125 ? 1 : -1, extend: flags.contains(.shift))
            return true
        }
        return false
    }

    func updateRecordingPreview(flags: NSEvent.ModifierFlags) {
        guard editingField == .keys || isRecordingSearchKeys else { return }
        let symbols = ShortcutKeyFormatter.modifierSymbols(flags)
        recordingPreview = symbols.isEmpty ? nil : symbols.joined() + "…"
    }

    // MARK: - Search

    var isSearching: Bool {
        !TagList.clean(searchText).isEmpty || !searchTags.isEmpty || !searchKeys.isEmpty
    }

    func matchesSearch(_ item: ShortcutItem) -> Bool {
        let itemTags = Set(item.tags.map(TagList.key))
        if !searchTags.allSatisfy({ itemTags.contains(TagList.key($0)) }) { return false }
        if !searchKeys.isEmpty, item.keys != searchKeys { return false }
        let text = TagList.clean(searchText)
        guard !text.isEmpty else { return true }
        let haystacks = [item.title] + item.tags + [item.keys.joined(), item.keys.joined(separator: " ")]
        return haystacks.contains { $0.localizedCaseInsensitiveContains(text) }
    }

    /// App tags that can still be added as search filters, narrowed by the typed text.
    var searchSuggestions: [String] {
        let text = TagList.clean(searchText)
        let used = Set(searchTags.map(TagList.key))
        let matches = availableTags
            .filter { !used.contains(TagList.key($0)) }
            .filter { text.isEmpty || $0.localizedCaseInsensitiveContains(text) }
        return Array(matches.prefix(8))
    }

    func addSearchTag(_ name: String) {
        let canonical = store.application(id: applicationID)?.canonicalTags([name]).first ?? TagList.clean(name)
        if !canonical.isEmpty, !searchTags.contains(where: { TagList.key($0) == TagList.key(canonical) }) {
            searchTags.append(canonical)
        }
        searchText = ""
        searchSuggestionIndex = nil
        searchFocusToken += 1
    }

    func removeSearchTag(_ tag: String) {
        searchTags.removeAll { TagList.key($0) == TagList.key(tag) }
    }

    func clearSearchKeys() {
        searchKeys = []
    }

    func clearSearch() {
        searchText = ""
        searchTags = []
        searchKeys = []
        isRecordingSearchKeys = false
        recordingPreview = nil
    }

    func toggleSearchKeyRecording() {
        isRecordingSearchKeys.toggle()
        recordingPreview = nil
        if isRecordingSearchKeys {
            searchFocused = false
            resignTextFocus()
        }
    }

    /// Keys typed into the search field: suggestion navigation, Esc and Backspace-to-remove-chip.
    func handleSearchKey(keyCode: UInt16, flags: NSEvent.ModifierFlags) -> Bool {
        let flags = flags.intersection([.command, .control, .option, .shift])
        guard flags.isEmpty else { return false }
        switch keyCode {
        case 53:
            if searchSuggestionIndex != nil {
                searchSuggestionIndex = nil
            } else {
                searchFocused = false
                resignTextFocus()
            }
            return true
        case 36, 76:
            let items = searchSuggestions
            guard let index = searchSuggestionIndex, items.indices.contains(index) else { return false }
            addSearchTag(items[index])
            return true
        case 125, 126:
            let count = searchSuggestions.count
            guard count > 0 else { return false }
            let delta = keyCode == 125 ? 1 : -1
            if let current = searchSuggestionIndex {
                searchSuggestionIndex = (current + delta + count) % count
            } else {
                searchSuggestionIndex = delta > 0 ? 0 : count - 1
            }
            return true
        case 51:
            guard searchText.isEmpty else { return false }
            if !searchKeys.isEmpty {
                searchKeys = []
                return true
            }
            if !searchTags.isEmpty {
                searchTags.removeLast()
                return true
            }
            return false
        default:
            return false
        }
    }

    private func recordSearchKey(_ event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection([.command, .control, .option, .shift])
        if event.keyCode == 53, flags.isEmpty {
            isRecordingSearchKeys = false
            recordingPreview = nil
            return true
        }
        searchKeys = ShortcutKeyFormatter.keys(keyCode: event.keyCode, flags: flags, characters: event.charactersIgnoringModifiers)
        recordingPreview = nil
        return true
    }

    private func searchChanged() {
        let visible = Set(rows.map(\.id))
        selection = selection.intersection(visible)
        if let cursorID, !visible.contains(cursorID) { self.cursorID = selection.first }
        if let anchorID, !visible.contains(anchorID) { self.anchorID = selection.first }
    }

    // MARK: - Tags

    var availableTags: [String] {
        store.application(id: applicationID)?.tags ?? []
    }

    /// Existing app tags matching the draft, plus an option to create the draft as a new tag.
    var suggestions: [TagSuggestion] {
        guard editingField == .tags, let item = workingItem else { return [] }
        let draft = TagList.clean(tagDraft)
        let used = Set(item.tags.map(TagList.key))
        var result = availableTags
            .filter { !used.contains(TagList.key($0)) }
            .filter { draft.isEmpty || $0.localizedCaseInsensitiveContains(draft) }
            .prefix(8)
            .map { TagSuggestion(name: $0, isNew: false) }
        let exists = availableTags.contains { TagList.key($0) == TagList.key(draft) }
        if !draft.isEmpty, !exists, !used.contains(TagList.key(draft)) {
            result.append(TagSuggestion(name: draft, isNew: true))
        }
        return result
    }

    func addTag(_ name: String) {
        guard var item = workingItem else { return }
        let cleaned = TagList.clean(name)
        if !cleaned.isEmpty {
            let canonical = store.application(id: applicationID)?.canonicalTags([cleaned]).first ?? cleaned
            item.tags = TagList.normalized(item.tags + [canonical])
            workingItem = item
        }
        tagDraft = ""
        suggestionIndex = nil
        focusToken += 1
    }

    func removeTag(_ tag: String, itemID: String) {
        if editingID != itemID {
            guard selection == [itemID], let item = rows.first(where: { $0.id == itemID }) else { return }
            finishEditing()
            beginEditing(item, field: .tags)
        } else if editingField != .tags {
            setField(.tags)
        }
        workingItem?.tags.removeAll { TagList.key($0) == TagList.key(tag) }
        focusToken += 1
    }

    func requestScroll(_ id: String) {
        scrollToken += 1
        scrollTarget = ScrollRequest(id: id, token: scrollToken)
    }

    private func commitDraft() {
        if !TagList.clean(tagDraft).isEmpty { addTag(tagDraft) }
    }

    private func moveSuggestion(by delta: Int) {
        let count = suggestions.count
        guard count > 0 else { return }
        guard let current = suggestionIndex else {
            suggestionIndex = delta > 0 ? 0 : count - 1
            return
        }
        suggestionIndex = (current + delta + count) % count
    }

    // MARK: - Event monitoring

    func startMonitoring() {
        guard monitors.isEmpty else { return }
        let keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self else { return event }
            return MainActor.assumeIsolated { self.consumes(keyDown: event) ? nil : event }
        }
        let flagsMonitor = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            guard let self else { return event }
            MainActor.assumeIsolated {
                if event.window != nil, event.window === self.listView?.window {
                    self.updateRecordingPreview(flags: event.modifierFlags)
                }
            }
            return event
        }
        let mouseMonitor = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { [weak self] event in
            self?.handleMouseDown(event)
            return event
        }
        monitors = [keyMonitor, flagsMonitor, mouseMonitor].compactMap { $0 }
    }

    func stopMonitoring() {
        monitors.forEach(NSEvent.removeMonitor)
        monitors = []
    }

    // MARK: - Private

    private func consumes(keyDown event: NSEvent) -> Bool {
        guard let window = event.window, window === listView?.window else { return false }
        // Let input methods (e.g. Chinese IME) handle Enter/Esc while composing text.
        if let text = window.firstResponder as? NSTextView, text.hasMarkedText() { return false }
        if isRecordingSearchKeys { return recordSearchKey(event) }
        if searchFocused, editingField == nil, window.firstResponder is NSTextView {
            return handleSearchKey(keyCode: event.keyCode, flags: event.modifierFlags)
        }
        let plain = event.modifierFlags.intersection([.command, .control, .option, .shift]).isEmpty
        if plain, editingField == nil {
            if event.keyCode == 124, !isListActive, window.firstResponder is NSTableView {
                return enterList()
            }
            if event.keyCode == 123, isListActive {
                leaveList()
                return true
            }
        }
        guard editingField != nil || isListActive else { return false }
        if editingField == nil, window.firstResponder is NSTextView { return false }
        return handleKey(
            keyCode: event.keyCode,
            flags: event.modifierFlags,
            characters: event.charactersIgnoringModifiers
        )
    }

    /// Moves keyboard focus from the app sidebar into the shortcut list.
    private func enterList() -> Bool {
        let ids = rows.map(\.id)
        guard let first = ids.first else { return true }
        isListActive = true
        resignTextFocus()
        if selection.isEmpty {
            selection = [first]
            cursorID = first
            anchorID = first
        }
        requestScroll(cursorID ?? first)
        return true
    }

    /// Returns keyboard focus to the app sidebar.
    private func leaveList() {
        isListActive = false
        selection = []
        cursorID = nil
        anchorID = nil
        guard let content = listView?.window?.contentView,
              let table = Self.firstTableView(in: content) else { return }
        listView?.window?.makeFirstResponder(table)
    }

    private static func firstTableView(in view: NSView) -> NSTableView? {
        if let table = view as? NSTableView { return table }
        for sub in view.subviews {
            if let found = firstTableView(in: sub) { return found }
        }
        return nil
    }

    private func handleMouseDown(_ event: NSEvent) {
        guard let listView, let window = listView.window, event.window === window else { return }
        let point = event.locationInWindow
        if !frameInWindow(listView).contains(point) {
            isListActive = false
        }
        if isRecordingSearchKeys, let bar = searchBarView, !frameInWindow(bar).contains(point) {
            isRecordingSearchKeys = false
            recordingPreview = nil
        }
        if editingID != nil {
            let insideEditingRow = editingRowView.map { frameInWindow($0).contains(point) } ?? false
            if !insideEditingRow { finishEditing() }
        }
    }

    private func frameInWindow(_ view: NSView) -> NSRect {
        view.convert(view.bounds, to: nil)
    }

    private func resignTextFocus() {
        listView?.window?.makeFirstResponder(nil)
    }

    private func beginEditing(_ item: ShortcutItem, field: ShortcutField) {
        editingID = item.id
        workingItem = item
        setField(field)
    }

    private func setField(_ field: ShortcutField) {
        guard editingField != field else { return }
        if editingField == .tags { commitDraft() }
        tagDraft = ""
        editingField = field
        fieldOriginal = workingItem
        recordingPreview = nil
        if field == .keys { resignTextFocus() }
    }

    private func handleTagKey(keyCode: UInt16, flags: NSEvent.ModifierFlags) -> Bool {
        let isReturn = keyCode == 36 || keyCode == 76
        let noCommandModifiers = flags.intersection([.command, .control, .option]).isEmpty
        if keyCode == 53 && flags.isEmpty {
            finishEditing(revertCurrentField: true)
            return true
        }
        if isReturn && noCommandModifiers {
            let items = suggestions
            if let index = suggestionIndex, items.indices.contains(index) {
                addTag(items[index].name)
            } else if !TagList.clean(tagDraft).isEmpty {
                commitDraft()
            } else {
                finishEditing()
            }
            return true
        }
        if keyCode == 48 && noCommandModifiers {
            moveField(backwards: flags.contains(.shift))
            return true
        }
        if (keyCode == 125 || keyCode == 126) && noCommandModifiers {
            moveSuggestion(by: keyCode == 125 ? 1 : -1)
            return true
        }
        if keyCode == 51 && flags.isEmpty && tagDraft.isEmpty, workingItem?.tags.isEmpty == false {
            workingItem?.tags.removeLast()
            return true
        }
        return false
    }

    private func moveField(backwards: Bool) {
        let fields = ShortcutField.allCases
        guard let current = editingField, let index = fields.firstIndex(of: current) else { return }
        let next = (index + (backwards ? fields.count - 1 : 1)) % fields.count
        setField(fields[next])
    }

    private func moveCursor(by delta: Int, extend: Bool) {
        let ids = rows.map(\.id)
        guard !ids.isEmpty else { return }
        let current = cursorID.flatMap { ids.firstIndex(of: $0) }
            ?? ids.firstIndex { selection.contains($0) }
            ?? 0
        let target = min(max(current + delta, 0), ids.count - 1)
        let targetID = ids[target]
        if extend, let anchor = anchorID.flatMap({ ids.firstIndex(of: $0) }) {
            selection = Set(ids[min(anchor, target)...max(anchor, target)])
        } else {
            selection = [targetID]
            anchorID = targetID
        }
        cursorID = targetID
        requestScroll(targetID)
    }
}
