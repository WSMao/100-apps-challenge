import AppKit
import XCTest

final class KeyValueCheatsheetUITests: XCTestCase {
    private var app: XCUIApplication!
    private var testDataDirectory: URL!

    override func setUpWithError() throws {
        continueAfterFailure = false
        testDataDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent(".ui-test-data", isDirectory: true)
        if FileManager.default.fileExists(atPath: testDataDirectory.path) {
            try FileManager.default.removeItem(at: testDataDirectory)
        }

        app = XCUIApplication()
        app.launchEnvironment["DASHCUES_UI_TESTING"] = "1"
        app.launchEnvironment["DASHCUES_UI_TEST_RESET_NAVIGATION"] = "1"
        app.launchEnvironment["DASHCUES_UI_TEST_STORAGE_PATH"] = testDataDirectory
            .appendingPathComponent("shortcuts.json")
            .path
        app.launch()
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 10))
    }

    override func tearDownWithError() throws {
        app?.terminate()
        if let testDataDirectory, FileManager.default.fileExists(atPath: testDataDirectory.path) {
            try FileManager.default.removeItem(at: testDataDirectory)
        }
    }

    func testMainWindowCanCreateAndManageKeyValueCheatsheet() throws {
        let keyValueTab = app.buttons["dashboard.tab.key-value"]
        XCTAssertTrue(keyValueTab.waitForExistence(timeout: 5))
        keyValueTab.click()

        let createCheatsheet = app.buttons["key-value.create-cheatsheet"]
        XCTAssertTrue(createCheatsheet.waitForExistence(timeout: 5))
        createCheatsheet.click()

        let nameField = app.textFields["key-value.cheatsheet-name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.click()
        nameField.typeText("Commands")
        app.buttons["key-value.save-cheatsheet-name"].click()

        app.buttons["key-value.add-first-entry"].click()
        enterText("Build", into: "key-value.entry-key")
        enterText("First line\nSecond line", into: "key-value.entry-value")
        app.buttons["key-value.save-entry"].click()
        let preview = entryPreviews.firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 5))
        preview.click()
        XCTAssertTrue(app.staticTexts["key-value.entry-value-text"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["key-value.entry-value-text"].label, "First line\nSecond line")

        let editEntry = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.edit-entry.")
        ).firstMatch
        XCTAssertTrue(editEntry.waitForExistence(timeout: 5))
        editEntry.click()
        let valueEditor = element("key-value.entry-value")
        valueEditor.click()
        app.typeKey("a", modifierFlags: .command)
        valueEditor.typeText("Updated value")
        app.buttons["key-value.save-entry"].click()
        XCTAssertTrue(app.staticTexts["Updated value"].waitForExistence(timeout: 5))

        app.buttons["key-value.add-entry"].click()
        enterText(" build ", into: "key-value.entry-key")
        enterText("Duplicate keys are allowed", into: "key-value.entry-value")
        XCTAssertTrue(app.staticTexts["key-value.duplicate-key-warning"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["key-value.save-entry"].isEnabled)
        app.buttons["key-value.save-entry"].click()

        app.buttons["key-value.rename-cheatsheet"].click()
        let renameField = app.textFields["key-value.cheatsheet-name"]
        XCTAssertTrue(renameField.waitForExistence(timeout: 5))
        renameField.click()
        app.typeKey("a", modifierFlags: .command)
        renameField.typeText("Builds")
        app.buttons["key-value.save-cheatsheet-name"].click()
        XCTAssertTrue(app.staticTexts["Builds"].waitForExistence(timeout: 5))

        let deleteEntry = app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.delete-entry.")
        ).firstMatch
        XCTAssertTrue(deleteEntry.waitForExistence(timeout: 5))
        deleteEntry.click()

        app.buttons["key-value.delete-cheatsheet"].click()
        app.buttons["刪除"].click()
        XCTAssertTrue(app.buttons["key-value.create-cheatsheet"].waitForExistence(timeout: 5))
    }

    func testCollapsedPreviewIsSingleLineTruncatedAndExpandsFullMultilineText() throws {
        createCheatsheet(named: "Commands")
        let key = "Build\nTarget"
        let value = "Long response\n" + String(repeating: "A", count: 180)
        addEntry(key: key, value: value)

        let preview = entryPreviews.firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 5))
        XCTAssertTrue(preview.label.hasPrefix("Build Target — Long response"))
        XCTAssertTrue(preview.label.hasSuffix("…"))
        XCTAssertFalse(preview.label.contains(String(repeating: "A", count: 180)))

        preview.click()
        let expandedKey = app.staticTexts["key-value.entry-key-text"]
        let expandedValue = app.staticTexts["key-value.entry-value-text"]
        XCTAssertTrue(expandedKey.waitForExistence(timeout: 5))
        XCTAssertTrue(expandedValue.waitForExistence(timeout: 5))
        XCTAssertEqual(expandedKey.label, key)
        XCTAssertEqual(expandedValue.label, value)
    }

    func testEntryOrderCanBeDraggedAndPersistsAfterRelaunch() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "First", value: "One")
        addEntry(key: "Second", value: "Two")

        let previews = entryPreviews
        XCTAssertEqual(previews.count, 2)
        let first = previews.element(boundBy: 0)
        let second = previews.element(boundBy: 1)
        first.press(forDuration: 1, thenDragTo: second)
        XCTAssertTrue(previews.element(boundBy: 0).label.hasPrefix("Second —"))

        relaunch()
        app.buttons["dashboard.tab.key-value"].click()
        XCTAssertTrue(previews.firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(previews.element(boundBy: 0).label.hasPrefix("Second —"))
        XCTAssertTrue(previews.element(boundBy: 1).label.hasPrefix("First —"))
    }

    func testKeyAndValueCopyIndependentlyWithSuccessFeedback() throws {
        createCheatsheet(named: "Prompts")
        let key = "Prompt\nTitle"
        let value = "First line\nSecond line\n"
        addEntry(key: key, value: value)
        entryPreviews.firstMatch.click()

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
        entryPreviews.firstMatch.click()
        copyButton(containing: "copy-key").click()

        let error = app.alerts["無法完成操作"]
        XCTAssertTrue(error.waitForExistence(timeout: 5))
        XCTAssertTrue(error.staticTexts["無法複製 Key 到剪貼簿。"].exists)
        XCTAssertFalse(app.staticTexts["key-value.copy-feedback"].exists)
    }

    func testSearchAcrossCheatsheetsExpandsResultAndJumpsToItsSheet() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Open", value: "Launch the terminal")

        app.buttons["key-value.add-cheatsheet"].click()
        let nameField = app.textFields["key-value.cheatsheet-name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.typeText("Prompts")
        app.buttons["key-value.save-cheatsheet-name"].click()
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

        let selectedCheatsheet = app.descendants(matching: .any)["key-value.cheatsheet-selector"]
        let targetPreview = entryPreviews.firstMatch
        XCTAssertTrue(targetPreview.waitForExistence(timeout: 5))
        XCTAssertTrue(targetPreview.label.hasPrefix("Desired output —"))
        XCTAssertEqual(selectedCheatsheet.value as? String, "Prompts")
        XCTAssertEqual(app.staticTexts["key-value.entry-value-text"].label, "Write in a concise tone")
    }

    func testMenuBarBrowsesSearchesAndCopiesKeyValueWithSharedNavigation() throws {
        createCheatsheet(named: "Commands")
        addEntry(key: "Build", value: "Compile the project")
        app.buttons["key-value.add-cheatsheet"].click()
        let nameField = app.textFields["key-value.cheatsheet-name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.typeText("Prompts")
        app.buttons["key-value.save-cheatsheet-name"].click()
        addEntry(key: "Desired output", value: "Write in a concise tone")
        selectCheatsheet(named: "Commands")

        app.windows.firstMatch.close()
        let statusItem = element("dashcues.status-item")
        XCTAssertTrue(statusItem.waitForExistence(timeout: 5))
        statusItem.click()

        let keyValueTab = app.buttons["popover.tab.key-value"]
        XCTAssertTrue(keyValueTab.waitForExistence(timeout: 5))
        keyValueTab.click()
        let selector = element("key-value.cheatsheet-selector")
        XCTAssertTrue(selector.waitForExistence(timeout: 5))
        XCTAssertEqual(selector.value as? String, "Commands")
        XCTAssertFalse(app.buttons["key-value.add-cheatsheet"].exists)
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
        let dashboardKeyValueTab = app.buttons["dashboard.tab.key-value"]
        XCTAssertTrue(dashboardKeyValueTab.waitForExistence(timeout: 5))
        XCTAssertEqual(dashboardKeyValueTab.value as? String, "已選取")
        XCTAssertEqual(element("key-value.cheatsheet-selector").value as? String, "Prompts")

        app.windows.firstMatch.close()
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

        app.windows.firstMatch.close()
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

    private var entryPreviews: XCUIElementQuery {
        app.buttons.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "key-value.entry-preview.")
        )
    }

    private func enterText(_ text: String, into identifier: String) {
        let editor = element(identifier)
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.click()
        editor.typeText(text)
    }

    private func createCheatsheet(named name: String) {
        app.buttons["dashboard.tab.key-value"].click()
        app.buttons["key-value.create-cheatsheet"].click()
        let nameField = app.textFields["key-value.cheatsheet-name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.typeText(name)
        app.buttons["key-value.save-cheatsheet-name"].click()
        XCTAssertTrue(app.buttons["key-value.add-entry"].waitForExistence(timeout: 5))
    }

    private func addEntry(key: String, value: String) {
        app.buttons["key-value.add-entry"].click()
        enterText(key, into: "key-value.entry-key")
        enterText(value, into: "key-value.entry-value")
        app.buttons["key-value.save-entry"].click()
        XCTAssertTrue(entryPreviews.firstMatch.waitForExistence(timeout: 5))
    }

    private func selectCheatsheet(named name: String) {
        let selector = element("key-value.cheatsheet-selector")
        XCTAssertTrue(selector.waitForExistence(timeout: 5))
        selector.click()
        let option = app.menuItems[name]
        if option.waitForExistence(timeout: 2) {
            option.click()
        } else {
            app.buttons[name].click()
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
        app.launchEnvironment["DASHCUES_UI_TEST_RESET_NAVIGATION"] = nil
        app.launchEnvironment["DASHCUES_UI_TEST_CLIPBOARD_FAILURE"] = clipboardFailure ? "1" : nil
        app.launch()
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: 10))
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }
}
