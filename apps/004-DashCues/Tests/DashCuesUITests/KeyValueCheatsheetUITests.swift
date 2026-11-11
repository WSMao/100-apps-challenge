import AppKit
import XCTest

final class KeyValueCheatsheetUITests: XCTestCase {
    private var app: XCUIApplication!
    private var testDataDirectory: URL!
    private var defaultsSuiteName: String!

    override func setUpWithError() throws {
        continueAfterFailure = false
        let testID = UUID().uuidString
        defaultsSuiteName = "DashCues.UITests.\(testID)"
        testDataDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("dashcues-uitest-\(testID)", isDirectory: true)

        app = XCUIApplication()
        app.launchEnvironment["DASHCUES_UI_TESTING"] = "1"
        app.launchEnvironment["DASHCUES_UI_TEST_DEFAULTS_SUITE"] = defaultsSuiteName
        app.launchEnvironment["DASHCUES_UI_TEST_STORAGE_PATH"] = testDataDirectory
            .appendingPathComponent("shortcuts.json")
            .path
        app.launch()
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 10))
    }

    override func tearDownWithError() throws {
        app?.terminate()
        if let defaultsSuiteName {
            UserDefaults(suiteName: defaultsSuiteName)?.removePersistentDomain(forName: defaultsSuiteName)
        }
        if let testDataDirectory, FileManager.default.fileExists(atPath: testDataDirectory.path) {
            try FileManager.default.removeItem(at: testDataDirectory)
        }
    }

    func testMainWindowCanCreateAndManageKeyValueCheatsheet() throws {
        createCheatsheet(named: "Commands")

        app.buttons["key-value.add-first-entry"].click()
        typeMultiline("Build", into: "key-value.entry-key")
        typeMultiline("First line\nSecond line", into: "key-value.entry-value")
        app.typeKey(.return, modifierFlags: [])
        let keyCell = keyCells.firstMatch
        XCTAssertTrue(keyCell.waitForExistence(timeout: 5))
        XCTAssertEqual(valueCells.firstMatch.label, "First line\nSecond line")

        valueCells.firstMatch.doubleClick()
        let valueEditor = element("key-value.entry-value")
        XCTAssertTrue(valueEditor.waitForExistence(timeout: 5))
        app.typeKey("a", modifierFlags: .command)
        valueEditor.typeText("Updated value")
        app.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(app.staticTexts["Updated value"].waitForExistence(timeout: 5))

        app.buttons["key-value.add-entry"].click()
        typeMultiline(" build ", into: "key-value.entry-key")
        typeMultiline("Duplicate keys are allowed", into: "key-value.entry-value")
        XCTAssertTrue(app.staticTexts["key-value.duplicate-key-warning"].waitForExistence(timeout: 5))
        app.typeKey(.return, modifierFlags: [])
        XCTAssertEqual(keyCells.count, 2)

        let deleteEntry = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.delete-entry.")
        ).firstMatch
        XCTAssertTrue(deleteEntry.waitForExistence(timeout: 5))
        deleteEntry.click()
        app.buttons["刪除"].click()
        XCTAssertTrue(keyCells.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(keyCells.count, 1)
    }

    func testCollapsedPreviewIsSingleLineTruncatedAndExpandsFullMultilineText() throws {
        createCheatsheet(named: "Commands")
        let key = "Build\nTarget"
        let value = "Long response\n" + String(repeating: "A", count: 180)
        addEntry(key: key, value: value)

        XCTAssertTrue(app.staticTexts["Key"].exists && app.staticTexts["Value"].exists)
        let keyCell = keyCells.firstMatch
        let valueCell = valueCells.firstMatch
        XCTAssertTrue(valueCell.waitForExistence(timeout: 5))
        let collapsedHeight = valueCell.frame.height

        valueCell.click()
        XCTAssertGreaterThan(valueCell.frame.height, collapsedHeight)
        XCTAssertEqual(keyCell.label, key)
        XCTAssertEqual(valueCell.label, value)

        valueCell.click()
        XCTAssertEqual(valueCell.frame.height, collapsedHeight, accuracy: 1)
    }

    func testDoubleClickEditsClickedColumnWithoutTogglingAndEscRestores() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "swift build")

        let keyCell = keyCells.firstMatch
        let collapsedHeight = keyCell.frame.height
        valueCells.firstMatch.doubleClick()
        let valueEditor = element("key-value.entry-value")
        XCTAssertTrue(valueEditor.waitForExistence(timeout: 5))
        XCTAssertEqual(valueEditor.value as? String, "swift build")

        valueEditor.typeText(" --verbose")
        app.typeKey(.escape, modifierFlags: [])
        XCTAssertFalse(element("key-value.entry-value").exists)
        XCTAssertEqual(valueCells.firstMatch.label, "swift build")
        XCTAssertEqual(keyCells.firstMatch.frame.height, collapsedHeight, accuracy: 1)
    }

    func testShiftEnterInsertsNewlineAndBlankEntryIsRejected() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "one")

        keyCells.firstMatch.doubleClick()
        app.typeKey("a", modifierFlags: .command)
        app.typeKey(.delete, modifierFlags: [])
        element("key-value.entry-value").click()
        app.typeKey("a", modifierFlags: .command)
        app.typeKey(.delete, modifierFlags: [])
        app.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(app.staticTexts["key-value.validation-message"].waitForExistence(timeout: 5))

        typeMultiline("first\nsecond", into: "key-value.entry-value")
        app.typeKey(.return, modifierFlags: [])
        XCTAssertEqual(valueCells.firstMatch.label, "first\nsecond")
    }

    func testUnsavedEditPromptsBeforeSwitchingSheetAndCanBeDiscarded() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "swift build")
        createCheatsheet(named: "Prompts")
        selectCheatsheet(named: "Commands")

        valueCells.firstMatch.doubleClick()
        element("key-value.entry-value").typeText(" changed")
        shortcutSheetTab.click()
        XCTAssertTrue(app.buttons["繼續編輯"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["儲存"].exists)
        app.buttons["繼續編輯"].click()
        XCTAssertTrue(element("key-value.entry-value").exists)

        shortcutSheetTab.click()
        app.buttons["捨棄"].click()
        XCTAssertEqual(shortcutSheetTab.value as? String, "已選取")
        keyValueTab.click()
        XCTAssertEqual(valueCells.firstMatch.label, "swift build")
    }

    func testCopyShowsCheckFeedbackAndDoesNotExpandOrEdit() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "swift build")
        let copy = copyButton(containing: "copy-value")
        XCTAssertEqual(copy.label, "複製 Value")
        let collapsedHeight = valueCells.firstMatch.frame.height
        copy.click()
        XCTAssertEqual(NSPasteboard.general.string(forType: .string), "swift build")
        XCTAssertEqual(copyButton(containing: "copy-value").label, "已複製 Value")
        XCTAssertFalse(element("key-value.entry-value").exists)
        XCTAssertEqual(valueCells.firstMatch.frame.height, collapsedHeight, accuracy: 1)
    }

    func testEntryOrderCanBeDraggedAndPersistsAfterRelaunch() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "First", value: "One")
        addEntry(key: "Second", value: "Two")

        let previews = keyCells
        XCTAssertEqual(previews.count, 2)
        let first = previews.element(boundBy: 0)
        let second = previews.element(boundBy: 1)
        first.press(forDuration: 1, thenDragTo: second)
        XCTAssertTrue(previews.element(boundBy: 0).label == "Second")

        relaunch()
        keyValueTab.click()
        XCTAssertTrue(previews.firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(previews.element(boundBy: 0).label == "Second")
        XCTAssertTrue(previews.element(boundBy: 1).label == "First")
    }

    func testNavigationPreferencesPersistAcrossRelaunchWithinTest() throws {
        createCheatsheet(named: "Commands")
        createCheatsheet(named: "Prompts")
        relaunch()
        XCTAssertEqual(keyValueTab.value as? String, "已選取")
        XCTAssertTrue(keyValueTab.label.contains("Prompts"))
    }

    func testKeyAndValueCopyIndependentlyWithSuccessFeedback() throws {
        createCheatsheet(named: "Prompts")
        let key = "Prompt\nTitle"
        let value = "First line\nSecond line\n"
        addEntry(key: key, value: value)

        copyButton(containing: "copy-key").click()
        XCTAssertEqual(NSPasteboard.general.string(forType: .string), key)
        XCTAssertEqual(app.staticTexts["key-value.copy-feedback"].label, "Key 已複製。")

        copyButton(containing: "copy-value").click()
        XCTAssertEqual(NSPasteboard.general.string(forType: .string), value)
        XCTAssertEqual(app.staticTexts["key-value.copy-feedback"].label, "Value 已複製。")
    }

    func testClipboardFailureIsShownAsAnError() throws {
        relaunch(clipboardFailure: true)
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "Compile the project")
        copyButton(containing: "copy-key").click()

        let error = app.alerts["無法完成操作"]
        XCTAssertTrue(error.waitForExistence(timeout: 5))
        XCTAssertTrue(error.staticTexts["無法複製 Key 到剪貼簿。"].exists)
        XCTAssertFalse(app.staticTexts["key-value.copy-feedback"].exists)
        XCTAssertFalse(element("key-value.entry-key").exists)
    }

    func testSearchAcrossCheatsheetsExpandsResultAndJumpsToItsSheet() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Open", value: "Launch the terminal")

        createCheatsheet(named: "Prompts")
        addEntry(key: "Desired output", value: "Write in a concise tone")

        let searchField = app.textFields["key-value.search"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 5))
        searchField.click()
        searchField.typeText("concise")

        let resultSheet = app.staticTexts.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.sheet.")
        ).firstMatch
        XCTAssertTrue(resultSheet.waitForExistence(timeout: 5))
        XCTAssertEqual(resultSheet.label, "Prompts")

        let resultPreview = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.preview.")
        ).firstMatch
        XCTAssertTrue(resultPreview.waitForExistence(timeout: 5))
        resultPreview.click()
        let resultValue = app.staticTexts.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.value-text.")
        ).firstMatch
        XCTAssertTrue(resultValue.waitForExistence(timeout: 5))
        XCTAssertEqual(resultValue.label, "Write in a concise tone")

        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.jump.")
        ).firstMatch.click()

        let targetCell = keyCells.firstMatch
        XCTAssertTrue(targetCell.waitForExistence(timeout: 5))
        XCTAssertEqual(targetCell.label, "Desired output")
        XCTAssertEqual(valueCells.firstMatch.label, "Write in a concise tone")
    }

    func testMenuBarBrowsesSearchesAndCopiesKeyValueWithSharedNavigation() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "Compile the project")
        createCheatsheet(named: "Prompts")
        addEntry(key: "Desired output", value: "Write in a concise tone")
        selectCheatsheet(named: "Commands")

        app.typeKey("w", modifierFlags: .command)
        let statusItem = element("dashcues.status-item")
        XCTAssertTrue(statusItem.waitForExistence(timeout: 5))
        statusItem.click()

        let keyValueTab = app.buttons["popover.tab.key-value"]
        XCTAssertTrue(keyValueTab.waitForExistence(timeout: 5))
        keyValueTab.click()
        XCTAssertFalse(app.buttons["dashboard.add-sheet"].exists)
        XCTAssertFalse(app.buttons["key-value.add-entry"].exists)

        selectCheatsheet(named: "Prompts")
        let search = app.textFields["key-value.search"]
        search.click()
        search.typeText("concise")
        let resultContext = app.staticTexts.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.sheet.")
        ).firstMatch
        XCTAssertTrue(resultContext.waitForExistence(timeout: 5))
        XCTAssertEqual(resultContext.label, "Prompts")

        let resultPreview = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.preview.")
        ).firstMatch
        XCTAssertTrue(resultPreview.waitForExistence(timeout: 5))
        resultPreview.click()
        let resultValue = app.staticTexts.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.value-text.")
        ).firstMatch
        XCTAssertTrue(resultValue.waitForExistence(timeout: 5))
        XCTAssertEqual(resultValue.label, "Write in a concise tone")

        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.copy-key.")
        ).firstMatch.click()
        XCTAssertEqual(NSPasteboard.general.string(forType: .string), "Desired output")
        XCTAssertTrue(app.staticTexts["key-value.copy-feedback"].waitForExistence(timeout: 5))

        app.buttons["popover.open-dashboard"].click()
        let dashboardKeyValueTab = keyValueTab
        XCTAssertTrue(dashboardKeyValueTab.waitForExistence(timeout: 5))
        XCTAssertEqual(dashboardKeyValueTab.value as? String, "已選取")

        app.typeKey("w", modifierFlags: .command)
        XCTAssertTrue(element("dashcues.status-item").waitForExistence(timeout: 5))
        element("dashcues.status-item").click()
        XCTAssertTrue(app.buttons["popover.tab.shortcuts"].waitForExistence(timeout: 5))
        let shortcutsTab = app.buttons["popover.tab.shortcuts"]
        shortcutsTab.click()
        XCTAssertEqual(shortcutsTab.value as? String, "已選取")
    }

    func testMenuBarSurfacesClipboardFailure() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "Compile the project")
        relaunch(clipboardFailure: true)

        app.typeKey("w", modifierFlags: .command)
        let statusItem = element("dashcues.status-item")
        XCTAssertTrue(statusItem.waitForExistence(timeout: 5))
        statusItem.click()
        app.buttons["popover.tab.key-value"].click()
        entryPreviews.firstMatch.click()
        copyButton(containing: "copy-key").click()

        let error = app.alerts["無法完成操作"]
        XCTAssertTrue(error.waitForExistence(timeout: 5))
        XCTAssertTrue(error.staticTexts["無法複製 Key 到剪貼簿。"].exists)
        XCTAssertFalse(app.staticTexts["key-value.copy-feedback"].exists)
    }

    func testMenuBarEmptyCheatsheetCannotCreateEntries() throws {
        createCheatsheet(named: "Empty")
        app.typeKey("w", modifierFlags: .command)
        element("dashcues.status-item").click()
        XCTAssertTrue(app.buttons["popover.tab.key-value"].waitForExistence(timeout: 5))
        app.buttons["popover.tab.key-value"].click()
        XCTAssertTrue(element("key-value.read-only").waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["key-value.add-first-entry"].exists)
        XCTAssertFalse(app.buttons["key-value.add-entry"].exists)
        XCTAssertFalse(app.buttons["dashboard.add-sheet"].exists)
        XCTAssertFalse(app.buttons["key-value.save-entry"].exists)
    }

    func testMenuBarSearchEditingKeysStayInSearchField() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "Compile the project")
        app.typeKey("w", modifierFlags: .command)
        element("dashcues.status-item").click()
        XCTAssertTrue(app.buttons["popover.tab.key-value"].waitForExistence(timeout: 5))
        app.buttons["popover.tab.key-value"].click()
        let search = app.textFields["key-value.search"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.click()
        search.typeText("buld")
        app.typeKey(.leftArrow, modifierFlags: [])
        app.typeKey(.leftArrow, modifierFlags: [])
        search.typeText("i")
        XCTAssertEqual(search.value as? String, "build")
        app.typeKey(.downArrow, modifierFlags: [])
        app.typeKey(.upArrow, modifierFlags: [])
        XCTAssertTrue(app.buttons["popover.tab.key-value"].exists)
        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(app.buttons["popover.tab.key-value"].exists)
    }

    func testMenuBarSearchJumpOpensDashboardAtMatchingEntry() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "Compile the project")
        createCheatsheet(named: "Prompts")
        addEntry(key: "Desired output", value: "Write in a concise tone")
        selectCheatsheet(named: "Commands")
        element("dashboard.application.com.apple.Safari").click()
        element("dashcues.status-item").click()
        XCTAssertTrue(app.buttons["popover.tab.key-value"].waitForExistence(timeout: 5))
        app.buttons["popover.application.com.apple.finder"].click()
        app.buttons["popover.tab.key-value"].click()
        let search = app.textFields["key-value.search"]
        search.click()
        search.typeText("concise")
        let jump = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.search-result.jump.")
        ).firstMatch
        XCTAssertTrue(jump.waitForExistence(timeout: 5))
        jump.click()
        XCTAssertTrue(keyValueTab.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["com.apple.finder"].waitForExistence(timeout: 5))
        XCTAssertEqual(keyCells.firstMatch.label, "Desired output")
        XCTAssertEqual(valueCells.firstMatch.label, "Write in a concise tone")
    }

    private var entryPreviews: XCUIElementQuery {
        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.entry-preview.")
        )
    }

    private var keyCells: XCUIElementQuery {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'key-value.key-cell.'"))
    }

    private var valueCells: XCUIElementQuery {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'key-value.value-cell.'"))
    }

    /// Types text where "\n" becomes Shift-Enter, because plain Enter saves the row.
    private func typeMultiline(_ text: String, into identifier: String) {
        let editor = element(identifier)
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
        for (index, line) in text.components(separatedBy: "\n").enumerated() {
            if index > 0 { app.typeKey(.return, modifierFlags: .shift) }
            if !line.isEmpty { editor.typeText(line) }
        }
    }

    private func enterText(_ text: String, into identifier: String) {
        let editor = element(identifier)
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
        editor.typeText(text)
    }

    private func createCheatsheet(named name: String) {
        let addSheet = element("dashboard.add-sheet")
        if addSheet.waitForExistence(timeout: 5) {
            addSheet.click()
            let addKV = app.menuItems["Key-Value 工作表…"].exists
                ? app.menuItems["Key-Value 工作表…"]
                : app.menuItems["dashboard.add-key-value-sheet"]
            XCTAssertTrue(addKV.waitForExistence(timeout: 5))
            addKV.click()
        } else {
            let emptyKV = element("dashboard.empty-create-key-value-sheet")
            XCTAssertTrue(emptyKV.waitForExistence(timeout: 5))
            emptyKV.click()
        }
        let nameField = app.textFields["dashboard.sheet-name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.typeText(name)
        element("dashboard.save-sheet-name").click()
        let createdTab = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        XCTAssertTrue(createdTab.waitForExistence(timeout: 5))
    }

    private func addEntry(key: String, value: String) {
        let addButton = element("key-value.add-entry")
        if addButton.waitForExistence(timeout: 3) {
            addButton.click()
        } else {
            let firstButton = element("key-value.add-first-entry")
            XCTAssertTrue(firstButton.waitForExistence(timeout: 3))
            firstButton.click()
        }
        typeMultiline(key, into: "key-value.entry-key")
        typeMultiline(value, into: "key-value.entry-value")
        app.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(keyCells.firstMatch.waitForExistence(timeout: 5))
    }

    private func selectCheatsheet(named name: String) {
        let tab = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        if tab.waitForExistence(timeout: 3) {
            tab.click()
            return
        }
        let overflow = app.buttons["dashboard.tab-overflow-menu"]
        if overflow.exists {
            overflow.click()
            let item = app.menuItems[name]
            if item.waitForExistence(timeout: 2) {
                item.click()
            }
        }
    }

    private func copyButton(containing field: String) -> XCUIElement {
        app.buttons.matching(
            NSPredicate(format: "identifier CONTAINS %@", field)
        ).firstMatch
    }

    private func relaunch(clipboardFailure: Bool = false) {
        if app.state == .runningForeground {
            app.terminate()
        }
        app.launchEnvironment["DASHCUES_UI_TEST_CLIPBOARD_FAILURE"] = clipboardFailure ? "1" : nil
        app.launch()
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 10))
    }

    /// The first Key-Value tab: the per-sheet tab when one exists, otherwise the "create" entry tab.
    private var keyValueTab: XCUIElement {
        app.buttons.matching(NSPredicate(
            format: "identifier == 'dashboard.tab.key-value' OR identifier BEGINSWITH 'dashboard.sheet-tab.key-value.' OR identifier BEGINSWITH 'popover.sheet-tab.' OR identifier == 'popover.tab.key-value'"
        )).firstMatch
    }

    private var shortcutSheetTab: XCUIElement {
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'dashboard.sheet-tab.shortcuts.'")).firstMatch
    }

    func testMainWindowShowsSelectableSheetTabsNextToLogo() throws {
        XCTAssertTrue(shortcutSheetTab.waitForExistence(timeout: 5))
        XCTAssertTrue(shortcutSheetTab.label.contains("快捷鍵"))
        XCTAssertEqual(shortcutSheetTab.value as? String, "已選取")

        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "swift build")
        XCTAssertTrue(keyValueTab.label.contains("Commands"))
        XCTAssertEqual(keyValueTab.value as? String, "已選取")
        XCTAssertEqual(shortcutSheetTab.value as? String, "未選取")

        shortcutSheetTab.click()
        XCTAssertEqual(shortcutSheetTab.value as? String, "已選取")
        XCTAssertFalse(keyCells.firstMatch.exists)

        keyValueTab.click()
        XCTAssertTrue(keyCells.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(keyValueTab.value as? String, "已選取")
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }
}
