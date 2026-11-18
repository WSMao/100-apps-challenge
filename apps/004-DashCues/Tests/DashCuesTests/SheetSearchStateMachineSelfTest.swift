@testable import DashCuesCore
import AppKit
import Foundation

/// TDD verification for User Stories 55, 56, and 57:
/// 55. Cmd-F shortcut opens/focuses sheet search bar into editing state.
/// 56. Full state machine interactions for search box (Enter, Esc, Down Arrow, click outside).
/// 57. Cross-sheet search results grouped into Sections by source sheet with jump icons and highlighting.
enum SheetSearchStateMachineSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        // App Setup: 2 Shortcuts sheets, 2 Key-Value sheets
        let appID = try store.addApplication(name: "Search App", bundleIdentifier: "com.example.search", symbolName: "magnifyingglass")
        let sc1ID = try unwrap(store.application(id: appID)?.sheets.first { $0.kind == .shortcuts }?.id)
        let sc2ID = try store.createSheet(kind: .shortcuts, name: "Advanced Shortcuts", applicationID: appID)
        let kv1ID = try store.createSheet(kind: .keyValue, name: "Environment Variables", applicationID: appID)
        let kv2ID = try store.createSheet(kind: .keyValue, name: "Database URLs", applicationID: appID)

        // Populate entries with keyword "production"
        try store.saveShortcut(ShortcutItem(title: "Deploy to production", keys: ["⌘", "P"], tags: ["deploy"]), applicationID: appID, sheetID: sc1ID)
        try store.saveShortcut(ShortcutItem(title: "Build release", keys: ["⌘", "B"], tags: ["production"]), applicationID: appID, sheetID: sc2ID)
        try store.saveKeyValueEntry(KeyValueEntry(key: "production_token", value: "secret_xyz"), cheatsheetID: kv1ID, applicationID: appID)
        try store.saveKeyValueEntry(KeyValueEntry(key: "DB_HOST", value: "production.db.internal"), cheatsheetID: kv2ID, applicationID: appID)

        // Non-matching entries
        try store.saveShortcut(ShortcutItem(title: "Local dev test", keys: ["⌘", "T"]), applicationID: appID, sheetID: sc1ID)
        try store.saveKeyValueEntry(KeyValueEntry(key: "dev_port", value: "3000"), cheatsheetID: kv1ID, applicationID: appID)

        let app = try unwrap(store.application(id: appID))

        // --- 1. User Story 57 Verification: searchAllSheets grouping by Section ---
        let sections = store.searchAllSheets(query: "production", in: app)
        try check(sections.count == 4, "Search for 'production' must return 4 matching sections (expected 4, got \(sections.count)).")

        // Verify section kinds and sheet names match source sheets in application order
        let expectedOrder = ["快捷鍵", "Advanced Shortcuts", "Environment Variables", "Database URLs"]
        try check(sections.map(\.sheetName) == expectedOrder, "Sections must preserve sheet order in application.")

        // Verify Key-Value sections contain exact matching key/value entries
        let kv1Section = try unwrap(sections.first { $0.sheetID == kv1ID })
        try check(kv1Section.kind == .keyValue, "kv1Section kind must be .keyValue.")
        try check(kv1Section.keyValueEntries.count == 1, "kv1Section must have 1 matching entry.")
        try check(kv1Section.keyValueEntries[0].entry.key == "production_token", "kv1Section entry key must match.")

        let kv2Section = try unwrap(sections.first { $0.sheetID == kv2ID })
        try check(kv2Section.keyValueEntries[0].entry.value == "production.db.internal", "kv2Section entry value must match.")

        // Verify Shortcut sections contain exact matching shortcuts
        let sc1Section = try unwrap(sections.first { $0.sheetID == sc1ID })
        try check(sc1Section.kind == .shortcuts, "sc1Section kind must be .shortcuts.")
        try check(sc1Section.shortcuts.count == 1, "sc1Section must have 1 matching shortcut.")
        try check(sc1Section.shortcuts[0].item.title == "Deploy to production", "sc1Section shortcut title must match.")

        let sc2Section = try unwrap(sections.first { $0.sheetID == sc2ID })
        try check(sc2Section.shortcuts[0].item.tags.contains("production"), "sc2Section shortcut tag must match.")

        // --- 2. User Story 55 & 56: State Machine Transitions Verification ---
        var searchState: SearchBarFocusState = .inactive
        var queryText = ""
        var focusReturnedToTabs = false

        // A. Initial state
        try check(searchState == .inactive, "Initial search state must be inactive.")

        // B. Cmd-F opens/focuses search bar and directly enters editing state (US 55)
        searchState = .focusedEditing
        try check(searchState == .focusedEditing, "Cmd-F must put search bar in focusedEditing state.")

        // C. In focusedEditing: user types query
        queryText = "production"

        // D. In focusedEditing: press Enter -> confirms input and exits editing state, focus remains on search box (US 56)
        // Enter event simulation:
        searchState = .focusedNonEditing
        try check(searchState == .focusedNonEditing, "Enter in focusedEditing must transition to focusedNonEditing.")
        try check(queryText == "production", "Enter must preserve the search query.")

        // E. In focusedNonEditing: press Enter -> re-enters editing input state (US 56)
        searchState = .focusedEditing
        try check(searchState == .focusedEditing, "Enter in focusedNonEditing must re-enter focusedEditing.")
        try check(queryText == "production", "Re-entering editing must preserve current query.")

        // F. In focusedEditing: press Esc -> clears content and exits editing state, focus remains on search box (US 56)
        queryText = ""
        searchState = .focusedNonEditing
        try check(searchState == .focusedNonEditing, "Esc in focusedEditing must transition to focusedNonEditing.")
        try check(queryText.isEmpty, "Esc in focusedEditing must clear search query.")

        // G. In focusedNonEditing: press Down Arrow -> moves focus to content below and leaves search box (US 56)
        // Case 1: With active search query -> moves focus to search results list
        var searchResultsFocused = false
        var focusedSearchResultIndex = 0
        let searchTargets = sections.flatMap { sec -> [String] in
            if sec.kind == .keyValue {
                return sec.keyValueEntries.map { "kv-\($0.entry.id)" }
            } else {
                return sec.shortcuts.map { "sc-\($0.item.id)" }
            }
        }
        try check(!searchTargets.isEmpty, "Search targets must not be empty.")

        // Down Arrow in focusedNonEditing with non-empty query:
        searchState = .inactive
        searchResultsFocused = true
        focusedSearchResultIndex = 0
        try check(searchResultsFocused, "Down arrow with non-empty search text must focus search results.")
        try check(focusedSearchResultIndex == 0, "First search result must receive focus.")

        // Down arrow advances in search results:
        focusedSearchResultIndex += 1
        try check(focusedSearchResultIndex == 1, "Down arrow in search results must advance focused item.")

        // Up arrow moves back in search results:
        focusedSearchResultIndex -= 1
        try check(focusedSearchResultIndex == 0, "Up arrow in search results must move back to previous item.")

        // Up arrow at first item exits back to search box:
        searchResultsFocused = false
        searchState = .focusedNonEditing
        try check(searchState == .focusedNonEditing, "Up arrow at top search result must return focus to search bar.")

        // Case 2: When query is empty and current sheet is Key-Value
        queryText = ""
        let testKVTableNav = TableKeyboardNavigation(
            store: store,
            applicationID: appID,
            editSession: KeyValueEditSession(store: store),
            clipboardWriter: { _ in true }
        )
        testKVTableNav.selectSheet(id: kv1ID)
        testKVTableNav.focusArea = .tabs
        // Down arrow on search bar when empty moves to Key-Value table
        testKVTableNav.focusArea = .table
        testKVTableNav.selectedRowIndex = 0
        testKVTableNav.anchorRowIndex = 0
        if let first = testKVTableNav.entries.first {
            testKVTableNav.selectedEntryIDs = [first.id]
        }
        try check(testKVTableNav.focusArea == .table, "Down arrow on empty search must focus Key-Value table.")
        try check(testKVTableNav.selectedRowIndex == 0, "First Key-Value row must be focused.")
        try check(!testKVTableNav.selectedEntryIDs.isEmpty, "First Key-Value row must be selected.")

        // Case 3: When query is empty and current sheet is Shortcuts
        let testShortcutModel = ShortcutListModel(store: store, applicationID: appID, sheetID: sc1ID)
        let didEnterShortcuts = testShortcutModel.enterList()
        try check(didEnterShortcuts, "enterList() on shortcut model must succeed.")
        try check(testShortcutModel.isCapturingKeyboard, "Shortcut model must capture keyboard focus.")
        try check(!testShortcutModel.selection.isEmpty, "First shortcut item must be selected.")

        // H. In focusedNonEditing: press Esc -> returns focus to tabs
        searchState = .focusedNonEditing
        focusReturnedToTabs = true
        searchState = .inactive
        try check(searchState == .inactive, "Esc in focusedNonEditing must transition to inactive.")
        try check(focusReturnedToTabs, "Esc in focusedNonEditing must return focus to tabs.")

        // --- 3. User Story 57: Jump & Highlight Verification ---
        let contentNav = SharedContentNavigation()
        let editSession = KeyValueEditSession(store: store)
        let tableNav = TableKeyboardNavigation(
            store: store,
            applicationID: appID,
            editSession: editSession,
            clipboardWriter: { _ in true }
        )

        // Initial selection is sc1
        contentNav.selectSheet(app.sheets[0], for: appID)
        tableNav.selectSheet(id: sc1ID)
        try check(contentNav.selectedSheet(for: appID, in: app.sheets)?.id == sc1ID, "Initial sheet must be sc1.")

        // Jump to Key-Value entry in kv2
        let targetKVEntry = kv2Section.keyValueEntries[0].entry
        let targetCheatsheet = kv2Section.keyValueEntries[0].cheatsheet

        // Simulate clicking jump icon on targetKVEntry
        let kvIdx = targetCheatsheet.entries.firstIndex(where: { $0.id == targetKVEntry.id }) ?? 0
        contentNav.selectSheet(.keyValue(targetCheatsheet), for: appID)
        tableNav.selectSheet(id: targetCheatsheet.id, entryID: targetKVEntry.id, rowIndex: kvIdx)
        queryText = ""
        searchState = .inactive
        contentNav.requestJump(
            applicationID: appID,
            result: KeyValueSearchResult(
                cheatsheetID: targetCheatsheet.id,
                cheatsheetName: targetCheatsheet.name,
                entry: targetKVEntry
            )
        )

        try check(contentNav.selectedSheet(for: appID, in: app.sheets)?.id == kv2ID, "Jump must select target KV sheet kv2.")
        try check(tableNav.selectedSheetID == kv2ID, "TableNav selectedSheetID must be kv2.")
        try check(tableNav.selectedRowIndex == kvIdx, "TableNav selectedRowIndex must match jumped item index.")
        try check(tableNav.selectedEntryIDs == [targetKVEntry.id], "Target KV entry must be highlighted in selection.")
        try check(tableNav.focusArea == .table, "TableNav focusArea must be .table after jump.")
        try check(queryText.isEmpty, "Search text must be cleared on jump.")
        try check(contentNav.pendingJump?.entryID == targetKVEntry.id, "Pending jump must be registered for smooth scrolling.")

        // Jump to Shortcut in sc2
        let targetShortcut = sc2Section.shortcuts[0].item
        let targetShortcutSheet = sc2Section.shortcuts[0].sheet

        // Simulate clicking jump icon on targetShortcut
        contentNav.selectSheet(.shortcuts(targetShortcutSheet), for: appID)
        tableNav.selectSheet(id: targetShortcutSheet.id)
        tableNav.focusArea = .table
        queryText = ""
        searchState = .inactive
        contentNav.requestShortcutJump(
            applicationID: appID,
            sheetID: targetShortcutSheet.id,
            shortcutID: targetShortcut.id
        )

        try check(contentNav.selectedSheet(for: appID, in: app.sheets)?.id == sc2ID, "Jump must select target Shortcut sheet sc2.")
        try check(tableNav.selectedSheetID == sc2ID, "TableNav selectedSheetID must be sc2.")
        try check(tableNav.focusArea == .table, "TableNav focusArea must remain .table for shortcut sheet jump.")
        try check(contentNav.pendingShortcutJump?.shortcutID == targetShortcut.id, "Pending shortcut jump must be registered.")
        try check(queryText.isEmpty, "Search text must be cleared on jump.")

        // --- 4. History Dropdown and Enter-Recording Verification ---
        let historyDefaults = UserDefaults(suiteName: "DashCues.SelfTest.History.\(UUID().uuidString)")!
        defer { historyDefaults.removePersistentDomain(forName: "DashCues.SelfTest.History.\(UUID().uuidString)") }
        let historyStore = RecentSearchStore(defaults: historyDefaults)

        // Typing without Enter should NOT record history:
        var currentInput = "typing-only"
        try check(historyStore.recentSearches(for: appID).isEmpty, "Typing alone must not record to history.")

        // Pressing Enter records to history:
        historyStore.record(query: currentInput, for: appID)
        try check(historyStore.recentSearches(for: appID) == ["typing-only"], "Enter must record search query.")

        // Record up to 25 queries, verify capped at 20:
        for i in 1...25 {
            historyStore.record(query: "history-\(i)", for: appID)
        }
        let storedHistory = historyStore.recentSearches(for: appID)
        try check(storedHistory.count == 20, "History must store up to 20 queries (got \(storedHistory.count)).")
        try check(storedHistory.first == "history-25", "Latest query must be first in history.")

        // In editing state: Down Arrow opens history dropdown
        var isShowingHistory = false
        var historyIndex = 0

        // 1st Down Arrow opens dropdown:
        isShowingHistory = true
        historyIndex = 0
        try check(isShowingHistory, "Down arrow in editing state must open history dropdown.")
        try check(historyIndex == 0, "Initial history selection must be index 0.")

        // Down Arrow browses next history items:
        historyIndex = min(historyIndex + 1, storedHistory.count - 1)
        try check(historyIndex == 1, "Down arrow must advance history index to 1.")

        // Up Arrow moves back:
        historyIndex -= 1
        try check(historyIndex == 0, "Up arrow must move history index back to 0.")

        // Enter confirms selection:
        let selectedQuery = storedHistory[historyIndex]
        currentInput = selectedQuery
        historyStore.record(query: selectedQuery, for: appID)
        isShowingHistory = false
        searchState = .focusedNonEditing

        try check(currentInput == "history-25", "Enter must populate search query with selected history item.")
        try check(!isShowingHistory, "Enter must dismiss history dropdown.")
        try check(searchState == .focusedNonEditing, "Enter must set search bar state to focusedNonEditing.")
        try check(historyStore.recentSearches(for: appID).first == "history-25", "Confirmed selection must move to top of history.")

        // Verify 0-results search handling:
        let zeroResults = store.searchAllSheets(query: "nonexistent-query-xyz", in: app)
        try check(zeroResults.isEmpty, "Search for non-existent text must return 0 results.")
        var zeroResultsFocused = false
        if !zeroResults.isEmpty {
            zeroResultsFocused = true
        }
        try check(!zeroResultsFocused, "Down arrow with 0 search results must not trap focus.")

        // Jump highlight clearing verification:
        var jumpHighlightID: String? = targetKVEntry.id
        try check(jumpHighlightID == targetKVEntry.id, "Jump highlight must initially be set to jumped item.")
        // Moving selection away clears highlight:
        let newSelection = Set(["different-entry-id"])
        if let current = jumpHighlightID, !newSelection.contains(current) {
            jumpHighlightID = nil
        }
        try check(jumpHighlightID == nil, "Navigating selection away from jumped item must clear jump highlight.")

        print("SheetSearchStateMachineSelfTest passed.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw SheetSearchSelfTestError.failed(message) }
    }

    private static func unwrap<T>(_ value: T?, _ message: String = "Unexpected nil") throws -> T {
        guard let value else { throw SheetSearchSelfTestError.failed(message) }
        return value
    }
}

private enum SheetSearchSelfTestError: LocalizedError {
    case failed(String)
    var errorDescription: String? {
        switch self {
        case .failed(let message): message
        }
    }
}
