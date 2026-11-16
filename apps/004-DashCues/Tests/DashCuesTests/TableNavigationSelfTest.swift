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

        // User Story 48, 52, 53: Auto-expansion on row focus, Right/Left arrow column switching, and Esc navigation
        nav.focusArea = .table
        nav.selectedRowIndex = 0
        nav.selectedColumn = .key
        try check(nav.expandedRowIDs.contains("e1"), "Selecting truncated row e1 must automatically expand it.")

        // Right arrow moves from Key to Value on same row
        try check(nav.handleRightArrow(), "Right arrow on table row should be handled.")
        try check(nav.selectedColumn == .value, "Right arrow must switch focus to Value column.")

        // Left arrow moves from Value to Key on same row
        try check(nav.handleLeftArrow(), "Left arrow on table row should be handled.")
        try check(nav.selectedColumn == .key, "Left arrow must switch focus back to Key column.")

        // Left arrow on Key cell remains in table (does not exit to sidebar)
        try check(nav.handleLeftArrow(), "Left arrow on Key cell should be handled.")
        try check(nav.focusArea == .table, "Left arrow on Key cell must remain in table.")

        // Moving down to non-truncated row e2 collapses e1 and does not expand e2
        try check(nav.handleDownArrow(), "Down arrow should move to row 1.")
        try check(nav.selectedRowIndex == 1, "Selected row index should be 1.")
        try check(!nav.expandedRowIDs.contains("e1"), "Leaving row e1 must collapse it.")
        try check(!nav.expandedRowIDs.contains("e2"), "Non-truncated row e2 must not be expanded.")

        // Esc from table returns to tabs
        try check(nav.handleEscape(), "Esc from table should be handled.")
        try check(nav.focusArea == .tabs, "Esc from table must return to tabs.")

        // Esc from tabs returns to sidebar
        try check(nav.handleEscape(), "Esc from tabs should be handled.")
        try check(nav.focusArea == .sidebar, "Esc from tabs must return to sidebar.")

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

        // Test User Story 29: Down arrow on "快捷鍵" sheet moves focus directly into first item of shortcuts list
        let shortcutSheetID = app.sheets.first { $0.kind == .shortcuts }?.id ?? app.sheets[0].id
        let sc1 = ShortcutItem(id: "sc1", title: "Open File", keys: ["⌘", "O"], tags: [])
        let sc2 = ShortcutItem(id: "sc2", title: "Save File", keys: ["⌘", "S"], tags: [])
        try store.saveShortcut(sc1, applicationID: appID, sheetID: shortcutSheetID)
        try store.saveShortcut(sc2, applicationID: appID, sheetID: shortcutSheetID)

        nav.selectSheet(id: shortcutSheetID)
        nav.focusArea = .tabs

        let shortcutModel = ShortcutListModel(store: store, applicationID: appID, sheetID: shortcutSheetID)
        nav.onMoveFocusToShortcuts = { shortcutModel.enterList() }
        shortcutModel.onExitToTabs = { nav.focusArea = .tabs }

        try check(shortcutModel.selection.isEmpty, "Shortcuts should initially have no selection.")
        try check(nav.handleDownArrow(), "Down arrow on shortcuts sheet tab must be handled.")
        try check(nav.focusArea == .table, "Focus must move into table/list area.")
        try check(shortcutModel.selection == ["sc1"], "Focus should be directly on the first shortcut item.")

        // Up arrow from first shortcut item returns focus to tabs
        let upArrowEvent = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "",
            charactersIgnoringModifiers: "",
            isARepeat: false,
            keyCode: 126
        )
        if let upArrowEvent {
            try check(shortcutModel.consumes(keyDown: upArrowEvent), "Up arrow on first shortcut item should be consumed.")
            try check(nav.focusArea == .tabs, "Up arrow from first shortcut item must return focus to tabs.")
            try check(shortcutModel.selection.isEmpty, "Returning to tabs should clear shortcut selection.")
        }

        // Test shortcuts-only app: Navigation from sidebar -> tabs -> shortcuts list, and tabs -> sidebar
        let soloAppID = try store.addApplication(name: "ShortcutsSolo", bundleIdentifier: "com.example.solo", symbolName: "keyboard")
        guard let soloSheetID = store.application(id: soloAppID)?.sheets.first?.id else {
            throw TableNavigationSelfTestError.failed("Solo app must have default sheet")
        }
        let sItem1 = ShortcutItem(id: "s1", title: "Copy", keys: ["⌘", "C"])
        let sItem2 = ShortcutItem(id: "s2", title: "Paste", keys: ["⌘", "V"])
        try store.saveShortcut(sItem1, applicationID: soloAppID, sheetID: soloSheetID)
        try store.saveShortcut(sItem2, applicationID: soloAppID, sheetID: soloSheetID)

        let soloNav = TableKeyboardNavigation(store: store, applicationID: soloAppID, editSession: nil, clipboardWriter: { _ in true })
        let soloModel = ShortcutListModel(store: store, applicationID: soloAppID, sheetID: soloSheetID)
        soloNav.onMoveFocusToShortcuts = { soloModel.enterList() }
        soloModel.onExitToTabs = { soloNav.focusArea = .tabs }
        soloModel.onEnterTable = { soloNav.focusArea = .table }

        try check(soloNav.focusArea == .sidebar, "Initial focus must be in sidebar.")
        try check(soloNav.handleRightArrow(), "Right arrow from sidebar must enter tabs.")
        try check(soloNav.focusArea == .tabs, "Focus must be on tabs.")

        // Left arrow on single sheet tab returns to sidebar
        try check(soloNav.handleLeftArrow(), "Left arrow on first sheet tab must return to sidebar.")
        try check(soloNav.focusArea == .sidebar, "Focus should return to sidebar.")

        // Right arrow to tabs again, then Down arrow into shortcuts list
        _ = soloNav.handleRightArrow()
        try check(soloNav.handleDownArrow(), "Down arrow from solo shortcuts tab must be handled.")
        try check(soloNav.focusArea == .table, "Focus must be in table.")
        try check(soloModel.selection == ["s1"], "First shortcut item must be selected.")

        // Down arrow on shortcut item moves to second item
        let downArrowEvent = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "",
            charactersIgnoringModifiers: "",
            isARepeat: false,
            keyCode: 125
        )
        if let downArrowEvent {
            try check(soloModel.consumes(keyDown: downArrowEvent), "Down arrow in shortcut list should move selection.")
            try check(soloModel.selection == ["s2"], "Second shortcut item should be selected.")
        }

        // Left arrow on shortcut item must NOT jump back to sidebar/apps list; it stays in table
        let leftArrowEvent = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "",
            charactersIgnoringModifiers: "",
            isARepeat: false,
            keyCode: 123
        )
        if let leftArrowEvent {
            try check(soloModel.consumes(keyDown: leftArrowEvent), "Left arrow on shortcut item should be consumed.")
            try check(soloNav.focusArea == .table, "Left arrow on shortcut item must not leave table.")
            try check(soloModel.selection == ["s2"], "Left arrow on shortcut item must preserve row selection.")
        }

        // Right arrow on shortcut item also stays in table
        let rightArrowEvent = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "",
            charactersIgnoringModifiers: "",
            isARepeat: false,
            keyCode: 124
        )
        if let rightArrowEvent {
            try check(soloModel.consumes(keyDown: rightArrowEvent), "Right arrow on shortcut item should be consumed.")
            try check(soloNav.focusArea == .table, "Right arrow on shortcut item must not leave table.")
        }

        try check(soloNav.handleLeftArrow(), "TableKeyboardNavigation handleLeftArrow on shortcuts should return true.")
        try check(soloNav.focusArea == .table, "handleLeftArrow on shortcuts must remain in table.")

        // First Esc on shortcut item returns focus to tabs (like Key-Value table)
        let escEvent = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "",
            charactersIgnoringModifiers: "",
            isARepeat: false,
            keyCode: 53
        )
        if let escEvent {
            try check(soloModel.consumes(keyDown: escEvent), "Esc on shortcut item should be consumed.")
            try check(soloNav.focusArea == .tabs, "First Esc on shortcut item must return focus to tabs.")
            try check(soloModel.selection.isEmpty, "First Esc should clear shortcut selection.")
        }

        // Second Esc from tabs returns focus to sidebar (like Key-Value table)
        try check(soloNav.handleEscape(), "Esc on tabs should return to sidebar.")
        try check(soloNav.focusArea == .sidebar, "Second Esc from tabs must return focus to sidebar.")

        // Esc in sidebar does not escape further
        try check(!soloNav.handleEscape(), "Esc in sidebar should return false.")
        try check(soloNav.focusArea == .sidebar, "Esc in sidebar should retain focus in sidebar.")
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
