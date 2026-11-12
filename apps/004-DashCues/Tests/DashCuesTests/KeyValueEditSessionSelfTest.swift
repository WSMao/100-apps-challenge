@testable import DashCuesCore
import Foundation

/// Behavior checks for inline Key-Value table editing, exercised only through `KeyValueEditSession`'s public API.
enum KeyValueEditSessionSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        let appID = try store.addApplication(name: "Edit Session App", bundleIdentifier: "com.example.edit-session", symbolName: "app")
        let sheetID = try store.createKeyValueCheatsheet(name: "Commands", applicationID: appID)
        let build = KeyValueEntry(id: "build", key: "Build", value: "swift build")
        let test = KeyValueEntry(id: "test", key: "Test", value: "swift test")
        try store.saveKeyValueEntry(build, cheatsheetID: sheetID, applicationID: appID)
        try store.saveKeyValueEntry(test, cheatsheetID: sheetID, applicationID: appID)

        func entries() -> [KeyValueEntry] {
            store.application(id: appID)?.keyValueCheatsheets.first { $0.id == sheetID }?.entries ?? []
        }
        let session = KeyValueEditSession(store: store)

        // Editing starts in the clicked column and untouched drafts are not unsaved.
        let initialFocusToken = session.focusRequestToken
        session.begin(entry: build, column: .value, cheatsheetID: sheetID, applicationID: appID)
        try check(session.editingEntryID == "build" && session.focusColumn == .value, "Edit did not focus the clicked column.")
        try check(session.focusRequestToken > initialFocusToken, "Starting edit did not increment focusRequestToken.")
        let tokenAfterBegin = session.focusRequestToken
        session.focus(.key)
        try check(session.focusColumn == .key && session.focusRequestToken > tokenAfterBegin, "Programmatic column focus did not increment focusRequestToken.")
        let tokenAfterFocus = session.focusRequestToken
        session.syncFocusColumnFromUserInteraction(.value)
        try check(session.focusColumn == .value && session.focusRequestToken == tokenAfterFocus, "User interaction focus sync should not increment focusRequestToken.")
        try check(!session.hasUnsavedChanges, "Untouched draft counted as unsaved.")

        // Saving persists multiline text exactly.
        session.draftValue = "line one\nline two"
        try check(session.hasUnsavedChanges, "Changed draft was not unsaved.")
        try check(session.save(), "Valid edit did not save.")
        try check(entries().first?.value == "line one\nline two", "Saved multiline value changed.")
        try check(session.editingEntryID == nil, "Saving did not end editing.")

        // Cancel restores the saved value.
        session.begin(entry: entries()[0], column: .key, cheatsheetID: sheetID, applicationID: appID)
        session.draftKey = "Changed"
        session.cancel()
        try check(entries()[0].key == "Build" && session.editingEntryID == nil, "Cancel did not restore the saved value.")

        // Both fields blank is rejected and keeps editing; one blank field is allowed.
        session.begin(entry: entries()[1], column: .key, cheatsheetID: sheetID, applicationID: appID)
        session.draftKey = "  "
        session.draftValue = "\n"
        try check(!session.save(), "Fully blank entry saved.")
        try check(session.validationMessage != nil && session.editingEntryID == "test", "Blank entry did not report validation.")
        session.draftKey = ""
        session.draftValue = "only value"
        try check(session.save() && entries()[1].key.isEmpty, "Blank Key with Value was rejected.")

        // Duplicate keys warn (trimmed, case-insensitive) but never block saving.
        session.begin(entry: entries()[1], column: .key, cheatsheetID: sheetID, applicationID: appID)
        session.draftKey = " build "
        try check(session.hasDuplicateKeyWarning, "Duplicate key did not warn.")
        session.draftKey = "Unique"
        try check(!session.hasDuplicateKeyWarning, "Unique key warned.")
        session.draftKey = "BUILD"
        try check(session.save() && entries()[1].key == "BUILD", "Duplicate key blocked saving.")

        // New entries only exist once saved.
        let newID = session.beginNew(cheatsheetID: sheetID, applicationID: appID)
        try check(session.isNewEntry && session.editingEntryID == newID, "New entry did not start editing.")
        try check(entries().count == 2, "Unsaved new entry was persisted.")
        session.draftKey = "Deploy"
        try check(session.save() && entries().count == 3 && entries()[2].key == "Deploy", "New entry did not append on save.")
        _ = session.beginNew(cheatsheetID: sheetID, applicationID: appID)
        session.cancel()
        try check(entries().count == 3, "Cancelled new entry was persisted.")

        // Leaving without unsaved edits proceeds immediately.
        var left = 0
        session.requestLeave { left += 1 }
        try check(left == 1 && !session.isPromptingToLeave, "Leave without edits was interrupted.")

        // Leaving with unsaved edits asks first; each resolution behaves as offered.
        session.begin(entry: entries()[0], column: .key, cheatsheetID: sheetID, applicationID: appID)
        session.draftKey = "Dirty"
        session.requestLeave { left += 1 }
        try check(left == 1 && session.isPromptingToLeave, "Unsaved leave did not prompt.")
        let tokenBeforeContinue = session.focusRequestToken
        session.resolveLeave(.continueEditing)
        try check(left == 1 && !session.isPromptingToLeave && session.editingEntryID == "build", "Continue editing lost the edit.")
        try check(session.focusRequestToken > tokenBeforeContinue, "Continue editing should increment focusRequestToken to restore field focus.")
        session.requestLeave { left += 1 }
        session.resolveLeave(.discard)
        try check(left == 2 && entries()[0].key == "Build" && session.editingEntryID == nil, "Discard did not restore and leave.")
        session.begin(entry: entries()[0], column: .key, cheatsheetID: sheetID, applicationID: appID)
        session.draftKey = "Saved on leave"
        session.requestLeave { left += 1 }
        session.resolveLeave(.save)
        try check(left == 3 && entries()[0].key == "Saved on leave", "Save did not persist and leave.")
        session.begin(entry: entries()[0], column: .key, cheatsheetID: sheetID, applicationID: appID)
        session.draftKey = ""
        session.draftValue = ""
        session.requestLeave { left += 1 }
        session.resolveLeave(.save)
        try check(left == 3 && session.editingEntryID != nil && !session.isPromptingToLeave, "Invalid save on leave did not keep editing.")
        session.cancel()

        try store.deleteApplication(id: appID)
    }

    @MainActor
    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw EditSessionSelfTestError.failed(message) }
    }
}

private enum EditSessionSelfTestError: LocalizedError {
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .failed(let message): "Key-Value edit session: \(message)"
        }
    }
}
