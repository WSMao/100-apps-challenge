@testable import DashCuesCore
import AppKit
import Foundation

/// TDD verification for synchronized sheet browsing in popover and pinned window.
enum SynchronizedSheetsSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        let suiteName = "DashCues.SelfTest.Sync.\(UUID().uuidString)"
        guard let testDefaults = UserDefaults(suiteName: suiteName) else {
            throw SynchronizedSheetsSelfTestError.failed("Could not create test preferences.")
        }
        defer { testDefaults.removePersistentDomain(forName: suiteName) }

        let contentNav1 = SharedContentNavigation(defaults: testDefaults)
        let contentNav2 = SharedContentNavigation(defaults: testDefaults)

        let appID = try store.addApplication(name: "Sync App", bundleIdentifier: "com.example.sync", symbolName: "app")
        let kv1 = try store.createSheet(kind: .keyValue, name: "KV Sheet 1", applicationID: appID)
        let kv2 = try store.createSheet(kind: .keyValue, name: "KV Sheet 2", applicationID: appID)
        _ = try unwrap(store.application(id: appID)?.sheets.first { $0.kind == .shortcuts }?.id)

        let e1 = KeyValueEntry(id: "e1", key: "SyncKey", value: "SyncVal")
        try store.saveKeyValueEntry(e1, cheatsheetID: kv1, applicationID: appID)

        // 1. Synchronized sheet selection across surfaces
        guard let app = store.application(id: appID) else {
            throw SynchronizedSheetsSelfTestError.failed("App not found.")
        }
        let sheetKV1 = try unwrap(app.sheets.first { $0.id == kv1 })
        contentNav1.selectSheet(sheetKV1, for: appID)
        try check(
            contentNav2.selectedSheet(for: appID, in: app.sheets)?.id == kv1,
            "Sheet selection in window 1 did not synchronize to window 2."
        )

        // 2. TabOverflowLayout in read-only surfaces
        let overflow = TabOverflowLayout(sheets: app.sheets, maxVisible: 2, selectedID: kv2)
        try check(overflow.visibleSheets.contains { $0.id == kv2 }, "Selected sheet must be in visible tabs.")
        try check(overflow.overflowSheets.count == 1, "Remaining sheet must be in overflow.")

        // 3. Pinned window keyboard navigation & read-only constraints
        var copiedText: String?
        let clipboard: (String) -> Bool = { text in
            copiedText = text
            return true
        }

        let pinnedNav = TableKeyboardNavigation(
            store: store,
            applicationID: appID,
            editSession: nil, // Read-only!
            clipboardWriter: clipboard
        )
        pinnedNav.isPinnedWindow = true
        pinnedNav.selectSheet(id: kv1)
        pinnedNav.focusArea = .table
        pinnedNav.selectedRowIndex = 0
        pinnedNav.selectedColumn = .key

        // Read-only Enter toggles row expansion instead of editing
        try check(!pinnedNav.expandedRowIDs.contains("e1"), "Row should initially be collapsed.")
        try check(pinnedNav.handleEnter(), "Enter should be handled in read-only mode.")
        try check(pinnedNav.expandedRowIDs.contains("e1"), "Enter in read-only mode must expand row.")
        try check(pinnedNav.handleEnter(), "Enter again should toggle expansion.")
        try check(!pinnedNav.expandedRowIDs.contains("e1"), "Enter again must collapse row.")

        // Left arrow from a collapsed row in pinned window returns to tabs (not sidebar)
        try check(pinnedNav.handleLeftArrow(), "Left arrow should be handled.")
        try check(pinnedNav.focusArea == .tabs, "In pinned window, left from collapsed row must return to tabs.")

        // Cmd-C in read-only navigation copies selected field
        pinnedNav.focusArea = .table
        pinnedNav.selectedColumn = .value
        try check(pinnedNav.handleCopy(), "Cmd-C should copy value.")
        try check(copiedText == "SyncVal", "Cmd-C did not copy value.")

        // 4. Preferences survive restart but are excluded from backups
        let restartedNav = SharedContentNavigation(defaults: testDefaults)
        try check(
            restartedNav.selectedSheet(for: appID, in: app.sheets)?.id == kv1,
            "Selected sheet did not persist across restart."
        )

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let backupURL = directory.appendingPathComponent("sync-backup.json")
        try store.exportBackup(to: backupURL)
        let backupData = try Data(contentsOf: backupURL)
        let json = String(data: backupData, encoding: .utf8) ?? ""
        try check(!json.contains("DashCues.selectedCheatsheetIDs"), "Backup should not include user navigation preferences.")

        // 5. PinnedMapWindowManager exists and can toggle application
        let manager = PinnedMapWindowManager(store: store, contentNavigation: contentNav1, clipboardWriter: clipboard)
        try check(!manager.isPinned(applicationID: appID), "App should not be pinned initially.")
        manager.toggle(application: app)
        try check(manager.isPinned(applicationID: appID), "App should be pinned after toggle.")
        manager.toggle(application: app)
        try check(!manager.isPinned(applicationID: appID), "App should be unpinned after second toggle.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw SynchronizedSheetsSelfTestError.failed(message) }
    }

    private static func unwrap<T>(_ value: T?, _ message: String = "Unexpected nil") throws -> T {
        guard let value else { throw SynchronizedSheetsSelfTestError.failed(message) }
        return value
    }
}

private enum SynchronizedSheetsSelfTestError: LocalizedError {
    case failed(String)
    var errorDescription: String? {
        switch self {
        case .failed(let message): message
        }
    }
}
