@testable import DashCuesCore
import AppKit
import Foundation

/// TDD verification for sheet tab overflow and keyboard navigation through tabs and Key-Value table.
enum TableNavigationSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        let appID = try store.addApplication(name: "Nav App", bundleIdentifier: "com.example.nav", symbolName: "app")
        // Create 10 sheets to test 1–9 selection and overflow
        var sheetIDs: [String] = []
        for i in 1...10 {
            let id = try store.createSheet(kind: .keyValue, name: "Sheet \(i)", applicationID: appID)
            sheetIDs.append(id)
        }
        guard let app = store.application(id: appID) else {
            throw TableNavigationSelfTestError.failed("App not found")
        }

        // Test 1: Overflow calculation
        let overflow = TabOverflowLayout(sheets: app.sheets, maxVisible: 4, selectedID: sheetIDs[0])
        try check(overflow.visibleSheets.count == 4, "Visible sheets count must be 4.")
        try check(overflow.overflowSheets.count == 7, "Overflow sheets count must be 7 (1 default + 10 created = 11 total sheets - 4 visible).")
        try check(overflow.visibleSheets.contains { $0.id == sheetIDs[0] }, "Selected sheet must be in visible sheets.")

        // Select a hidden sheet (e.g. sheet 8): it must become visible without altering full sheet order
        let overflowWithHidden = TabOverflowLayout(sheets: app.sheets, maxVisible: 4, selectedID: sheetIDs[7])
        try check(overflowWithHidden.visibleSheets.contains { $0.id == sheetIDs[7] }, "Hidden selected sheet must become visible.")
        try check(
            overflowWithHidden.overflowSheets.map(\.id) == app.sheets.filter { s in !overflowWithHidden.visibleSheets.contains { $0.id == s.id } }.map(\.id),
            "Overflow sheets must retain their original order."
        )
        try check(
            overflowWithHidden.visibleSheets.count + overflowWithHidden.overflowSheets.count == app.sheets.count,
            "Total sheet count must be preserved."
        )

        // Test 1b: Width-adaptive overflow calculation (narrow vs wide container width)
        let narrowOverflow = TabOverflowLayout(
            sheets: Array(app.sheets.prefix(4)),
            availableWidth: 190,
            maxVisible: 4,
            selectedID: sheetIDs[2] // 4th sheet overall (index 3)
        )
        try check(
            narrowOverflow.visibleSheets.count < 4 && !narrowOverflow.overflowSheets.isEmpty,
            "When 4 sheets do not fit within availableWidth (190pt), hidden tabs must move to overflowSheets."
        )
        try check(
            narrowOverflow.visibleSheets.contains { $0.id == sheetIDs[2] },
            "Selected hidden sheet must become visible even in a narrow container."
        )
        try check(
            narrowOverflow.overflowSheets.map(\.id) == Array(app.sheets.prefix(4)).filter { s in
                !narrowOverflow.visibleSheets.contains { $0.id == s.id }
            }.map(\.id),
            "Width-based overflow sheets must preserve original sheet order."
        )

        // Setup TableKeyboardNavigation controller
        let e1 = KeyValueEntry(id: "e1", key: "Short", value: "A very long text that can be truncated")
        let e2 = KeyValueEntry(id: "e2", key: "Key2", value: "Val2")
        try store.saveKeyValueEntry(e1, cheatsheetID: sheetIDs[0], applicationID: appID)
        try store.saveKeyValueEntry(e2, cheatsheetID: sheetIDs[0], applicationID: appID)

        let session = KeyValueEditSession(store: store)
        var copiedText: String?
        let clipboard: (String) -> Bool = { text in
            copiedText = text
            return true
        }

        let nav = TableKeyboardNavigation(
            store: store,
            applicationID: appID,
            editSession: session,
            clipboardWriter: clipboard
        )

        // Initial focus: sidebar
        try check(nav.focusArea == .sidebar, "Initial focus must be sidebar.")

        // 1–9 digit selection in navigation mode
        try check(nav.handleNumberKey(1), "Number 1 should be handled in navigation mode.")
        try check(nav.selectedSheetID == app.sheets[0].id, "Number 1 did not select sheet 0.")
        try check(nav.handleNumberKey(5), "Number 5 should be handled in navigation mode.")
        try check(nav.selectedSheetID == app.sheets[4].id, "Number 5 did not select sheet 4.")

        // Digits ignored in text editing
        nav.isTextEditing = true
        try check(!nav.handleNumberKey(2), "Digits must NOT be intercepted when text editing.")
        nav.isTextEditing = false

        // Arrow navigation: Sidebar -> Tabs -> Table
        nav.focusArea = .sidebar
        try check(nav.handleRightArrow(), "Right arrow from sidebar should move focus to tabs.")
        try check(nav.focusArea == .tabs, "Focus did not move to tabs.")

        // Left / Right in tabs
        let tabIndex = nav.selectedTabIndex
        try check(nav.handleRightArrow(), "Right arrow in tabs should advance tab.")
        try check(nav.selectedTabIndex == tabIndex + 1, "Tab index did not advance.")
        try check(nav.handleLeftArrow(), "Left arrow in tabs should go to previous tab.")
        try check(nav.selectedTabIndex == tabIndex, "Tab index did not go back.")

        // Down arrow from tab enters table
        nav.selectSheet(id: sheetIDs[0])
        try check(nav.handleDownArrow(), "Down arrow from tab should enter table.")
        try check(nav.focusArea == .table, "Focus did not move to table.")
        try check(nav.selectedRowIndex == 0, "First row should be selected.")
        try check(nav.selectedColumn == .key, "First column should be selected.")

        // Down on empty sheet retains tab focus, and switching from table focus to an empty/shortcuts sheet resets focus to tabs
        let emptySheetID = sheetIDs[9]
        nav.selectSheet(id: emptySheetID)
        try check(nav.focusArea == .tabs, "Selecting an empty sheet while in table focus must reset focusArea to tabs.")
        try check(!nav.handleDownArrow(), "Down arrow on empty sheet should not enter table.")
        try check(nav.focusArea == .tabs, "Tab focus should be retained when sheet is empty.")

        // Table row navigation & column retention
        nav.selectSheet(id: sheetIDs[0])
        nav.focusArea = .table
        nav.selectedRowIndex = 0
        nav.selectedColumn = .value
        try check(nav.handleDownArrow(), "Down arrow should move to next row.")
        try check(nav.selectedRowIndex == 1 && nav.selectedColumn == .value, "Down arrow did not retain column.")
        try check(nav.handleUpArrow(), "Up arrow should move to previous row.")
        try check(nav.selectedRowIndex == 0 && nav.selectedColumn == .value, "Up arrow did not move up.")

        // Up arrow from row 0 returns to tabs
        try check(nav.handleUpArrow(), "Up arrow from row 0 should return to tabs.")
        try check(nav.focusArea == .tabs, "Focus did not return to tabs.")

        // Column cycling with Tab / Shift-Tab
        nav.focusArea = .table
        nav.selectedColumn = .key
        try check(nav.handleTab(shift: false, control: false), "Tab should cycle column.")
        try check(nav.selectedColumn == .value, "Tab did not cycle to value.")
        try check(nav.handleTab(shift: true, control: false), "Shift-Tab should cycle column back.")
        try check(nav.selectedColumn == .key, "Shift-Tab did not cycle to key.")

        // Ctrl-Tab leaves table
        try check(nav.handleTab(shift: false, control: true), "Ctrl-Tab should leave table.")
        try check(nav.focusArea == .tabs, "Ctrl-Tab did not leave table.")

        // Navigation mode Cmd-C copies selected field
        nav.focusArea = .table
        nav.selectedRowIndex = 0
        nav.selectedColumn = .key
        try check(nav.handleCopy(), "Cmd-C should copy selected field in table navigation.")
        try check(copiedText == "Short", "Cmd-C did not copy key.")

        nav.selectedColumn = .value
        try check(nav.handleCopy(), "Cmd-C should copy value.")
        try check(copiedText == "A very long text that can be truncated", "Cmd-C did not copy value.")

        // Enter begins editing
        try check(nav.handleEnter(), "Enter should begin editing selected cell.")
        try check(session.isEditing && session.editingEntryID == "e1" && session.focusColumn == .value, "Enter did not begin edit session.")
        try check(nav.isFieldEditorFocused, "Active edit session must mark field editor as focused to prevent navigation key hijacking.")
        session.cancel()
        try check(!nav.isFieldEditorFocused, "Cancelling edit session should clear field editor focus state.")

        // Truncation expansion with Right Arrow, collapse with Left Arrow, return to sidebar when collapsed
        nav.expandedRowIDs.removeAll()
        try check(nav.handleRightArrow(), "Right arrow on table row should expand.")
        try check(nav.expandedRowIDs.contains("e1"), "Row was not expanded.")
        try check(nav.handleLeftArrow(), "Left arrow should collapse.")
        try check(!nav.expandedRowIDs.contains("e1"), "Row was not collapsed.")
        try check(nav.handleLeftArrow(), "Left arrow on collapsed row should return to sidebar.")
        try check(nav.focusArea == .sidebar, "Focus did not return to sidebar.")

        // Non-truncated row (e2: "Key2" / "Val2"): Right arrow does not expand it, and Left arrow returns directly to sidebar
        nav.focusArea = .table
        nav.selectedRowIndex = 1
        _ = nav.handleRightArrow()
        try check(!nav.expandedRowIDs.contains("e2"), "Right arrow must not expand a non-truncated row.")
        try check(nav.handleLeftArrow(), "Left arrow on non-truncated row should be handled.")
        try check(nav.focusArea == .sidebar, "Left arrow from a non-truncated row must return directly to sidebar.")

        // Multi-selection and batch deletion test
        let e3 = KeyValueEntry(id: "e3", key: "Key3", value: "Val3")
        try store.saveKeyValueEntry(e3, cheatsheetID: sheetIDs[0], applicationID: appID)

        nav.selectSheet(id: sheetIDs[0])
        nav.focusArea = .table
        nav.selectedRowIndex = 0
        try check(nav.handleDownArrow(extend: false), "Down arrow should move to row 1.")
        try check(nav.selectedEntryIDs == ["e2"], "Down arrow without shift should select single row.")

        try check(nav.handleDownArrow(extend: true), "Shift-Down arrow should extend selection to row 2.")
        try check(nav.selectedEntryIDs == ["e2", "e3"], "Shift-Down arrow must multi-select rows e2 and e3.")

        try check(nav.handleUpArrow(extend: true), "Shift-Up arrow should adjust range selection.")
        try check(nav.selectedEntryIDs == ["e2"], "Shift-Up arrow should contract range back to anchor.")

        // Test delete request callback on Delete key
        var deleteRequested = false
        nav.onDeleteRequested = { deleteRequested = true }
        let deleteEvent = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "\u{7f}",
            charactersIgnoringModifiers: "\u{7f}",
            isARepeat: false,
            keyCode: 51
        )
        if let deleteEvent {
            try check(nav.consumes(keyDown: deleteEvent), "Delete key should be consumed when table rows are selected.")
            try check(deleteRequested, "onDeleteRequested should be called when Delete key is pressed with selection.")
        }

        // Test store batch delete
        try store.deleteKeyValueEntries(ids: ["e2", "e3"], cheatsheetID: sheetIDs[0], applicationID: appID)
        let remainingEntries = store.application(id: appID)?.keyValueCheatsheets.first(where: { $0.id == sheetIDs[0] })?.entries ?? []
        try check(remainingEntries.count == 1 && remainingEntries[0].id == "e1", "Batch delete failed to remove all selected entries.")

        // Test move with DropInsertionEdge
        let itemA = KeyValueEntry(id: "mA", key: "A", value: "1")
        let itemB = KeyValueEntry(id: "mB", key: "B", value: "2")
        let itemC = KeyValueEntry(id: "mC", key: "C", value: "3")
        try store.saveKeyValueEntry(itemA, cheatsheetID: sheetIDs[1], applicationID: appID)
        try store.saveKeyValueEntry(itemB, cheatsheetID: sheetIDs[1], applicationID: appID)
        try store.saveKeyValueEntry(itemC, cheatsheetID: sheetIDs[1], applicationID: appID)

        // Move itemA (0) to below itemB (1) with edge .bottom -> destination 2
        try store.moveKeyValueEntries(fromOffsets: IndexSet(integer: 0), toOffset: 2, cheatsheetID: sheetIDs[1], applicationID: appID)
        let moved1 = store.application(id: appID)?.keyValueCheatsheets.first(where: { $0.id == sheetIDs[1] })?.entries.map(\.id) ?? []
        try check(moved1 == ["mB", "mA", "mC"], "Moving itemA below itemB failed.")

        // Move itemC (2) to above itemA (1) with edge .top -> destination 1
        try store.moveKeyValueEntries(fromOffsets: IndexSet(integer: 2), toOffset: 1, cheatsheetID: sheetIDs[1], applicationID: appID)
        let moved2 = store.application(id: appID)?.keyValueCheatsheets.first(where: { $0.id == sheetIDs[1] })?.entries.map(\.id) ?? []
        try check(moved2 == ["mB", "mC", "mA"], "Moving itemC above itemA failed.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw TableNavigationSelfTestError.failed(message) }
    }
}

private enum TableNavigationSelfTestError: LocalizedError {
    case failed(String)
    var errorDescription: String? {
        switch self {
        case .failed(let message): message
        }
    }
}
