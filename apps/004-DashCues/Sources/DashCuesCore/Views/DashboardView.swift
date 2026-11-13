import AppKit
import Combine
import SwiftUI
import UniformTypeIdentifiers

struct DashboardView: View {
    @ObservedObject var store: ShortcutStore
    @ObservedObject var contentNavigation: SharedContentNavigation
    @ObservedObject var editSession: KeyValueEditSession
    let onHotKeyChanged: @MainActor (HotKeyConfiguration) throws -> Void
    var clipboardWriter: (String) -> Bool = SystemClipboardWriter.write

    @State private var selectedApplicationID: String?
    @State private var searchText = ""
    @State private var appEditorRequest: AppEditorRequest?
    @State private var showingSettings = false
    @State private var applicationPendingDelete: ShortcutApplication?
    @State private var sheetCreateRequest: SheetCreateRequest?
    @State private var sheetCreateApplicationID: String?
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var sheetSearchText = ""
    @State private var sheetSearchState: SearchBarFocusState = .inactive
    @State private var tableNav: TableKeyboardNavigation?
    @State private var keyMonitor: Any?
    @State private var navigationChangeToken = 0
    @State private var shortcutListCapturingKeys = false
    @State private var searchResultsFocused = false
    @State private var showingImportShortcuts = false

    private enum AppEditorRequest: Identifiable {
        case add
        case edit(ShortcutApplication)

        var id: String {
            switch self {
            case .add: return "add"
            case .edit(let app): return "edit-\(app.id)"
            }
        }

        var application: ShortcutApplication? {
            switch self {
            case .add: return nil
            case .edit(let app): return app
            }
        }
    }

    init(
        store: ShortcutStore,
        contentNavigation: SharedContentNavigation,
        editSession: KeyValueEditSession,
        onHotKeyChanged: @escaping @MainActor (HotKeyConfiguration) throws -> Void,
        clipboardWriter: @escaping (String) -> Bool = SystemClipboardWriter.write
    ) {
        self.store = store
        self.contentNavigation = contentNavigation
        self.editSession = editSession
        self.onHotKeyChanged = onHotKeyChanged
        self.clipboardWriter = clipboardWriter
        let initialAppID = store.applications.first?.id
        _selectedApplicationID = State(initialValue: initialAppID)
        if let initialAppID {
            let nav = TableKeyboardNavigation(
                store: store,
                applicationID: initialAppID,
                editSession: editSession,
                clipboardWriter: clipboardWriter
            )
            if let current = contentNavigation.selectedSheet(for: initialAppID, in: store.application(id: initialAppID)?.sheets ?? []) {
                nav.selectedSheetID = current.id
            }
            configureTableNavCallbacks(nav)
            _tableNav = State(initialValue: nav)
        }
    }

    private var navigationPublisher: AnyPublisher<Void, Never> {
        if let tableNav {
            return tableNav.objectWillChange.map { _ in () }.eraseToAnyPublisher()
        }
        return Empty<Void, Never>().eraseToAnyPublisher()
    }

    private var selectedApplication: ShortcutApplication? {
        guard let selectedApplicationID else { return nil }
        return store.application(id: selectedApplicationID)
    }

    private var currentSheetID: String? {
        guard let app = selectedApplication else { return nil }
        return contentNavigation.selectedSheet(for: app.id, in: app.sheets)?.id
    }

    private var filteredApplications: [ShortcutApplication] {
        guard !searchText.isEmpty else { return store.applications }
        return store.applications.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
                || $0.bundleIdentifier.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var sidebarHeader: some View {
        HStack(spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("搜尋 App", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))

            Button {
                appEditorRequest = .add
            } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.borderless)
            .help("新增 App")
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }

    private var applicationList: some View {
        List(selection: Binding(
            get: { selectedApplicationID },
            set: { newID in
                guard newID != selectedApplicationID else { return }
                editSession.requestLeave {
                    if NSApp.keyWindow?.firstResponder is NSTextView {
                        NSApp.keyWindow?.makeFirstResponder(nil)
                    }
                    tableNav?.focusArea = .sidebar
                    selectedApplicationID = newID
                }
            }
        )) {
                ForEach(filteredApplications) { application in
                    ApplicationRowView(
                        application: application,
                        onTogglePin: {
                            performStoreAction {
                                try store.setPinned(!application.isPinned, applicationID: application.id)
                            }
                        }
                    )
                    .tag(application.id)
                    .accessibilityIdentifier("dashboard.application.\(application.id)")
                }
                .onMove(perform: searchText.isEmpty ? { source, destination in
                    performStoreAction {
                        try store.moveApplications(fromOffsets: source, toOffset: destination)
                    }
                } : nil)
            }
    }

    var body: some View {
        let _ = navigationChangeToken
        NavigationSplitView {
            VStack(spacing: 0) {
                sidebarHeader
                applicationList
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 210)
        } detail: {
            if let selectedApplication {
                applicationDetail(selectedApplication)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "keyboard")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("選擇一個 App")
                        .font(.headline)
                }
            }
        }
        .frame(minWidth: 620, minHeight: 480)
        .onReceive(navigationPublisher) { _ in
            navigationChangeToken &+= 1
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingSettings.toggle()
                } label: {
                    Image(systemName: "gearshape")
                }
                .help("設定")
                .popover(isPresented: $showingSettings, arrowEdge: .bottom) {
                    settingsSection
                }
            }
        }
        .sheet(item: $appEditorRequest) { request in
            ApplicationEditorSheet(
                existingApplication: request.application,
                onSave: { name, bundleIdentifier, symbolName, iconData, tagEdits, sheetEdits in
                    performStoreAction {
                        if let targetApp = request.application {
                            let oldSheets = targetApp.sheets
                            let selectedID = contentNavigation.selectedSheet(for: targetApp.id, in: oldSheets)?.id
                            try store.updateApplicationDetails(
                                id: targetApp.id,
                                name: name,
                                bundleIdentifier: bundleIdentifier,
                                symbolName: symbolName,
                                customIconData: .some(iconData),
                                tagEdits: tagEdits,
                                sheetEdits: sheetEdits
                            )
                            if let sheetEdits {
                                let remaining = store.application(id: targetApp.id)?.sheets ?? []
                                let newID = SheetSelection.afterDeleting(
                                    selected: selectedID,
                                    from: oldSheets.map(\.id),
                                    remaining: remaining.map(\.id)
                                )
                                if sheetEdits.count != oldSheets.count || newID != selectedID {
                                    let targetSheet = remaining.first { $0.id == newID }
                                    contentNavigation.selectSheet(targetSheet, for: targetApp.id)
                                    if let id = targetSheet?.id {
                                        tableNav?.selectSheet(id: id)
                                    }
                                }
                            }
                        } else {
                            selectedApplicationID = try store.addApplication(
                                name: name,
                                bundleIdentifier: bundleIdentifier,
                                symbolName: symbolName,
                                customIconData: iconData
                            )
                        }
                    }
                },
                onDelete: {
                    if let app = request.application {
                        deleteApplication(app)
                    }
                }
            )
        }
        .sheet(item: $sheetCreateRequest) { request in
            SheetNameEditor(kind: request.kind) { name in
                guard let applicationID = sheetCreateApplicationID else { return nil }
                do {
                    let id = try store.createSheet(kind: request.kind, name: name, applicationID: applicationID)
                    contentNavigation.selectSheet(
                        store.application(id: applicationID)?.sheets.first { $0.id == id },
                        for: applicationID
                    )
                    tableNav?.selectSheet(id: id)
                    return nil
                } catch {
                    return error.localizedDescription
                }
            }
        }
        .sheet(isPresented: $showingImportShortcuts) {
            if let application = selectedApplication {
                ShortcutImportSheet(
                    application: application,
                    store: store,
                    clipboardWriter: clipboardWriter,
                    initialSheetID: currentSheetID,
                    onSuccess: { message in
                        successMessage = message
                    },
                    onError: { error in
                        errorMessage = error
                    }
                )
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
                    .padding(10)
                    .background(.regularMaterial, in: Capsule())
                    .padding()
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            self.successMessage = nil
                        }
                    }
            }
        }
        .confirmationDialog(
            "刪除 App？",
            isPresented: Binding(
                    get: { applicationPendingDelete != nil },
                    set: { if !$0 { applicationPendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("刪除", role: .destructive) {
                    guard let applicationPendingDelete else { return }
                    performStoreAction {
                        try store.deleteApplication(id: applicationPendingDelete.id)
                        selectedApplicationID = store.applications.first?.id
                    }
                    self.applicationPendingDelete = nil
            }
            Button("取消", role: .cancel) {
                    applicationPendingDelete = nil
            }
        } message: {
            Text("「\(applicationPendingDelete?.name ?? "")」及其快捷鍵都會被刪除。")
        }
        .onAppear {
            selectedApplicationID = selectedApplicationID ?? store.applications.first?.id
            if let id = selectedApplicationID {
                if tableNav == nil || tableNav?.applicationID != id {
                    updateTableNav(for: id)
                }
            }
            if let nav = tableNav {
                configureTableNavCallbacks(nav)
            }
            followPendingJump()
            syncSidebarFocus(for: tableNav?.focusArea)
            if keyMonitor == nil {
                keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                    guard let window = event.window,
                          !(window is NSPanel),
                          window.attachedSheet == nil,
                          window.sheetParent == nil,
                          appEditorRequest == nil,
                          !showingSettings,
                          sheetCreateRequest == nil,
                          applicationPendingDelete == nil,
                          errorMessage == nil,
                          !editSession.isPromptingToLeave,
                          sheetSearchState == .inactive,
                          !searchResultsFocused else {
                        return event
                    }
                    if editSession.isEditing {
                        if !(window.firstResponder is NSTextView) {
                            let flags = event.modifierFlags.intersection([.command, .option, .control, .shift])
                            if flags.isEmpty {
                                if event.keyCode == 53 {
                                    editSession.cancel()
                                    return nil
                                } else if event.keyCode == 36 || event.keyCode == 76 {
                                    _ = editSession.save()
                                    return nil
                                }
                            }
                        }
                        return event
                    }
                    guard let tableNav else { return event }
                    if let app = selectedApplication,
                       let current = contentNavigation.selectedSheet(for: app.id, in: app.sheets),
                       tableNav.selectedSheetID != current.id {
                        tableNav.selectedSheetID = current.id
                    }
                    if tableNav.currentSheet?.kind == .shortcuts,
                       shortcutListCapturingKeys,
                       tableNav.focusArea != .tabs {
                        return event
                    }
                    if tableNav.focusArea == .sidebar,
                       !tableNav.isFieldEditorFocused,
                       !(window.firstResponder is NSTextView),
                       event.modifierFlags.intersection([.command, .option, .control, .shift]).isEmpty,
                       (event.keyCode == 125 || event.keyCode == 126) {
                        let apps = filteredApplications
                        if let currentID = selectedApplicationID,
                           let idx = apps.firstIndex(where: { $0.id == currentID }) {
                            let targetIdx = event.keyCode == 125
                                ? min(idx + 1, apps.count - 1)
                                : max(idx - 1, 0)
                            if targetIdx != idx {
                                let nextID = apps[targetIdx].id
                                editSession.requestLeave { selectedApplicationID = nextID }
                            }
                            return nil
                        }
                    }
                    let previousSheetID = tableNav.selectedSheetID
                    if tableNav.consumes(keyDown: event) {
                        if tableNav.selectedSheetID != previousSheetID,
                           let selectedSheet = tableNav.currentSheet,
                           let appID = selectedApplicationID {
                            contentNavigation.selectSheet(selectedSheet, for: appID)
                        }
                        return nil
                    }
                    return event
                }
            }
        }
        .onDisappear {
            if let keyMonitor {
                NSEvent.removeMonitor(keyMonitor)
                self.keyMonitor = nil
            }
        }
        .onChange(of: selectedApplicationID) { newID in
            sheetSearchText = ""
            sheetSearchState = .inactive
            if let newID {
                updateTableNav(for: newID)
            }
        }
        .onChange(of: currentSheetID) { newSheetID in
            if let newSheetID, tableNav?.selectedSheetID != newSheetID {
                tableNav?.selectSheet(id: newSheetID)
            }
        }
        .onChange(of: tableNav?.focusArea) { area in
            syncSidebarFocus(for: area)
        }
        .onChange(of: contentNavigation.pendingJump) { _ in followPendingJump() }
        .confirmationDialog(
            "有未儲存的變更",
            isPresented: Binding(
                get: { editSession.isPromptingToLeave },
                set: { if !$0 { editSession.resolveLeave(.continueEditing) } }
            ),
            titleVisibility: .visible
        ) {
            Button("儲存") { editSession.resolveLeave(.save) }
            Button("捨棄", role: .destructive) { editSession.resolveLeave(.discard) }
            Button("繼續編輯", role: .cancel) { editSession.resolveLeave(.continueEditing) }
        } message: {
            Text("要儲存、捨棄，還是繼續編輯這個項目？")
        }
    }

    private func applicationDetail(_ application: ShortcutApplication) -> some View {
        let currentSheet = contentNavigation.selectedSheet(for: application.id, in: application.sheets)
        return VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                ApplicationIconView(application: application, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(application.name)
                        .font(.title.weight(.semibold))
                        .lineLimit(1)
                    Text(application.bundleIdentifier.isEmpty ? "自訂 App" : application.bundleIdentifier)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(minWidth: 70, maxWidth: 140, alignment: .leading)

                contentTabs(for: application)
                    .padding(.leading, 4)
                    .frame(minWidth: 150, maxWidth: .infinity, alignment: .leading)
                    .layoutPriority(1)

                appActionsMenu(for: application)
            }

            if application.sheets.isEmpty {
                emptySheetState(for: application)
            } else {
                HStack(spacing: 8) {
                    SheetSearchBar(
                        text: $sheetSearchText,
                        state: $sheetSearchState,
                        placeholder: "搜尋目前 App 的所有工作表…",
                        applicationID: application.id,
                        onDownArrow: {
                            handleSearchDownArrow(application: application)
                        },
                        onEscNonEditing: {
                            tableNav?.focusArea = .tabs
                        }
                    )
                    .frame(maxWidth: 320)

                    Spacer()
                }
                .zIndex(10)

                if !sheetSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    SheetSearchResultsView(
                        application: application,
                        query: sheetSearchText,
                        store: store,
                        clipboardWriter: clipboardWriter,
                        isFocused: $searchResultsFocused,
                        onExitToSearch: {
                            sheetSearchState = .focusedNonEditing
                        },
                        onSelectSheetIndex: { index in
                            guard index >= 0 && index < application.sheets.count else { return }
                            let targetSheet = application.sheets[index]
                            editSession.requestLeave {
                                NSApp.keyWindow?.makeFirstResponder(nil)
                                tableNav?.selectSheet(id: targetSheet.id)
                                contentNavigation.selectSheet(targetSheet, for: application.id)
                                tableNav?.focusArea = .tabs
                                searchResultsFocused = false
                                sheetSearchState = .inactive
                            }
                        },
                        onCopySuccess: { successMessage = $0 },
                        onJumpToKeyValue: { cheatsheet, entry in
                            jumpToKeyValue(cheatsheet: cheatsheet, entry: entry, in: application)
                        },
                        onJumpToShortcut: { sheet, item in
                            jumpToShortcut(sheet: sheet, item: item, in: application)
                        }
                    )
                } else {
                    switch currentSheet?.kind ?? .shortcuts {
                    case .shortcuts:
                        ShortcutListView(
                            store: store,
                            applicationID: application.id,
                            sheetID: currentSheet?.id,
                            navigation: tableNav,
                            showsSearchBar: false,
                            contentNavigation: contentNavigation,
                            onFocusSearch: { sheetSearchState = .focusedEditing },
                            onKeyboardCaptureChanged: { shortcutListCapturingKeys = $0 }
                        ) { errorMessage = $0 }
                            .id(currentSheet?.id)
                    case .keyValue:
                        KeyValueCheatsheetView(
                            store: store,
                            contentNavigation: contentNavigation,
                            applicationID: application.id,
                            sheetID: currentSheet?.id,
                            onError: {
                                errorMessage = $0
                                successMessage = nil
                            },
                            onCopySuccess: { successMessage = $0 },
                            clipboardWriter: clipboardWriter,
                            editSession: editSession,
                            navigation: tableNav,
                            showsSearchBar: false
                        )
                        .id(currentSheet?.id)
                    }
                }
            }
        }
        .padding(24)
    }

    private func jumpToKeyValue(cheatsheet: KeyValueCheatsheet, entry: KeyValueEntry, in application: ShortcutApplication) {
        let trimmed = sheetSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            RecentSearchStore.shared.record(query: trimmed, for: application.id)
        }
        let idx = cheatsheet.entries.firstIndex(where: { $0.id == entry.id }) ?? 0
        contentNavigation.selectSheet(.keyValue(cheatsheet), for: application.id)
        tableNav?.selectSheet(id: cheatsheet.id, entryID: entry.id, rowIndex: idx)
        sheetSearchText = ""
        searchResultsFocused = false
        sheetSearchState = .inactive
        contentNavigation.requestJump(
            applicationID: application.id,
            result: KeyValueSearchResult(
                cheatsheetID: cheatsheet.id,
                cheatsheetName: cheatsheet.name,
                entry: entry
            )
        )
    }

    private func jumpToShortcut(sheet: ShortcutSheet, item: ShortcutItem, in application: ShortcutApplication) {
        let trimmed = sheetSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            RecentSearchStore.shared.record(query: trimmed, for: application.id)
        }
        contentNavigation.selectSheet(.shortcuts(sheet), for: application.id)
        tableNav?.selectSheet(id: sheet.id, entryID: item.id)
        tableNav?.focusArea = .table
        sheetSearchText = ""
        searchResultsFocused = false
        sheetSearchState = .inactive
        contentNavigation.requestShortcutJump(
            applicationID: application.id,
            sheetID: sheet.id,
            shortcutID: item.id
        )
    }

    private func handleSearchDownArrow(application: ShortcutApplication) {
        let trimmed = sheetSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            let sections = store.searchAllSheets(query: trimmed, in: application)
            let hasResults = sections.contains { !$0.keyValueEntries.isEmpty || !$0.shortcuts.isEmpty }
            if hasResults {
                searchResultsFocused = true
            }
        } else {
            searchResultsFocused = false
            let currentSheet = contentNavigation.selectedSheet(for: application.id, in: application.sheets)
            if let currentSheet {
                tableNav?.selectedSheetID = currentSheet.id
            }
            if currentSheet?.kind == .shortcuts {
                tableNav?.focusArea = .table
                _ = tableNav?.onMoveFocusToShortcuts?()
            } else if currentSheet?.kind == .keyValue {
                tableNav?.focusArea = .table
                tableNav?.selectedRowIndex = 0
                tableNav?.anchorRowIndex = 0
                tableNav?.selectedColumn = tableNav?.columnOrder.first ?? .key
                if let first = tableNav?.entries.first {
                    tableNav?.selectedEntryIDs = [first.id]
                }
            }
        }
    }

    private func followPendingJump() {
        guard let jump = contentNavigation.pendingJump,
              store.application(id: jump.applicationID) != nil else { return }
        searchText = ""
        selectedApplicationID = jump.applicationID
    }

    private func appActionsMenu(for application: ShortcutApplication) -> some View {
        let currentSheet = contentNavigation.selectedSheet(for: application.id, in: application.sheets)
        let isShortcutsSheet = (currentSheet?.kind ?? application.sheets.first?.kind ?? .shortcuts) == .shortcuts

        return Menu {
            if isShortcutsSheet {
                Button("匯入快捷鍵…") {
                    showingImportShortcuts = true
                }
                .accessibilityIdentifier("dashboard.import-shortcuts")
                Divider()
            }
            Button("新增快捷鍵工作表…") { requestSheet(.shortcuts, in: application) }
                .accessibilityIdentifier("dashboard.add-shortcuts-sheet")
            Button("新增 Key-Value 工作表…") { requestSheet(.keyValue, in: application) }
                .accessibilityIdentifier("dashboard.add-key-value-sheet")
            Divider()
            Button("編輯 App…") {
                appEditorRequest = .edit(application)
            }
            .accessibilityIdentifier("dashboard.edit-app")
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityIdentifier("dashboard.add-sheet")
    }

    private func deleteApplication(_ application: ShortcutApplication) {
        performStoreAction {
            try store.deleteApplication(id: application.id)
            selectedApplicationID = store.applications.first?.id
        }
    }

    private func requestSheet(_ kind: SheetKind, in application: ShortcutApplication) {
        editSession.requestLeave {
            sheetCreateApplicationID = application.id
            sheetCreateRequest = SheetCreateRequest(kind: kind)
        }
    }

    private func emptySheetState(for application: ShortcutApplication) -> some View {
        VStack(spacing: 10) {
            Label("尚無工作表", systemImage: "square.stack")
                .font(.headline)
            Text("建立工作表來整理這個 App 的參考內容。")
                .foregroundStyle(.secondary)
            HStack {
                Button("新增快捷鍵工作表") { requestSheet(.shortcuts, in: application) }
                    .accessibilityIdentifier("dashboard.empty-create-shortcuts-sheet")
                Button("新增 Key-Value 工作表") { requestSheet(.keyValue, in: application) }
                    .accessibilityIdentifier("dashboard.empty-create-key-value-sheet")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("dashboard.empty-sheets")
    }

    private func contentTabs(for application: ShortcutApplication) -> some View {
        let selectedID = contentNavigation.selectedSheet(for: application.id, in: application.sheets)?.id
        let isTabBarFocused = tableNav?.focusArea == .tabs
        return GeometryReader { geometry in
            let overflow = TabOverflowLayout(
                sheets: application.sheets,
                availableWidth: geometry.size.width > 0 ? geometry.size.width : nil,
                maxVisible: 4,
                selectedID: selectedID
            )
            HStack(spacing: 6) {
                ForEach(overflow.visibleSheets) { sheet in
                    sheetTab(
                        title: sheet.name,
                        systemImage: sheet.kind == .shortcuts ? "keyboard" : "list.bullet.rectangle",
                        isSelected: sheet.id == selectedID,
                        isKeyboardFocused: isTabBarFocused && sheet.id == selectedID,
                        identifier: "dashboard.sheet-tab.\(sheet.kind == .shortcuts ? "shortcuts" : "key-value").\(sheet.id)"
                    ) {
                        editSession.requestLeave {
                            NSApp.keyWindow?.makeFirstResponder(nil)
                            tableNav?.focusArea = .tabs
                            contentNavigation.selectSheet(sheet, for: application.id)
                            tableNav?.selectSheet(id: sheet.id)
                            sheetSearchText = ""
                            sheetSearchState = .inactive
                            searchResultsFocused = false
                        }
                    }
                }
                if !overflow.overflowSheets.isEmpty {
                    Menu("") {
                        ForEach(overflow.overflowSheets) { sheet in
                            Button {
                                editSession.requestLeave {
                                    NSApp.keyWindow?.makeFirstResponder(nil)
                                    tableNav?.focusArea = .tabs
                                    contentNavigation.selectSheet(sheet, for: application.id)
                                    tableNav?.selectSheet(id: sheet.id)
                                    sheetSearchText = ""
                                    sheetSearchState = .inactive
                                    searchResultsFocused = false
                                }
                            } label: {
                                Label(
                                    sheet.name,
                                    systemImage: sheet.kind == .shortcuts ? "keyboard" : "list.bullet.rectangle"
                                )
                            }
                            .accessibilityIdentifier("dashboard.overflow-sheet.\(sheet.id)")
                        }
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                    .accessibilityIdentifier("dashboard.tab-overflow-menu")
                    .background(
                        ViewAnchor {
                            $0.setAccessibilityElement(false)
                            $0.setAccessibilityIdentifier("dashboard.tab-overflow-menu")
                        }
                        .accessibilityHidden(true)
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .frame(height: 36)
    }

    private func configureTableNavCallbacks(_ nav: TableKeyboardNavigation) {
        nav.onFocusSearch = {
            sheetSearchState = .focusedEditing
        }
        nav.onMoveFocusToSearch = { [weak nav] in
            guard let app = selectedApplication, !app.sheets.isEmpty else { return false }
            let trimmed = sheetSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return false }
            sheetSearchState = .focusedNonEditing
            nav?.focusArea = .table
            return true
        }
        nav.onCopyResult = { success, fieldName in
            if success {
                successMessage = "\(fieldName) 已複製。"
            } else {
                errorMessage = "無法複製 \(fieldName) 到剪貼簿。"
                successMessage = nil
            }
        }
    }

    private func updateTableNav(for appID: String) {
        let nav = TableKeyboardNavigation(
            store: store,
            applicationID: appID,
            editSession: editSession,
            clipboardWriter: clipboardWriter
        )
        configureTableNavCallbacks(nav)
        if let current = contentNavigation.selectedSheet(for: appID, in: store.application(id: appID)?.sheets ?? []) {
            nav.selectedSheetID = current.id
        }
        tableNav = nav
    }

    private func syncSidebarFocus(for area: TableKeyboardNavigation.FocusArea?) {
        DispatchQueue.main.async {
            guard let window = NSApp.keyWindow ?? NSApp.windows.first(where: { $0.isKeyWindow || $0.isVisible }),
                  let content = window.contentView else { return }
            if area == .sidebar {
                if let table = Self.firstTableView(in: content) {
                    if window.firstResponder !== table {
                        window.makeFirstResponder(table)
                    }
                }
            } else {
                if let table = Self.firstTableView(in: content), window.firstResponder === table {
                    window.makeFirstResponder(nil)
                }
            }
        }
    }

    private static func firstTableView(in view: NSView) -> NSTableView? {
        if let table = view as? NSTableView { return table }
        for sub in view.subviews {
            if let found = firstTableView(in: sub) { return found }
        }
        return nil
    }

    private func sheetTab(
        title: String,
        systemImage: String,
        isSelected: Bool,
        isKeyboardFocused: Bool = false,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        SheetTabButton(
            title: title,
            systemImage: systemImage,
            isSelected: isSelected,
            isKeyboardFocused: isKeyboardFocused,
            identifier: identifier,
            action: action
        )
    }

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("設定")
                .font(.title3.weight(.semibold))

            VStack(alignment: .leading, spacing: 6) {
                Text("全域快捷鍵")
                    .font(.headline)
                Text("點擊下方區域後按下組合鍵")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HotKeyRecorder(configuration: store.hotKey) { configuration in
                    performStoreAction {
                        try onHotKeyChanged(configuration)
                    }
                }
                .frame(width: 200, height: 34)
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("備份")
                    .font(.headline)
                HStack {
                    Button("備份至檔案…") {
                        showingSettings = false
                        chooseBackupLocation()
                    }
                    Button("從備份還原…") {
                        showingSettings = false
                        chooseBackupToRestore()
                    }
                }
            }
        }
        .padding(16)
        .frame(width: 260)
    }

    private func chooseBackupLocation() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "DashCues-Backup.json"
        panel.canCreateDirectories = true
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            performStoreAction {
                try store.exportBackup(to: url)
                successMessage = "備份已儲存。"
            }
        }
    }

    private func chooseBackupToRestore() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let alert = NSAlert()
            alert.messageText = "還原 DashCues 備份？"
            alert.informativeText = "目前的快捷鍵資料將被備份內容取代。此操作無法自動復原。"
            alert.alertStyle = .warning
            alert.addButton(withTitle: "還原")
            alert.addButton(withTitle: "取消")
            guard alert.runModal() == .alertFirstButtonReturn else { return }
            performStoreAction {
                let previousHotKey = store.hotKey
                try store.restoreBackup(from: url)
                do {
                    try onHotKeyChanged(store.hotKey)
                } catch {
                    try store.updateHotKey(previousHotKey)
                    throw error
                }
                selectedApplicationID = store.applications.first?.id
                successMessage = "備份已還原。"
            }
        }
    }

    private func performStoreAction(_ action: () throws -> Void) {
        do {
            try action()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ApplicationRowView: View {
    let application: ShortcutApplication
    let onTogglePin: () -> Void
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 8) {
            ApplicationIconView(application: application, size: 18)
            Text(application.name)
                .lineLimit(1)
            Spacer()
            Button(action: onTogglePin) {
                Image(systemName: application.isPinned ? "pin.fill" : "pin")
                    .font(.caption)
                    .foregroundStyle(application.isPinned ? Color.accentColor : Color.secondary)
                    .opacity(application.isPinned ? 1.0 : (isHovering ? 0.5 : 0.0))
            }
            .buttonStyle(.plain)
            .help(application.isPinned ? "取消釘選" : "釘選此 App")
            .accessibilityIdentifier("dashboard.app-pin-button.\(application.id)")
        }
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
    }
}

private struct SheetTabButton: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    var isKeyboardFocused: Bool = false
    let identifier: String
    let action: () -> Void

    @State private var isHovering = false

    private var backgroundColor: Color {
        if isKeyboardFocused {
            return Color.accentColor
        } else if isSelected {
            return Color(nsColor: .unemphasizedSelectedContentBackgroundColor)
        } else if isHovering {
            return Color.primary.opacity(0.06)
        } else {
            return Color.clear
        }
    }

    private var foregroundColor: Color {
        if isKeyboardFocused {
            return Color.white
        } else if isSelected {
            return Color.primary
        } else if isHovering {
            return Color.primary
        } else {
            return Color.secondary
        }
    }

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .lineLimit(1)
                .font(.system(size: 13, weight: isSelected ? .medium : .regular))
                .foregroundStyle(foregroundColor)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    backgroundColor,
                    in: RoundedRectangle(cornerRadius: 6)
                )
                .contentShape(Rectangle())
                .onHover { isHovering = $0 }
                .overlay {
                    if isKeyboardFocused {
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color.clear, lineWidth: 0)
                            .accessibilityElement()
                            .accessibilityLabel(title)
                            .accessibilityIdentifier("dashboard.tab-focused")
                            .background(
                                ViewAnchor {
                                    $0.setAccessibilityElement(false)
                                    $0.setAccessibilityIdentifier("dashboard.tab-focused")
                                }
                                .accessibilityHidden(true)
                            )
                    }
                }
        }
        .buttonStyle(.plain)
        .fixedSize(horizontal: true, vertical: false)
        .accessibilityIdentifier(identifier)
        .accessibilityValue(isSelected ? "已選取" : "未選取")
        .background(
            ViewAnchor {
                $0.setAccessibilityElement(false)
                $0.setAccessibilityIdentifier(identifier)
            }
            .accessibilityHidden(true)
        )
    }
}
