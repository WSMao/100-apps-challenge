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
        XCTAssertTrue(app.staticTexts["Build"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["First line\nSecond line"].exists)

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

    private func enterText(_ text: String, into identifier: String) {
        let editor = element(identifier)
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.click()
        editor.typeText(text)
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }
}
