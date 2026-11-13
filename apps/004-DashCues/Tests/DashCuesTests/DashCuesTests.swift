import AppKit
import SwiftUI
import XCTest
@testable import DashCuesCore

final class DashCuesUnitAndIntegrationTests: XCTestCase {
    @MainActor
    func testAllCoreSubsystemsAndSelfTests() throws {
        try ShortcutStoreSelfTest.run()
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

        let singleLineHeight = valueField.frame.height

        // 3. Type multiline value using Shift-Enter (insertNewlineIgnoringFieldEditor:) and verify no recursion + height growth
        valueEditor.string = "https://one.example.com"
        valueEditor.setSelectedRange(NSRange(location: valueEditor.string.count, length: 0))
        valueField.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: valueField))

        let handledShiftEnter = valueField.delegate?.control?(
            valueField,
            textView: valueEditor,
            doCommandBy: #selector(NSResponder.insertNewlineIgnoringFieldEditor(_:))
        ) ?? false
        XCTAssertTrue(handledShiftEnter, "Shift-Enter should insert newline without ending editing")
        valueEditor.insertText("https://two.example.com", replacementRange: valueEditor.selectedRange())
        valueField.delegate?.controlTextDidChange?(Notification(name: NSControl.textDidChangeNotification, object: valueField))
        pumpRunLoop()

        XCTAssertEqual(editSession.draftValue, "https://one.example.com\nhttps://two.example.com")
        XCTAssertGreaterThan(
            valueField.frame.height,
            singleLineHeight,
            "Multiline InlineTextEditor should grow vertically when newline is inserted"
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
        XCTAssertEqual(savedEntries.first?.value, "https://one.example.com\nhttps://two.example.com")
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
