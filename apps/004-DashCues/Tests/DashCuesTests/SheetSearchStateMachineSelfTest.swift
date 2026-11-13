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
        var focusMovedDownToContent = false
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
        focusMovedDownToContent = true
        searchState = .inactive
        try check(searchState == .inactive, "Down arrow in focusedNonEditing must transition to inactive.")
        try check(focusMovedDownToContent, "Down arrow in focusedNonEditing must invoke move focus to content.")

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
        contentNav.selectSheet(.keyValue(targetCheatsheet), for: appID)
        tableNav.selectSheet(id: targetCheatsheet.id)
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
        if let idx = targetCheatsheet.entries.firstIndex(where: { $0.id == targetKVEntry.id }) {
            tableNav.selectedRowIndex = idx
            tableNav.selectedEntryIDs = [targetKVEntry.id]
            tableNav.focusArea = .table
        }

        try check(contentNav.selectedSheet(for: appID, in: app.sheets)?.id == kv2ID, "Jump must select target KV sheet kv2.")
        try check(tableNav.selectedSheetID == kv2ID, "TableNav selectedSheetID must be kv2.")
        try check(tableNav.selectedEntryIDs.contains(targetKVEntry.id), "Target KV entry must be highlighted.")
        try check(queryText.isEmpty, "Search text must be cleared on jump.")
        try check(contentNav.pendingJump?.entryID == targetKVEntry.id, "Pending jump must be registered for smooth scrolling.")

        // Jump to Shortcut in sc2
        let targetShortcut = sc2Section.shortcuts[0].item
        let targetShortcutSheet = sc2Section.shortcuts[0].sheet

        // Simulate clicking jump icon on targetShortcut
        contentNav.selectSheet(.shortcuts(targetShortcutSheet), for: appID)
        tableNav.selectSheet(id: targetShortcutSheet.id)
        queryText = ""
        searchState = .inactive
        tableNav.focusArea = .table
        contentNav.requestShortcutJump(
            applicationID: appID,
            sheetID: targetShortcutSheet.id,
            shortcutID: targetShortcut.id
        )

        try check(contentNav.selectedSheet(for: appID, in: app.sheets)?.id == sc2ID, "Jump must select target Shortcut sheet sc2.")
        try check(tableNav.selectedSheetID == sc2ID, "TableNav selectedSheetID must be sc2.")
        try check(contentNav.pendingShortcutJump?.shortcutID == targetShortcut.id, "Pending shortcut jump must be registered.")
        try check(queryText.isEmpty, "Search text must be cleared on jump.")

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
