import Combine
import Foundation

/// Owns the single in-progress inline edit of a Key-Value table row, including save/cancel,
/// validation, and the save/discard/continue prompt shown before navigating away.
@MainActor
final class KeyValueEditSession: ObservableObject {
    enum Column { case key, value }
    enum LeaveResolution { case save, discard, continueEditing }

    @Published private(set) var editingEntryID: String?
    @Published private(set) var focusColumn: Column = .key
    @Published private(set) var isNewEntry = false
    @Published private(set) var validationMessage: String?
    @Published private(set) var isPromptingToLeave = false
    @Published var draftKey = "" { didSet { validationMessage = nil } }
    @Published var draftValue = "" { didSet { validationMessage = nil } }

    private let store: ShortcutStore
    private var original = KeyValueEntry(id: "", key: "", value: "")
    private var cheatsheetID = ""
    private var applicationID = ""
    private var pendingLeave: (() -> Void)?

    init(store: ShortcutStore) {
        self.store = store
    }

    var isEditing: Bool { editingEntryID != nil }

    var hasUnsavedChanges: Bool {
        isEditing && (draftKey != original.key || draftValue != original.value)
    }

    var hasDuplicateKeyWarning: Bool {
        guard isEditing else { return false }
        return store.hasDuplicateKey(
            draftKey,
            cheatsheetID: cheatsheetID,
            applicationID: applicationID,
            excludingEntryID: original.id
        )
    }

    func begin(entry: KeyValueEntry, column: Column, cheatsheetID: String, applicationID: String) {
        if editingEntryID == entry.id {
            focusColumn = column
            return
        }
        guard !hasUnsavedChanges else {
            promptToLeave { [weak self] in
                self?.begin(entry: entry, column: column, cheatsheetID: cheatsheetID, applicationID: applicationID)
            }
            return
        }
        start(entry: entry, column: column, isNew: false, cheatsheetID: cheatsheetID, applicationID: applicationID)
    }

    @discardableResult
    func beginNew(cheatsheetID: String, applicationID: String) -> String? {
        let entry = KeyValueEntry(key: "", value: "")
        guard !hasUnsavedChanges else {
            promptToLeave { [weak self] in
                _ = self?.beginNew(cheatsheetID: cheatsheetID, applicationID: applicationID)
            }
            return nil
        }
        start(entry: entry, column: .key, isNew: true, cheatsheetID: cheatsheetID, applicationID: applicationID)
        return entry.id
    }

    /// Returns true when the edit was saved (or had nothing to save); false keeps editing.
    @discardableResult
    func save() -> Bool {
        guard isEditing else { return true }
        var entry = original
        entry.key = draftKey
        entry.value = draftValue
        guard !entry.isBlank else {
            validationMessage = ShortcutStoreError.invalidKeyValueEntry.localizedDescription
            return false
        }
        guard isNewEntry || hasUnsavedChanges else {
            finish()
            return true
        }
        do {
            try store.saveKeyValueEntry(entry, cheatsheetID: cheatsheetID, applicationID: applicationID)
        } catch {
            validationMessage = error.localizedDescription
            return false
        }
        finish()
        return true
    }

    func cancel() {
        finish()
    }

    /// Runs `proceed` now, or after the user resolves the unsaved-changes prompt.
    func requestLeave(_ proceed: @escaping () -> Void) {
        guard hasUnsavedChanges else {
            proceed()
            return
        }
        promptToLeave(proceed)
    }

    func resolveLeave(_ resolution: LeaveResolution) {
        guard isPromptingToLeave else { return }
        let proceed = pendingLeave
        isPromptingToLeave = false
        pendingLeave = nil
        switch resolution {
        case .continueEditing:
            return
        case .save:
            guard save() else { return }
        case .discard:
            finish()
        }
        proceed?()
    }

    private func promptToLeave(_ proceed: @escaping () -> Void) {
        pendingLeave = proceed
        isPromptingToLeave = true
    }

    private func start(entry: KeyValueEntry, column: Column, isNew: Bool, cheatsheetID: String, applicationID: String) {
        finish()
        original = entry
        self.cheatsheetID = cheatsheetID
        self.applicationID = applicationID
        isNewEntry = isNew
        draftKey = entry.key
        draftValue = entry.value
        focusColumn = column
        editingEntryID = entry.id
        validationMessage = nil
    }

    private func finish() {
        editingEntryID = nil
        isNewEntry = false
        validationMessage = nil
        draftKey = ""
        draftValue = ""
    }
}
