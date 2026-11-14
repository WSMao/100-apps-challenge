import AppKit
import SwiftUI
import XCTest
@testable import DashCuesCore

final class DashCuesUnitAndIntegrationTests: XCTestCase {
    @MainActor
    func testAllCoreSubsystemsAndSelfTests() throws {
        try ShortcutStoreSelfTest.run()
        try ShortcutMappingParserSelfTest.run()
    }

    @MainActor
    func testHostedKeyValueFormInlineEditingAndMultilineGrowth() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-hosted-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        let defaultsSuite = "DashCues.HostedTest.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: defaultsSuite))
        defer { defaults.removePersistentDomain(forName: defaultsSuite) }

        let contentNav = SharedContentNavigation(defaults: defaults)
        let editSession = KeyValueEditSession(store: store)
        let appID = try store.addApplication(name: "Hosted KV App", bundleIdentifier: "com.example.hosted", symbolName: "terminal")
        let sheetID = try store.createSheet(kind: .keyValue, name: "Variables", applicationID: appID)
        if let sheet = store.application(id: appID)?.sheets.first(where: { $0.id == sheetID }) {
            contentNav.selectSheet(sheet, for: appID)
        }
        let tableNav = TableKeyboardNavigation(
            store: store,
            applicationID: appID,
            editSession: editSession,
            clipboardWriter: { _ in true }
        )
        tableNav.selectSheet(id: sheetID)

        let view = KeyValueCheatsheetView(
            store: store,
            contentNavigation: contentNav,
            applicationID: appID,
            sheetID: sheetID,
            onError: { _ in },
            onCopySuccess: { _ in },
            clipboardWriter: { _ in true },
            editSession: editSession,
            navigation: tableNav
        )

        let hostingController = NSHostingController(rootView: view)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 520),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.contentViewController = hostingController
        window.makeKeyAndOrderFront(nil)
        defer { window.orderOut(nil) }

        pumpRunLoop()

        // 1. Trigger "新增項目" on empty sheet and verify KeyValueTableView + InlineEditTextField mount immediately
        let newEntryID = editSession.beginNew(cheatsheetID: sheetID, applicationID: appID)
        XCTAssertNotNil(newEntryID)
        pumpRunLoop()

        let keyField = try XCTUnwrap(
            findTextField(in: window.contentView, identifier: "key-value.entry-key"),
            "Expected key-value.entry-key NSTextField to be mounted after beginNew on empty sheet."
        )
        let valueField = try XCTUnwrap(
            findTextField(in: window.contentView, identifier: "key-value.entry-value"),
            "Expected key-value.entry-value NSTextField to be mounted after beginNew on empty sheet."
        )

        // Ensure keyField acquires field editor
        if keyField.currentEditor() == nil {
            window.makeFirstResponder(keyField)
            pumpRunLoop()
        }
        let keyEditor = try XCTUnwrap(keyField.currentEditor() as? NSTextView, "keyField should have active field editor")

        // 2. Type into Key field and press Tab to switch to Value field
        keyEditor.string = "API_URL"
        keyField.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: keyField))
        XCTAssertEqual(editSession.draftKey, "API_URL")

        let handledTab = keyField.delegate?.control?(
            keyField,
            textView: keyEditor,
            doCommandBy: #selector(NSResponder.insertTab(_:))
        ) ?? false
        XCTAssertTrue(handledTab, "Tab command should be handled by InlineTextEditor coordinator")
        XCTAssertEqual(editSession.focusColumn, .value)
        pumpRunLoop()

        if valueField.currentEditor() == nil {
            window.makeFirstResponder(valueField)
            pumpRunLoop()
        }
        let valueEditor = try XCTUnwrap(valueField.currentEditor() as? NSTextView, "valueField should have active field editor after Tab")

        let singleLineWidth = valueField.frame.width
        let singleLineHeight = valueField.frame.height

        // 3. Type multiline value using Shift-Enter (insertNewlineIgnoringFieldEditor:) and verify no recursion + height & width growth
        valueEditor.string = "https://one.example.com"
        valueEditor.setSelectedRange(NSRange(location: valueEditor.string.count, length: 0))
        valueField.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: valueField))

        let handledShiftEnter = valueField.delegate?.control?(
            valueField,
            textView: valueEditor,
            doCommandBy: #selector(NSResponder.insertNewlineIgnoringFieldEditor(_:))
        ) ?? false
        XCTAssertTrue(handledShiftEnter, "Shift-Enter should insert newline without ending editing")
        let longSecondLine = "https://two.example.com/a/very/long/path/that/exceeds/the/normal/column/width/by/a/large/margin/to/verify/expansion"
        valueEditor.insertText(longSecondLine, replacementRange: valueEditor.selectedRange())
        valueField.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: valueField))
        pumpRunLoop()

        XCTAssertEqual(editSession.draftValue, "https://one.example.com\n\(longSecondLine)")
        XCTAssertGreaterThan(
            valueField.frame.height,
            singleLineHeight,
            "Multiline InlineTextEditor should grow vertically when newline is inserted"
        )
        XCTAssertGreaterThan(
            valueField.frame.width,
            singleLineWidth,
            "Multiline InlineTextEditor should grow horizontally to fit long line without clipping"
        )

        // 4. Press Enter (insertNewline:) to save and verify entry is persisted and edit session closes cleanly
        let handledEnter = valueField.delegate?.control?(
            valueField,
            textView: valueEditor,
            doCommandBy: #selector(NSResponder.insertNewline(_:))
        ) ?? false
        XCTAssertTrue(handledEnter, "Enter should submit and save the inline edit")
        pumpRunLoop()

        XCTAssertFalse(editSession.isEditing)
        XCTAssertEqual(editSession.draftKey, "", "Teardown must not write stale text back into draftKey")
        XCTAssertEqual(editSession.draftValue, "", "Teardown must not write stale text back into draftValue")

        let savedEntries = store.application(id: appID)?.keyValueCheatsheets.first(where: { $0.id == sheetID })?.entries ?? []
        XCTAssertEqual(savedEntries.count, 1)
        XCTAssertEqual(savedEntries.first?.key, "API_URL")
        XCTAssertEqual(savedEntries.first?.value, "https://one.example.com\n\(longSecondLine)")
    }

    @MainActor
    func testHostedDashboardTabOverflowAndKeyboardNavigationJourney() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-dash-nav-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        let defaultsSuite = "DashCues.DashboardNavTest.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: defaultsSuite))
        defer { defaults.removePersistentDomain(forName: defaultsSuite) }

        let contentNav = SharedContentNavigation(defaults: defaults)
        let editSession = KeyValueEditSession(store: store)
        var copiedStrings: [String] = []

        // Pin a custom test app so it is first in store.applications
        let appID = try store.addApplication(name: "NavSuite", bundleIdentifier: "com.example.navsuite", symbolName: "terminal")
        try store.setPinned(true, applicationID: appID)

        let kv1 = try store.createSheet(kind: .keyValue, name: "Database Config", applicationID: appID)
        let kv2 = try store.createSheet(kind: .keyValue, name: "Deployment Environments", applicationID: appID)
        let kv3 = try store.createSheet(kind: .keyValue, name: "Prompt Templates", applicationID: appID)

        try store.saveKeyValueEntry(
            KeyValueEntry(id: "e-trunc", key: "LONG_PROMPT", value: "Line 1\nLine 2 with extra details"),
            cheatsheetID: kv3,
            applicationID: appID
        )
        try store.saveKeyValueEntry(
            KeyValueEntry(id: "e-short", key: "PORT", value: "8080"),
            cheatsheetID: kv3,
            applicationID: appID
        )
        _ = (kv1, kv2)

        let dashboard = DashboardView(
            store: store,
            contentNavigation: contentNav,
            editSession: editSession,
            onHotKeyChanged: { _ in },
            clipboardWriter: { text in
                copiedStrings.append(text)
                return true
            }
        )

        let hostingController = NSHostingController(rootView: dashboard)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 640, height: 520),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.contentViewController = hostingController
        window.makeKeyAndOrderFront(nil)
        window.setFrame(NSRect(x: 0, y: 0, width: 640, height: 520), display: true)
        defer { window.orderOut(nil) }

        pumpRunLoop(seconds: 0.15)

        // 1. In a narrow 640pt window, 4 sheets ("快捷鍵", "Database Config", "Deployment Environments", "Prompt Templates")
        // cannot all fit in the header tab bar: overflow menu must be present and fewer than 4 tab pills visible.
        let initialApp = try XCTUnwrap(store.application(id: appID))
        XCTAssertEqual(initialApp.sheets.count, 4)
        XCTAssertEqual(contentNav.selectedSheet(for: appID, in: initialApp.sheets)?.kind, .shortcuts)

        let visibleTabCountInNarrow = countAccessibilityIdentifiers(
            in: window.contentView,
            prefix: "dashboard.sheet-tab."
        )
        XCTAssertLessThan(
            visibleTabCountInNarrow,
            4,
            "Narrow 640pt window must hide overflowing tabs into the overflow menu instead of showing all 4 tabs"
        )
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-overflow-menu"),
            "Overflow menu button must be rendered when tabs do not fit in narrow window"
        )
        XCTAssertFalse(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.sheet-tab.key-value.\(kv3)"),
            "4th sheet should initially be hidden in the overflow menu in a narrow window"
        )

        // 2. Starting on the default .shortcuts sheet with window.firstResponder === window,
        // pressing unmodified digit '4' in navigation mode must select the 4th sheet (kv3) and make its tab visible!
        window.makeFirstResponder(nil)
        sendKeyDown(to: window, keyCode: 21, characters: "4")
        pumpRunLoop(seconds: 0.12)

        XCTAssertEqual(
            contentNav.selectedSheet(for: appID, in: initialApp.sheets)?.id,
            kv3,
            "Pressing '4' in navigation mode from a shortcuts sheet must select the 4th sheet (even when hidden)"
        )
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.sheet-tab.key-value.\(kv3)"),
            "Selecting hidden sheet 4 must make its tab visible on the tab bar"
        )

        // 3. Right arrow from sidebar focuses selected tab; Down arrow enters table row 0 col 0; Tab cycles col; Cmd-C copies
        sendKeyDown(to: window, keyCode: 124, characters: "") // Right arrow: sidebar -> tabs
        pumpRunLoop(seconds: 0.08)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-focused"),
            "Right arrow from sidebar must focus the selected sheet tab"
        )
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down arrow: tabs -> table (row 0, key)
        pumpRunLoop(seconds: 0.08)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "key-value.cell-focused"),
            "Down arrow from tab must select and outline the first cell in the table"
        )

        // Row 0 ("e-trunc") has multiline value: Row 0 is automatically expanded upon focus.
        // Right arrow moves between Key and Value cell on same row; Left arrow moves back.
        sendKeyDown(to: window, keyCode: 124, characters: "") // Right arrow -> moves to Value cell
        pumpRunLoop(seconds: 0.05)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "key-value.cell-focused"),
            "Right arrow in table must switch focus to Value cell and remain in table"
        )
        sendKeyDown(to: window, keyCode: 123, characters: "") // Left arrow -> moves to Key cell
        pumpRunLoop(seconds: 0.05)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "key-value.cell-focused"),
            "Left arrow in table must switch focus to Key cell and remain in table"
        )
        sendKeyDown(to: window, keyCode: 123, characters: "") // Left arrow on Key cell remains in table (Esc returns to tabs)
        pumpRunLoop(seconds: 0.05)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "key-value.cell-focused"),
            "Left arrow on Key cell must remain in table"
        )
        sendKeyDown(to: window, keyCode: 53, characters: "") // Esc -> returns to tabs
        pumpRunLoop(seconds: 0.05)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-focused"),
            "Esc in table must return focus to tab bar"
        )
        sendKeyDown(to: window, keyCode: 53, characters: "") // Esc on tabs -> returns to sidebar
        pumpRunLoop(seconds: 0.05)
        XCTAssertFalse(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-focused"),
            "Esc on tab bar must return focus to sidebar"
        )
        XCTAssertTrue(
            window.firstResponder is NSTableView,
            "Esc on tab bar must focus sidebar NSTableView (active blue highlight)"
        )

        // Re-enter table: Right arrow -> tabs, Down arrow -> table
        sendKeyDown(to: window, keyCode: 124, characters: "")
        pumpRunLoop(seconds: 0.05)
        sendKeyDown(to: window, keyCode: 125, characters: "")
        pumpRunLoop(seconds: 0.05)

        sendKeyDown(to: window, keyCode: 8, characters: "c", modifiers: .command) // Cmd-C copies Key ("LONG_PROMPT")
        XCTAssertEqual(copiedStrings.last, "LONG_PROMPT")

        sendKeyDown(to: window, keyCode: 48, characters: "\t") // Tab switches to Value column
        pumpRunLoop(seconds: 0.05)
        sendKeyDown(to: window, keyCode: 8, characters: "c", modifiers: .command) // Cmd-C copies Value
        XCTAssertEqual(copiedStrings.last, "Line 1\nLine 2 with extra details")

        // Ctrl-Tab leaves table back to tabs; Left arrow in tabs selects previous hidden sheet (kv2) and makes it visible
        sendKeyDown(to: window, keyCode: 48, characters: "\t", modifiers: .control)
        pumpRunLoop(seconds: 0.05)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-focused"),
            "Ctrl-Tab must leave table and return focus to tab bar"
        )
        sendKeyDown(to: window, keyCode: 123, characters: "") // Left arrow in tabs -> kv2
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(contentNav.selectedSheet(for: appID, in: initialApp.sheets)?.id, kv2)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.sheet-tab.key-value.\(kv2)"),
            "Selecting hidden sheet kv2 via Left arrow in tabs must make its tab visible"
        )
        sendKeyDown(to: window, keyCode: 124, characters: "") // Right arrow in tabs -> back to kv3
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(contentNav.selectedSheet(for: appID, in: initialApp.sheets)?.id, kv3)
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down arrow -> table row 0
        pumpRunLoop(seconds: 0.05)
        sendKeyDown(to: window, keyCode: 48, characters: "\t") // Tab -> Value column
        pumpRunLoop(seconds: 0.05)

        // 4. Down arrow moves to row 1 ("PORT" / "8080") while retaining Value column; Enter begins inline editing
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down arrow -> row 1
        pumpRunLoop(seconds: 0.08)
        sendKeyDown(to: window, keyCode: 36, characters: "\r") // Enter -> inline edit on row 1 Value
        pumpRunLoop(seconds: 0.12)

        XCTAssertTrue(editSession.isEditing)
        XCTAssertEqual(editSession.editingEntryID, "e-short")
        XCTAssertEqual(editSession.focusColumn, .value)

        // Digits while editing must NOT switch sheets
        sendKeyDown(to: window, keyCode: 18, characters: "1")
        pumpRunLoop(seconds: 0.05)
        XCTAssertEqual(contentNav.selectedSheet(for: appID, in: initialApp.sheets)?.id, kv3)

        // Esc cancels inline editing and returns to table navigation mode
        sendKeyDown(to: window, keyCode: 53, characters: "\u{1b}")
        pumpRunLoop(seconds: 0.08)
        XCTAssertFalse(editSession.isEditing)

        // 5. Esc from table returns to tab bar, second Esc returns to sidebar, then Down arrow in sidebar selects next app
        sendKeyDown(to: window, keyCode: 53, characters: "") // Esc -> tab bar
        pumpRunLoop(seconds: 0.08)
        sendKeyDown(to: window, keyCode: 53, characters: "") // Esc -> sidebar
        pumpRunLoop(seconds: 0.08)
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down arrow in sidebar -> selects next app
        pumpRunLoop(seconds: 0.1)
        XCTAssertNotEqual(contentNav.selectedSheet(for: appID, in: initialApp.sheets)?.id, nil)

        // 6. User Story 55, 56, 57: Cmd-F opens sheet search bar, state machine interaction, and section-grouped search results
        sendKeyDown(to: window, keyCode: 126, characters: "") // Up arrow -> back to Hosted Terminal
        pumpRunLoop(seconds: 0.1)

        // Press Cmd-F to open/focus sheet search bar into editing state (US 55)
        sendKeyDown(to: window, keyCode: 3, characters: "f", modifiers: .command)
        pumpRunLoop(seconds: 0.1)

        let searchInput = try XCTUnwrap(
            findTextField(in: window.contentView, identifier: "sheet.search-input"),
            "Expected sheet.search-input to be present after Cmd-F"
        )
        if searchInput.currentEditor() == nil {
            window.makeFirstResponder(searchInput)
            pumpRunLoop(seconds: 0.05)
        }
        let searchEditor = try XCTUnwrap(searchInput.currentEditor() as? NSTextView, "Search field must acquire field editor")
        searchEditor.string = "PROMPT"
        searchInput.stringValue = "PROMPT"
        searchInput.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: searchInput))
        pumpRunLoop(seconds: 0.1)

        // Verify search results grouped by section (US 57)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"),
            "Search results container must be rendered for matching query"
        )
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-section.\(kv3)"),
            "Matching sheet kv3 must be rendered as a boxed Section"
        )
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-jump.key-value.e-trunc"),
            "Matching key-value entry must provide a jump icon button"
        )

        // Test State Machine (US 56):
        // In editing state: press Enter -> confirms input and exits editing state, focus remains on search box
        let handledEnter = searchInput.delegate?.control?(
            searchInput,
            textView: searchEditor,
            doCommandBy: #selector(NSResponder.insertNewline(_:))
        ) ?? false
        XCTAssertTrue(handledEnter, "Enter in editing state should be handled")
        pumpRunLoop(seconds: 0.08)

        // In editing state: press Esc -> clears content and exits editing state
        sendKeyDown(to: window, keyCode: 3, characters: "f", modifiers: .command)
        pumpRunLoop(seconds: 0.08)
        let handledEsc = searchInput.delegate?.control?(
            searchInput,
            textView: searchEditor,
            doCommandBy: #selector(NSResponder.cancelOperation(_:))
        ) ?? false
        XCTAssertTrue(handledEsc, "Esc in editing state should be handled")
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(searchInput.stringValue, "", "Esc in editing state must clear the search text")

        // Down arrow in focusedNonEditing moves focus to content below
        sendKeyDown(to: window, keyCode: 125, characters: "")
        pumpRunLoop(seconds: 0.08)
    }

    @MainActor
    private func pumpRunLoop(seconds: TimeInterval = 0.08) {
        let limit = Date().addingTimeInterval(seconds)
        while Date() < limit {
            while let event = NSApp.nextEvent(
                matching: .any,
                until: nil,
                inMode: .default,
                dequeue: true
            ) {
                NSApp.sendEvent(event)
            }
            RunLoop.main.run(mode: .default, before: Date().addingTimeInterval(0.01))
        }
    }

    @MainActor
    func testHostedSheetSearchDownArrowNavigationAndHistoryAndJump() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-search-host-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        let defaultsSuite = "DashCues.SearchHostTest.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: defaultsSuite))
        defer { defaults.removePersistentDomain(forName: defaultsSuite) }

        let contentNav = SharedContentNavigation(defaults: defaults)
        let editSession = KeyValueEditSession(store: store)

        // Setup test app with a Shortcuts sheet and a Key-Value sheet
        let appID = try store.addApplication(name: "SearchHostApp", bundleIdentifier: "com.example.searchhost", symbolName: "magnifyingglass")
        try store.setPinned(true, applicationID: appID)

        let initialSheets = store.application(id: appID)?.sheets ?? []
        let scSheetID = try XCTUnwrap(initialSheets.first(where: { $0.kind == .shortcuts })?.id)
        let kvSheetID = try store.createSheet(kind: .keyValue, name: "Production Config", applicationID: appID)

        // Save searchable items
        try store.saveShortcut(
            ShortcutItem(title: "Deploy Prod", keys: ["⌘", "P"]),
            applicationID: appID,
            sheetID: scSheetID
        )
        try store.saveKeyValueEntry(
            KeyValueEntry(key: "prod_db", value: "postgres://prod.internal"),
            cheatsheetID: kvSheetID,
            applicationID: appID
        )

        let dashboard = DashboardView(
            store: store,
            contentNavigation: contentNav,
            editSession: editSession,
            onHotKeyChanged: { _ in }
        )

        let hostingController = NSHostingController(rootView: dashboard)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 700, height: 520),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.contentViewController = hostingController
        window.makeKeyAndOrderFront(nil)
        defer { window.orderOut(nil) }

        pumpRunLoop(seconds: 0.15)

        // 1. Press Cmd-F to focus search bar into editing state
        window.makeFirstResponder(nil)
        sendKeyDown(to: window, keyCode: 3, characters: "f", modifiers: .command)
        pumpRunLoop(seconds: 0.1)

        let searchInput = try XCTUnwrap(findTextField(in: window.contentView, identifier: "sheet.search-input"))

        // Ensure searchInput is first responder
        if searchInput.currentEditor() == nil {
            window.makeFirstResponder(searchInput)
            pumpRunLoop(seconds: 0.05)
        }
        let editor = try XCTUnwrap(searchInput.currentEditor() as? NSTextView, "Search input should have active editor")

        // 2. Type "prod" into search bar
        editor.string = "prod"
        searchInput.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: searchInput))
        pumpRunLoop(seconds: 0.1)

        // Verify search results appear
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"))

        // 3. Press Enter to confirm search query and enter focusedNonEditing state
        // This should record "prod" into RecentSearchStore
        let handledEnter = searchInput.delegate?.control?(
            searchInput,
            textView: editor,
            doCommandBy: #selector(NSResponder.insertNewline(_:))
        ) ?? false
        XCTAssertTrue(handledEnter, "Enter in search input must be handled")
        pumpRunLoop(seconds: 0.1)

        let recentSearches = RecentSearchStore.shared.recentSearches(for: appID)
        XCTAssertTrue(recentSearches.contains("prod"), "Enter in search input must record query in RecentSearchStore")

        // 4. In focusedNonEditing state, press Down Arrow:
        // Focus must cleanly move to the search results list with visual focus indicator!
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down Arrow
        pumpRunLoop(seconds: 0.1)

        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-result.focused"),
            "Down arrow from non-editing search bar must focus search results list"
        )

        // Target 0 is shortcut row (single row focused).
        // Press Down Arrow to move to Target 1 (Key-Value row):
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down Arrow -> Target 1 (Key-Value)
        pumpRunLoop(seconds: 0.08)

        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-kv-cell.focused"),
            "Key-Value row in search results must focus individual cells"
        )
        XCTAssertEqual(
            findAccessibilityValue(in: window.contentView, identifier: "sheet.search-kv-cell.focused"),
            "Key",
            "Initially Key cell is focused on Key-Value result row"
        )

        // Test Right Arrow -> moves focus to Value cell
        sendKeyDown(to: window, keyCode: 124, characters: "") // Right Arrow
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(
            findAccessibilityValue(in: window.contentView, identifier: "sheet.search-kv-cell.focused"),
            "Value",
            "Right arrow must move focus to Value cell in search results"
        )

        // Test Cmd-C on Value cell
        sendKeyDown(to: window, keyCode: 8, characters: "c", modifiers: .command) // Cmd-C
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(NSPasteboard.general.string(forType: .string), "postgres://prod.internal")

        // Test Left Arrow -> moves focus back to Key cell
        sendKeyDown(to: window, keyCode: 123, characters: "") // Left Arrow
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(
            findAccessibilityValue(in: window.contentView, identifier: "sheet.search-kv-cell.focused"),
            "Key",
            "Left arrow must move focus back to Key cell in search results"
        )

        // Test Cmd-C on Key cell
        sendKeyDown(to: window, keyCode: 8, characters: "c", modifiers: .command) // Cmd-C
        pumpRunLoop(seconds: 0.08)
        XCTAssertEqual(NSPasteboard.general.string(forType: .string), "prod_db")

        // 5. In search results on Key-Value row, press Enter to trigger Jump:
        sendKeyDown(to: window, keyCode: 36, characters: "\r") // Enter
        pumpRunLoop(seconds: 0.15)

        // Jump must switch to target sheet, clear search text, and highlight jumped item!
        XCTAssertFalse(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"),
            "Jump must dismiss search results and clear search"
        )
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "key-value.jump-highlighted"),
            "Jumped Key-Value item must be visibly highlighted"
        )

        // 6. Test number key tab selection from search results & Down Arrow from tabs:
        // Focus search and search "prod" again
        sendKeyDown(to: window, keyCode: 3, characters: "f", modifiers: .command)
        pumpRunLoop(seconds: 0.1)
        if searchInput.currentEditor() == nil {
            window.makeFirstResponder(searchInput)
            pumpRunLoop(seconds: 0.05)
        }
        let editor1b = try XCTUnwrap(searchInput.currentEditor() as? NSTextView)
        editor1b.string = "prod"
        searchInput.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: searchInput))
        pumpRunLoop(seconds: 0.1)
        _ = searchInput.delegate?.control?(
            searchInput,
            textView: editor1b,
            doCommandBy: #selector(NSResponder.insertNewline(_:))
        )
        pumpRunLoop(seconds: 0.1)

        // Move to search results list
        sendKeyDown(to: window, keyCode: 125, characters: "") // Down Arrow
        pumpRunLoop(seconds: 0.1)
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"))

        // Press unmodified digit '1' to select Sheet Tab 1 ("快捷鍵")
        sendKeyDown(to: window, keyCode: 18, characters: "1")
        pumpRunLoop(seconds: 0.15)

        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-focused"),
            "Pressing number key from search results must select and focus corresponding Sheet tab"
        )
        XCTAssertFalse(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"),
            "Focusing sheet tab bar must clear search results and exit search page"
        )

        // Press Down Arrow from focused Sheet tab -> moves focus into Sheet 1 shortcuts table
        sendKeyDown(to: window, keyCode: 125, characters: "")
        pumpRunLoop(seconds: 0.1)
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "shortcut.row-focused"),
            "Down arrow from Sheet tab after search dismissal moves directly to sheet items"
        )

        // 6. Test History Dropdown:
        for q in ["query-1", "query-2", "query-3", "query-4", "query-5"] {
            RecentSearchStore.shared.record(query: q, for: appID)
        }

        // Press Cmd-F to focus search bar into editing state
        sendKeyDown(to: window, keyCode: 3, characters: "f", modifiers: .command)
        pumpRunLoop(seconds: 0.1)

        if searchInput.currentEditor() == nil {
            window.makeFirstResponder(searchInput)
            pumpRunLoop(seconds: 0.05)
        }
        let editor2 = try XCTUnwrap(searchInput.currentEditor() as? NSTextView)

        // Press Down Arrow while in editing state:
        let handledDownInEditing = searchInput.delegate?.control?(
            searchInput,
            textView: editor2,
            doCommandBy: #selector(NSResponder.moveDown(_:))
        ) ?? false
        XCTAssertTrue(handledDownInEditing, "Down arrow in editing state must be handled by search history")
        pumpRunLoop(seconds: 0.1)

        // History dropdown must be visible with 5 recent search items!
        XCTAssertTrue(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-history-dropdown"),
            "Down arrow in editing state must open search history dropdown"
        )
        for idx in 0..<5 {
            XCTAssertTrue(
                hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-history-item.\(idx)"),
                "History dropdown must show item \(idx)"
            )
        }

        // Press Enter to confirm history selection
        let handledEnterHistory = searchInput.delegate?.control?(
            searchInput,
            textView: editor2,
            doCommandBy: #selector(NSResponder.insertNewline(_:))
        ) ?? false
        XCTAssertTrue(handledEnterHistory, "Enter must select history item")
        pumpRunLoop(seconds: 0.1)

        XCTAssertFalse(
            hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-history-dropdown"),
            "Selecting history item must dismiss dropdown"
        )

        // 7. Verify Esc in search bar (non-editing) clears search and focuses tab bar, switching to selected sheet
        if searchInput.currentEditor() == nil {
            window.makeFirstResponder(searchInput)
            pumpRunLoop(seconds: 0.05)
        }
        if let editor3 = searchInput.currentEditor() as? NSTextView {
            editor3.string = "prod"
            searchInput.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: searchInput))
            pumpRunLoop(seconds: 0.1)

            XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"))

            // Confirm query to exit editing into focusedNonEditing
            _ = searchInput.delegate?.control?(
                searchInput,
                textView: editor3,
                doCommandBy: #selector(NSResponder.insertNewline(_:))
            )
            pumpRunLoop(seconds: 0.1)

            // Press Esc in focusedNonEditing state: focus moves to sheet tab bar
            sendKeyDown(to: window, keyCode: 53, characters: "")
            pumpRunLoop(seconds: 0.1)

            XCTAssertTrue(
                hasAccessibilityIdentifier(in: window.contentView, identifier: "dashboard.tab-focused"),
                "Esc in search bar must focus sheet tab bar"
            )
            XCTAssertFalse(
                hasAccessibilityIdentifier(in: window.contentView, identifier: "sheet.search-results"),
                "Arriving at sheet tab bar must clear search results and exit search page"
            )
            XCTAssertEqual(searchInput.stringValue, "", "Search input text must be cleared when focus arrives at tab bar")
        }
    }

    @MainActor
    func testHostedShortcutImportSheetWorkflow() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-import-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        let appID = try store.addApplication(name: "ImportTestApp", bundleIdentifier: "com.example.import", symbolName: "gear")
        let app = try XCTUnwrap(store.application(id: appID))
        let initialSheetID = try XCTUnwrap(app.sheets.first?.id)

        var copiedText: String?
        var successMsg: String?
        let importSheet = ShortcutImportSheet(
            application: app,
            store: store,
            clipboardWriter: { text in
                copiedText = text
                return true
            },
            initialSheetID: initialSheetID,
            onSuccess: { successMsg = $0 }
        )

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 840, height: 560),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.contentViewController = NSHostingController(rootView: importSheet)
        window.makeKeyAndOrderFront(nil)
        defer { window.orderOut(nil) }

        pumpRunLoop(seconds: 0.15)

        // 1. Initial UI Elements
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "import.close-button"))
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "import.placeholder"))
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "import.copy-template"))
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "import.empty-preview"))
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "import.location-menu"))
        XCTAssertTrue(hasAccessibilityIdentifier(in: window.contentView, identifier: "import.confirm-button"))

        // 2. Click "複製製作格式"
        XCTAssertTrue(ShortcutMappingParser.templatePrompt.contains("請照以下的 JSON 格式製作快捷鍵映射檔案，將製作好的內容提供給我"))
        XCTAssertTrue(ShortcutMappingParser.templatePrompt.contains("【macOS 常用快捷鍵符號對照表】"))
        _ = importSheet.clipboardWriter(ShortcutMappingParser.templatePrompt)
        XCTAssertEqual(copiedText, ShortcutMappingParser.templatePrompt)
        importSheet.onSuccess?("已匯入 2 筆快捷鍵至 快捷鍵")
        XCTAssertEqual(successMsg, "已匯入 2 筆快捷鍵至 快捷鍵")

        // 3. Test parsing JSON content and generating preview
        let testJSON = """
        [
          {
            "title": "單元測試快捷鍵 1",
            "keys": ["⌘", "T"],
            "tags": ["測試"]
          },
          {
            "title": "單元測試快捷鍵 2",
            "keys": ["⌘", "⇧", "K"],
            "tags": ["除錯"]
          }
        ]
        """
        let parsed = try ShortcutMappingParser.parse(testJSON)
        XCTAssertEqual(parsed.count, 2)
        XCTAssertEqual(parsed[0].title, "單元測試快捷鍵 1")
        XCTAssertEqual(parsed[1].title, "單元測試快捷鍵 2")

        // 4. Save parsed items into store (simulating Import button execution)
        for item in parsed {
            try store.saveShortcut(item, applicationID: appID, sheetID: initialSheetID)
        }

        // Verify items were persisted into store
        let updatedApp = try XCTUnwrap(store.application(id: appID))
        let sheet = try XCTUnwrap(updatedApp.sheets.first)
        if case .shortcuts(let scSheet) = sheet {
            XCTAssertTrue(scSheet.shortcuts.contains(where: { $0.title == "單元測試快捷鍵 1" }))
            XCTAssertTrue(scSheet.shortcuts.contains(where: { $0.title == "單元測試快捷鍵 2" }))
        } else {
            XCTFail("Target sheet should be shortcuts sheet")
        }

        // 5. Test creating a new shortcuts sheet via store
        let newSheetID = try store.createSheet(kind: .shortcuts, name: "測試新建工作表", applicationID: appID)
        let appWithNewSheet = try XCTUnwrap(store.application(id: appID))
        XCTAssertTrue(appWithNewSheet.sheets.contains(where: { $0.id == newSheetID && $0.name == "測試新建工作表" }))
    }

    @MainActor
    func testManualShortcutKeyInputAndUpdate() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-manual-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        let appID = try store.addApplication(name: "Manual Key App", bundleIdentifier: "com.example.manual", symbolName: "command")
        let item = ShortcutItem(title: "縮放視圖", keys: ["⌘", "+"])
        try store.saveShortcut(item, applicationID: appID)

        let model = ShortcutListModel(store: store, applicationID: appID)
        XCTAssertEqual(model.rows.count, 1)
        XCTAssertEqual(model.rows[0].keys, ["⌘", "+"])

        // Test updating with Scheme B and mouse keys
        let parsed = ShortcutMappingParser.parseKeysInput("[\"⌥\", \"Drag\"]")
        XCTAssertEqual(parsed, ["⌥", "Drag"])

        model.updateShortcutKeys(id: item.id, keys: parsed)
        let updated = try XCTUnwrap(store.application(id: appID)?.shortcuts.first(where: { $0.id == item.id }))
        XCTAssertEqual(updated.keys, ["⌥", "Drag"])

        // Test updating with Scheme B modifier
        let schemeBKeys = ShortcutMappingParser.parseKeysInput("[\"LCtrl\", \"Click\"]")
        XCTAssertEqual(schemeBKeys, ["LCtrl", "Click"])
        model.updateShortcutKeys(id: item.id, keys: schemeBKeys)
        let updated2 = try XCTUnwrap(store.application(id: appID)?.shortcuts.first(where: { $0.id == item.id }))
        XCTAssertEqual(updated2.keys, ["LCtrl", "Click"])
    }

    @MainActor
    func testShortcutImportWindowManagerModalBehavior() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-modal-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = try ShortcutStore(storageURL: directory.appendingPathComponent("shortcuts.json"))
        let appID = try store.addApplication(name: "ImportModalApp", bundleIdentifier: "com.example.modal", symbolName: "gear")
        let app = try XCTUnwrap(store.application(id: appID))

        let parentWindow = NSWindow(
            contentRect: NSRect(x: 100, y: 100, width: 800, height: 600),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        parentWindow.title = "DashCues"
        parentWindow.makeKeyAndOrderFront(nil)
        defer { parentWindow.orderOut(nil) }

        let manager = ShortcutImportWindowManager()
        XCTAssertFalse(manager.isPresented)

        manager.show(
            application: app,
            store: store,
            clipboardWriter: { _ in true },
            initialSheetID: app.sheets.first?.id,
            parentWindow: parentWindow,
            onSuccess: { _ in },
            onError: { _ in }
        )

        XCTAssertTrue(manager.isPresented)
        pumpRunLoop(seconds: 0.1)

        // Close manager
        manager.close()
        XCTAssertFalse(manager.isPresented)
    }

    @MainActor
    func testLeftRightModifierDetectionAndDisplayBadges() throws {
        // 1. Detection of left vs right modifiers
        let rCmdFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.command.rawValue | ShortcutKeyFormatter.NX_DEVICERCMDKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(rCmdFlags), ["RCmd"], "Right Command must be detected as RCmd")

        let lCmdFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.command.rawValue | ShortcutKeyFormatter.NX_DEVICELCMDKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(lCmdFlags), ["⌘"], "Left Command must not have special label (remain ⌘)")

        let rOptFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.option.rawValue | ShortcutKeyFormatter.NX_DEVICERALTKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(rOptFlags), ["ROpt"])

        let lOptFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.option.rawValue | ShortcutKeyFormatter.NX_DEVICELALTKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(lOptFlags), ["⌥"])

        let rCtrlFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.control.rawValue | ShortcutKeyFormatter.NX_DEVICERCTLKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(rCtrlFlags), ["RCtrl"])

        let lCtrlFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.control.rawValue | ShortcutKeyFormatter.NX_DEVICELCTLKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(lCtrlFlags), ["⌃"])

        let rShiftFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.shift.rawValue | ShortcutKeyFormatter.NX_DEVICERSHIFTKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(rShiftFlags), ["RShift"])

        let lShiftFlags = NSEvent.ModifierFlags(rawValue: NSEvent.ModifierFlags.shift.rawValue | ShortcutKeyFormatter.NX_DEVICELSHIFTKEYMASK)
        XCTAssertEqual(ShortcutKeyFormatter.modifierSymbols(lShiftFlags), ["⇧"])

        // 2. Display badge symbols
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "RCmd"), "⌘ʀ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "LCmd"), "⌘ʟ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "ROpt"), "⌥ʀ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "LOpt"), "⌥ʟ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "RCtrl"), "⌃ʀ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "LCtrl"), "⌃ʟ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "RShift"), "⇧ʀ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "LShift"), "⇧ʟ")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "⌘"), "⌘")
        XCTAssertEqual(ShortcutKeyFormatter.displaySymbol(for: "C"), "C")

        // 3. keyCombination display mapping
        let rItem = ShortcutItem(title: "右鍵快捷鍵", keys: ["RCmd", "C"])
        XCTAssertEqual(rItem.keyCombination, "⌘ʀC")

        let lItem = ShortcutItem(title: "手動左鍵快捷鍵", keys: ["LCmd", "V"])
        XCTAssertEqual(lItem.keyCombination, "⌘ʟV")

        let defaultItem = ShortcutItem(title: "一般快捷鍵", keys: ["⌘", "Z"])
        XCTAssertEqual(defaultItem.keyCombination, "⌘Z")

        // 4. Manual input retention
        let manualLCmd = ShortcutMappingParser.parseKeysInput("[\"LCmd\", \"K\"]")
        XCTAssertEqual(manualLCmd, ["LCmd", "K"])

        let manualRCmd = ShortcutMappingParser.parseKeysInput("[\"RCmd\", \"K\"]")
        XCTAssertEqual(manualRCmd, ["RCmd", "K"])
    }

    @MainActor
    private func findTextField(in root: NSView?, identifier: String) -> NSTextField? {
        guard let root else { return nil }
        if let field = root as? NSTextField, field.accessibilityIdentifier() == identifier {
            return field
        }
        for subview in root.subviews {
            if let found = findTextField(in: subview, identifier: identifier) {
                return found
            }
        }
        return nil
    }

    @MainActor
    private func sendKeyDown(
        to window: NSWindow,
        keyCode: UInt16,
        characters: String,
        modifiers: NSEvent.ModifierFlags = []
    ) {
        guard let event = NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: modifiers,
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: window.windowNumber,
            context: nil,
            characters: characters,
            charactersIgnoringModifiers: characters,
            isARepeat: false,
            keyCode: keyCode
        ) else { return }
        NSApp.postEvent(event, atStart: false)
        while let queued = NSApp.nextEvent(
            matching: .any,
            until: Date().addingTimeInterval(0.02),
            inMode: .default,
            dequeue: true
        ) {
            NSApp.sendEvent(queued)
        }
    }

    @MainActor
    private func findAccessibilityValue(in root: NSView?, identifier: String) -> String? {
        guard let root else { return nil }
        var result: String?
        func walkView(_ view: NSView) {
            if result != nil { return }
            if view.accessibilityIdentifier() == identifier {
                result = view.accessibilityValue() as? String
                return
            }
            for sub in view.subviews { walkView(sub) }
        }
        func walkAX(_ element: Any) {
            if result != nil { return }
            if let ax = element as? NSAccessibilityProtocol {
                if ax.accessibilityIdentifier() == identifier {
                    result = ax.accessibilityValue() as? String
                    return
                }
                if let children = ax.accessibilityChildren() {
                    for child in children { walkAX(child) }
                }
            }
        }
        walkView(root)
        if result == nil { walkAX(root) }
        return result
    }

    @MainActor
    private func hasAccessibilityIdentifier(in root: NSView?, identifier: String) -> Bool {
        countAccessibilityIdentifiers(in: root, prefix: identifier) > 0
    }

    @MainActor
    private func countAccessibilityIdentifiers(in root: NSView?, prefix: String) -> Int {
        guard let root else { return 0 }
        var matched = Set<String>()
        func walkView(_ view: NSView) {
            let id = view.accessibilityIdentifier()
            if id.hasPrefix(prefix) { matched.insert(id) }
            for sub in view.subviews { walkView(sub) }
        }
        func walkAX(_ element: Any) {
            let obj = element as AnyObject
            if let id = obj.accessibilityIdentifier?(), !id.isEmpty, id.hasPrefix(prefix) {
                matched.insert(id)
            }
            if let ax = element as? NSAccessibilityProtocol {
                if let id = ax.accessibilityIdentifier(), !id.isEmpty, id.hasPrefix(prefix) {
                    matched.insert(id)
                }
                if let children = ax.accessibilityChildren() {
                    for child in children { walkAX(child) }
                }
            } else if let children = obj.accessibilityChildren?() {
                for child in children { walkAX(child) }
            }
        }
        walkView(root)
        walkAX(root)
        return matched.count
    }
}
