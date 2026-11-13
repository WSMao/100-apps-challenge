import AppKit
import Combine
import SwiftUI

struct KeyValueCheatsheetView: View {
    @ObservedObject var store: ShortcutStore
    @ObservedObject var contentNavigation: SharedContentNavigation
    let applicationID: String
    var sheetID: String? = nil
    let onError: (String) -> Void
    let onCopySuccess: (String) -> Void
    let clipboardWriter: (String) -> Bool
    var isReadOnly = false
    var editSession: KeyValueEditSession?
    var navigation: TableKeyboardNavigation? = nil
    var recentSearchStore: RecentSearchStore? = nil
    var showsSearchBar: Bool = true
    var onSearchFocusChanged: (Bool) -> Void = { _ in }
    var onJumpToDashboard: ((KeyValueSearchResult) -> Void)?

    @FocusState private var searchFocused: Bool
    @State private var historySession: SearchHistorySession?
    @State private var searchKeyMonitor: Any?
    @State private var nameEditor: CheatsheetNameRequest?

    private var activeRecentSearchStore: RecentSearchStore {
        recentSearchStore ?? .shared
    }
    @State private var entryPendingDelete: KeyValueEntry?
    @State private var cheatsheetPendingDelete: KeyValueCheatsheet?
    @State private var expandedEntryIDs = Set<String>()
    @State private var expandedSearchResultIDs = Set<String>()
    @State private var searchText = ""
    @State private var isApplyingHistoryPreview = false
    @State private var pendingScrollEntryID: String?
    @State private var jumpHighlightID: String? = nil
    @State private var sessionChangeToken = 0
    @State private var navigationChangeToken = 0

    private var application: ShortcutApplication? {
        store.application(id: applicationID)
    }

    private var cheatsheets: [KeyValueCheatsheet] {
        application?.keyValueCheatsheets ?? []
    }

    private var selectedCheatsheetID: String? {
        if let sheetID { return sheetID }
        return contentNavigation.selectedCheatsheetID(
            for: applicationID,
            availableIDs: cheatsheets.map(\.id)
        )
    }

    private var selectedCheatsheet: KeyValueCheatsheet? {
        cheatsheets.first { $0.id == selectedCheatsheetID }
    }

    private var sessionPublisher: AnyPublisher<Void, Never> {
        if let editSession {
            return editSession.objectWillChange.map { _ in () }.eraseToAnyPublisher()
        }
        return Empty<Void, Never>().eraseToAnyPublisher()
    }

    private var navigationPublisher: AnyPublisher<Void, Never> {
        if let navigation {
            return navigation.objectWillChange.map { _ in () }.eraseToAnyPublisher()
        }
        return Empty<Void, Never>().eraseToAnyPublisher()
    }

    var body: some View {
        let _ = sessionChangeToken
        let _ = navigationChangeToken
        VStack(alignment: .leading, spacing: 12) {
            if cheatsheets.isEmpty {
                VStack(spacing: 10) {
                    Label("尚無 Key-Value 清單", systemImage: "list.bullet.rectangle")
                        .font(.headline)
                    Text(isReadOnly ? "此 App 尚無 Key-Value 清單。" : "建立清單來整理這個 App 的參考內容。")
                        .foregroundStyle(.secondary)
                    if !isReadOnly {
                        Button("建立清單") { createCheatsheet() }
                            .accessibilityIdentifier("key-value.create-cheatsheet")
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                cheatsheetToolbar
                if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    searchResults
                } else if let selectedCheatsheet {
                    entryList(selectedCheatsheet)
                }
            }
        }
        .background {
            Color.clear.accessibilityIdentifier(isReadOnly ? "key-value.read-only" : "key-value.management")
        }
        .onAppear {
            historySession = SearchHistorySession(applicationID: applicationID, recentStore: activeRecentSearchStore)
            selectFirstCheatsheetIfNeeded()
            followPendingJump()
            if searchKeyMonitor == nil {
                searchKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                    guard searchFocused, let session = historySession else { return event }
                    if let textView = event.window?.firstResponder as? NSTextView, textView.hasMarkedText() {
                        return event
                    }
                    let flags = event.modifierFlags.intersection([.command, .option, .control])
                    guard flags.isEmpty else { return event }
                    if event.keyCode == 126 { // Up
                        if let preview = session.handleUp(currentText: searchText) {
                            isApplyingHistoryPreview = true
                            searchText = preview
                            return nil
                        }
                    } else if event.keyCode == 125 { // Down
                        if let preview = session.handleDown() {
                            isApplyingHistoryPreview = true
                            searchText = preview
                            return nil
                        }
                    } else if event.keyCode == 53 { // Esc
                        if let restored = session.handleEsc() {
                            isApplyingHistoryPreview = true
                            searchText = restored
                            return nil
                        }
                    } else if event.keyCode == 36 || event.keyCode == 76 { // Enter
                        if let chosen = session.handleEnter() {
                            isApplyingHistoryPreview = true
                            searchText = chosen
                            return nil
                        }
                    }
                    return event
                }
            }
        }
        .onChange(of: searchText) { _ in
            if isApplyingHistoryPreview {
                isApplyingHistoryPreview = false
            } else if historySession?.isBrowsingHistory == true {
                historySession?.dismiss()
            }
        }
        .onChange(of: applicationID) { newAppID in
            historySession = SearchHistorySession(applicationID: newAppID, recentStore: activeRecentSearchStore)
            selectFirstCheatsheetIfNeeded()
            followPendingJump()
        }
        .onChange(of: contentNavigation.pendingJump) { _ in followPendingJump() }
        .onChange(of: navigation?.selectedEntryIDs) { newSel in
            if let id = jumpHighlightID, let newSel, !newSel.contains(id) {
                jumpHighlightID = nil
            }
        }
        .onChange(of: searchFocused) { focused in
            navigation?.isTextEditing = focused
            if !focused {
                activeRecentSearchStore.record(query: searchText, for: applicationID)
            }
            onSearchFocusChanged(focused)
        }
        .onDisappear {
            if let searchKeyMonitor {
                NSEvent.removeMonitor(searchKeyMonitor)
                self.searchKeyMonitor = nil
            }
            navigation?.isTextEditing = false
            onSearchFocusChanged(false)
        }
        .onChange(of: selectedCheatsheetID) { _ in
            searchText = ""
            if let editSession, editSession.isEditing { editSession.cancel() }
        }
        .onReceive(sessionPublisher) { _ in
            sessionChangeToken &+= 1
        }
        .onReceive(navigationPublisher) { _ in
            navigationChangeToken &+= 1
            if let expanded = navigation?.expandedRowIDs, expanded != expandedEntryIDs {
                expandedEntryIDs = expanded
            }
        }
        .onChange(of: cheatsheets.map(\.id)) { ids in
            if !ids.contains(selectedCheatsheetID ?? "") { selectFirstCheatsheetIfNeeded() }
        }
        .sheet(item: $nameEditor) { request in
            CheatsheetNameEditor(
                title: request.title,
                initialName: request.initialName,
                onSave: { saveCheatsheetName($0, request: request) }
            )
        }
        .confirmationDialog(
            "刪除 Key-Value 清單？",
            isPresented: Binding(
                get: { cheatsheetPendingDelete != nil },
                set: { if !$0 { cheatsheetPendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("刪除", role: .destructive) {
                guard let cheatsheetPendingDelete else { return }
                self.cheatsheetPendingDelete = nil
                leaveEditing {
                    performStoreAction {
                        try store.deleteKeyValueCheatsheet(
                            id: cheatsheetPendingDelete.id,
                            applicationID: applicationID
                        )
                    }
                }
            }
            Button("取消", role: .cancel) { cheatsheetPendingDelete = nil }
        } message: {
            Text("「\(cheatsheetPendingDelete?.name ?? "")」及其內容都會被刪除。")
        }
        .confirmationDialog(
            "刪除這個項目？",
            isPresented: Binding(
                get: { entryPendingDelete != nil },
                set: { if !$0 { entryPendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("刪除", role: .destructive) {
                guard let entry = entryPendingDelete, let selectedCheatsheetID else { return }
                entryPendingDelete = nil
                if editSession?.editingEntryID == entry.id { editSession?.cancel() }
                performStoreAction {
                    try store.deleteKeyValueEntry(
                        id: entry.id,
                        cheatsheetID: selectedCheatsheetID,
                        applicationID: applicationID
                    )
                }
            }
            Button("取消", role: .cancel) { entryPendingDelete = nil }
        } message: {
            Text("此項目會被永久刪除。")
        }
    }

    private var cheatsheetToolbar: some View {
        HStack(spacing: 8) {
            if isReadOnly && sheetID == nil {
                Picker("Key-Value 清單", selection: Binding(
                    get: { selectedCheatsheetID },
                    set: { newID in
                        leaveEditing {
                            contentNavigation.selectCheatsheet(newID, for: applicationID)
                            if let newID { navigation?.selectSheet(id: newID) }
                        }
                    }
                )) {
                    ForEach(cheatsheets) { cheatsheet in
                        Text(cheatsheet.name).tag(Optional(cheatsheet.id))
                    }
                }
                .labelsHidden()
                .accessibilityIdentifier("key-value.cheatsheet-selector")
                .accessibilityValue(selectedCheatsheet?.name ?? "")
                .frame(maxWidth: 150)
            }

            if showsSearchBar {
                TextField("搜尋 Key 或 Value", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                    .focused($searchFocused)
                    .onSubmit {
                        if let session = historySession, let applied = session.handleEnter() {
                            searchText = applied
                        } else {
                            activeRecentSearchStore.record(query: searchText, for: applicationID)
                        }
                    }
                    .accessibilityIdentifier("key-value.search")
                    .frame(maxWidth: isReadOnly ? 180 : 240)
            }

            Spacer()
            if !isReadOnly {
                Button(action: addEntry) {
                    Label("新增項目", systemImage: "plus")
                }
                .disabled(selectedCheatsheet == nil)
                .accessibilityIdentifier("key-value.add-entry")
            }
        }
    }

    private var searchResults: some View {
        let results = store.searchKeyValueEntries(searchText, applicationID: applicationID)
        return Group {
            if results.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                    Text("找不到符合的項目")
                        .font(.headline)
                    Text("請嘗試其他搜尋文字。")
                        .foregroundStyle(.secondary)
                }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(results) { result in
                            KeyValueSearchResultRow(
                                result: result,
                                isExpanded: Binding(
                                    get: { expandedSearchResultIDs.contains(result.id) },
                                    set: { expanded in
                                        if expanded {
                                            expandedSearchResultIDs.insert(result.id)
                                        } else {
                                            expandedSearchResultIDs.remove(result.id)
                                        }
                                    }
                                ),
                                onCopy: { _ = copy($0, field: $1) },
                                onJump: isReadOnly
                                    ? onJumpToDashboard.map { action in { action(result) } }
                                    : { jump(to: result) }
                            )
                        }
                    }
                    .padding(8)
                }
                .accessibilityIdentifier("key-value.search-results")
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func entryList(_ cheatsheet: KeyValueCheatsheet) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let editSession, !isReadOnly, !cheatsheet.entries.isEmpty || editSession.isNewEntry {
                ScrollViewReader { proxy in
                    KeyValueTableView(
                        cheatsheetID: cheatsheet.id,
                        applicationID: applicationID,
                        entries: cheatsheet.entries,
                        layout: cheatsheet.layout,
                        session: editSession,
                        expandedEntryIDs: $expandedEntryIDs,
                        onCopy: copy,
                        onDelete: { entryPendingDelete = $0 },
                        onDeleteEntries: { ids in
                            performStoreAction {
                                try store.deleteKeyValueEntries(
                                    ids: ids,
                                    cheatsheetID: cheatsheet.id,
                                    applicationID: applicationID
                                )
                            }
                        },
                        onMove: { dragged, target, edge in
                            moveEntry(dragged, to: target, edge: edge, in: cheatsheet)
                        },
                        onUpdateLayout: { newOrder, keyWidth, valueWidth in
                            updateLayout(newOrder: newOrder, keyWidth: keyWidth, valueWidth: valueWidth, in: cheatsheet)
                        },
                        navigation: navigation,
                        isReadOnly: isReadOnly,
                        jumpHighlightID: jumpHighlightID,
                        scrollToEntryID: pendingScrollEntryID
                    )
                    .onAppear { scrollToPendingEntry(using: proxy) }
                    .onChange(of: pendingScrollEntryID) { _ in scrollToPendingEntry(using: proxy) }
                }
            } else if cheatsheet.entries.isEmpty {
                VStack(spacing: 10) {
                    Label("此清單尚無項目", systemImage: "text.alignleft")
                        .font(.headline)
                    Text(isReadOnly ? "此清單尚無參考項目。" : "新增 Key 與 Value 來建立第一個參考項目。")
                        .foregroundStyle(.secondary)
                    if !isReadOnly {
                        Button("新增項目", action: addEntry)
                            .accessibilityIdentifier("key-value.add-first-entry")
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(Array(cheatsheet.entries.enumerated()), id: \.element.id) { index, entry in
                                KeyValueEntryRow(
                                    entry: entry,
                                    isReadOnly: isReadOnly,
                                    isFocused: navigation?.focusArea == .table && navigation?.selectedRowIndex == index,
                                    isExpanded: Binding(
                                        get: { expandedEntryIDs.contains(entry.id) },
                                        set: { expanded in
                                            if expanded {
                                                expandedEntryIDs.insert(entry.id)
                                                navigation?.expandedRowIDs.insert(entry.id)
                                            } else {
                                                expandedEntryIDs.remove(entry.id)
                                                navigation?.expandedRowIDs.remove(entry.id)
                                            }
                                        }
                                    ),
                                    onEdit: {},
                                    onDelete: {
                                        performStoreAction {
                                            try store.deleteKeyValueEntry(
                                                id: entry.id,
                                                cheatsheetID: cheatsheet.id,
                                                applicationID: applicationID
                                            )
                                        }
                                    },
                                    onCopy: { _ = copy($0, field: $1) },
                                    onMove: { draggedEntryID in
                                        moveEntry(draggedEntryID, to: entry.id, in: cheatsheet)
                                    }
                                )
                                .id(entry.id)
                            }
                        }
                        .padding(8)
                    }
                    .accessibilityIdentifier("key-value.entries")
                    .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
                    .onAppear { scrollToPendingEntry(using: proxy) }
                    .onChange(of: pendingScrollEntryID) { _ in scrollToPendingEntry(using: proxy) }
                }
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func jump(to result: KeyValueSearchResult) {
        activeRecentSearchStore.record(query: searchText, for: applicationID)
        contentNavigation.selectCheatsheet(result.cheatsheetID, for: applicationID)
        contentNavigation.selectContentType(.keyValue)
        if let sheet = cheatsheets.first(where: { $0.id == result.cheatsheetID }),
           let idx = sheet.entries.firstIndex(where: { $0.id == result.entry.id }) {
            navigation?.selectSheet(id: result.cheatsheetID, entryID: result.entry.id, rowIndex: idx)
        } else {
            navigation?.selectSheet(id: result.cheatsheetID)
        }
        pendingScrollEntryID = result.entry.id
        jumpHighlightID = result.entry.id
        searchText = ""
    }

    private func followPendingJump() {
        guard !isReadOnly, let jump = contentNavigation.pendingJump,
              jump.applicationID == applicationID,
              let sheet = cheatsheets.first(where: { $0.id == jump.cheatsheetID }),
              let idx = sheet.entries.firstIndex(where: { $0.id == jump.entryID }) else { return }
        activeRecentSearchStore.record(query: searchText, for: applicationID)
        contentNavigation.selectCheatsheet(jump.cheatsheetID, for: applicationID)
        contentNavigation.selectContentType(.keyValue)
        navigation?.selectSheet(id: jump.cheatsheetID, entryID: jump.entryID, rowIndex: idx)
        pendingScrollEntryID = jump.entryID
        jumpHighlightID = jump.entryID
        searchText = ""
        contentNavigation.completeJump(jump)
    }

    private func scrollToPendingEntry(using proxy: ScrollViewProxy) {
        guard let entryID = pendingScrollEntryID else { return }
        DispatchQueue.main.async {
            withAnimation {
                proxy.scrollTo(entryID, anchor: .center)
            }
            if pendingScrollEntryID == entryID {
                pendingScrollEntryID = nil
            }
        }
    }

    private func addEntry() {
        guard let selectedCheatsheetID else { return }
        if let newID = editSession?.beginNew(cheatsheetID: selectedCheatsheetID, applicationID: applicationID) {
            navigation?.focusArea = .table
            pendingScrollEntryID = newID
        }
    }

    private func leaveEditing(_ proceed: @escaping () -> Void) {
        if let editSession {
            editSession.requestLeave(proceed)
        } else {
            proceed()
        }
    }

    @discardableResult
    private func copy(_ text: String, field: String) -> Bool {
        guard clipboardWriter(text) else {
            onError("無法複製 \(field) 到剪貼簿。")
            return false
        }
        onCopySuccess("\(field) 已複製。")
        return true
    }

    private func moveEntry(
        _ draggedEntryID: String,
        to targetEntryID: String,
        edge: DropInsertionEdge = .bottom,
        in cheatsheet: KeyValueCheatsheet
    ) {
        guard let source = cheatsheet.entries.firstIndex(where: { $0.id == draggedEntryID }),
              let target = cheatsheet.entries.firstIndex(where: { $0.id == targetEntryID })
        else {
            return
        }

        let destination: Int
        switch edge {
        case .top:
            destination = target
        case .bottom:
            destination = target + 1
        }

        if source == destination || source + 1 == destination {
            return
        }

        performStoreAction {
            try store.moveKeyValueEntries(
                fromOffsets: IndexSet(integer: source),
                toOffset: destination,
                cheatsheetID: cheatsheet.id,
                applicationID: applicationID
            )
        }
    }

    private func updateLayout(
        newOrder: [KeyValueColumn]?,
        keyWidth: Double?,
        valueWidth: Double?,
        in cheatsheet: KeyValueCheatsheet
    ) {
        performStoreAction {
            try store.updateKeyValueLayout(
                cheatsheetID: cheatsheet.id,
                applicationID: applicationID,
                columnOrder: newOrder,
                keyWidth: keyWidth,
                valueWidth: valueWidth
            )
        }
    }

    private func createCheatsheet() {
        nameEditor = CheatsheetNameRequest(title: "新增 Key-Value 清單", initialName: "")
    }

    private func selectFirstCheatsheetIfNeeded() {
        contentNavigation.selectCheatsheet(selectedCheatsheetID, for: applicationID)
    }

    private func saveCheatsheetName(_ name: String, request: CheatsheetNameRequest) -> Bool {
        do {
            if let cheatsheetID = request.cheatsheetID {
                try store.renameKeyValueCheatsheet(
                    id: cheatsheetID,
                    name: name,
                    applicationID: applicationID
                )
            } else {
                let id = try store.createKeyValueCheatsheet(
                    name: name,
                    applicationID: applicationID
                )
                contentNavigation.selectCheatsheet(id, for: applicationID)
            }
            return true
        } catch {
            onError(error.localizedDescription)
            return false
        }
    }

    private func performStoreAction(_ action: () throws -> Void) {
        do {
            try action()
        } catch {
            onError(error.localizedDescription)
        }
    }
}

private struct KeyValueEntryRow: View {
    let entry: KeyValueEntry
    let isReadOnly: Bool
    var isFocused = false
    @Binding var isExpanded: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onCopy: (String, String) -> Void
    let onMove: (String) -> Void

    private var preview: String {
        let key = entry.key.isEmpty ? "（空白 Key）" : entry.key
        let value = entry.value.isEmpty ? "（空白 Value）" : entry.value
        let singleLine = "\(key) — \(value)"
            .components(separatedBy: .newlines)
            .joined(separator: " ")
        guard singleLine.count > 100 else { return singleLine }
        return String(singleLine.prefix(99)) + "…"
    }

    private var rowContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button {
                    isExpanded.toggle()
                } label: {
                    Text(preview)
                        .font(.headline)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(preview)
                .accessibilityIdentifier("key-value.entry-preview.\(entry.id)")

                if !isReadOnly {
                    Button("編輯", action: onEdit)
                        .accessibilityIdentifier("key-value.edit-entry.\(entry.id)")
                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.borderless)
                    .help("刪除項目")
                    .accessibilityLabel("刪除項目")
                    .accessibilityIdentifier("key-value.delete-entry.\(entry.id)")
                }
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Key")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(entry.key.isEmpty ? "（空白 Key）" : entry.key)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("key-value.entry-key-text")
                        Button("複製 Key") { onCopy(entry.key, "Key") }
                            .accessibilityIdentifier("key-value.copy-key.\(entry.id)")
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Value")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(entry.value.isEmpty ? "（空白 Value）" : entry.value)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("key-value.entry-value-text")
                        Button("複製 Value") { onCopy(entry.value, "Value") }
                            .accessibilityIdentifier("key-value.copy-value.\(entry.id)")
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isFocused ? Color.accentColor.opacity(0.08) : Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isFocused ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: isFocused ? 2 : 1))
        .accessibilityElement(children: .contain)
    }

    var body: some View {
        Group {
            if isReadOnly {
                rowContent
            } else {
                rowContent
                    .draggable(entry.id)
                    .dropDestination(for: String.self) { draggedIDs, _ in
                        guard let draggedEntryID = draggedIDs.first else { return false }
                        onMove(draggedEntryID)
                        return true
                    }
            }
        }
        .help(isReadOnly ? "" : "拖曳以重新排序")
    }
}

private struct KeyValueSearchResultRow: View {
    let result: KeyValueSearchResult
    @Binding var isExpanded: Bool
    let onCopy: (String, String) -> Void
    let onJump: (() -> Void)?

    private var preview: String {
        let key = result.entry.key.isEmpty ? "（空白 Key）" : result.entry.key
        let value = result.entry.value.isEmpty ? "（空白 Value）" : result.entry.value
        let singleLine = "\(key) — \(value)"
            .components(separatedBy: .newlines)
            .joined(separator: " ")
        guard singleLine.count > 100 else { return singleLine }
        return String(singleLine.prefix(99)) + "…"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.cheatsheetName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("key-value.search-result.sheet.\(result.id)")
                    Button {
                        isExpanded.toggle()
                    } label: {
                        Text(preview)
                            .font(.headline)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(preview)
                    .accessibilityIdentifier("key-value.search-result.preview.\(result.id)")
                }

                if let onJump {
                    Button(action: onJump) {
                        Image(systemName: "arrow.up.right.square")
                    }
                    .buttonStyle(.borderless)
                    .help("前往清單")
                    .accessibilityLabel("前往清單")
                    .accessibilityIdentifier("key-value.search-result.jump.\(result.id)")
                }
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Key")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(result.entry.key.isEmpty ? "（空白 Key）" : result.entry.key)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("key-value.search-result.key-text.\(result.id)")
                        Button("複製 Key") { onCopy(result.entry.key, "Key") }
                            .accessibilityIdentifier("key-value.search-result.copy-key.\(result.id)")
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Value")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(result.entry.value.isEmpty ? "（空白 Value）" : result.entry.value)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("key-value.search-result.value-text.\(result.id)")
                        Button("複製 Value") { onCopy(result.entry.value, "Value") }
                            .accessibilityIdentifier("key-value.search-result.copy-value.\(result.id)")
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
        .accessibilityElement(children: .contain)
    }
}

enum SystemClipboardWriter {
    static func write(_ text: String) -> Bool {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        return pasteboard.setString(text, forType: .string)
    }
}

private struct CheatsheetNameRequest: Identifiable {
    let id = UUID()
    let title: String
    let initialName: String
    var cheatsheetID: String?

    init(title: String, initialName: String, cheatsheetID: String? = nil) {
        self.title = title
        self.initialName = initialName
        self.cheatsheetID = cheatsheetID
    }
}

private struct CheatsheetNameEditor: View {
    let title: String
    let onSave: (String) -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var name: String

    init(title: String, initialName: String, onSave: @escaping (String) -> Bool) {
        self.title = title
        self.onSave = onSave
        _name = State(initialValue: initialName)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title).font(.headline)
            TextField("清單名稱", text: $name)
                .accessibilityIdentifier("key-value.cheatsheet-name")
            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("儲存") {
                    if onSave(name) { dismiss() }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("key-value.save-cheatsheet-name")
            }
        }
        .padding(20)
        .frame(width: 360)
    }
}
