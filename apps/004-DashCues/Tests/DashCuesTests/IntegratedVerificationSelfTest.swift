@testable import DashCuesCore
import Foundation

/// Comprehensive end-to-end integration verification for Issue #21.
/// Simulates complete user lifecycle: legacy migration -> multi-sheet authoring -> layout customizations ->
/// cross-sheet search with history -> cross-window sync -> built-in app deletion -> backup round-trip.
enum IntegratedVerificationSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("dashcues-verify-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let storeURL = directory.appendingPathComponent("integrated-store.json")

        // 1. Legacy v1 data with key-value cheatsheets
        let legacyJSON = """
        {
          "schemaVersion": 1,
          "applications": [
            {
              "id": "com.apple.finder",
              "name": "Finder",
              "bundleIdentifier": "com.apple.finder",
              "symbolName": "folder",
              "isBuiltIn": true,
              "isPinned": false,
              "shortcuts": [],
              "tags": []
            },
            {
              "id": "app-legacy",
              "name": "Legacy Suite",
              "bundleIdentifier": "com.example.legacy",
              "symbolName": "macwindow",
              "isBuiltIn": false,
              "isPinned": false,
              "tags": ["Dev"],
              "shortcuts": [{
                "id": "s-legacy-1",
                "title": "Build",
                "keys": ["⌘", "B"],
                "tags": ["Dev"],
                "notes": "Compiles project"
              }],
              "keyValueCheatsheets": [{
                "id": "kv-legacy-1",
                "name": "快捷鍵",
                "entries": [{"id": "e-1", "key": "API_URL", "value": "https://api.example.com"}]
              }]
            }
          ],
          "hotKey": {"keyCode": 40, "modifiers": 6400}
        }
        """.data(using: .utf8)!
        try legacyJSON.write(to: storeURL)

        // Load store and verify legacy migration collision handling
        let integratedStore = try ShortcutStore(storageURL: storeURL)
        guard let migratedApp = integratedStore.application(id: "app-legacy") else {
            throw IntegratedVerificationSelfTestError.failed("Migrated app not found.")
        }

        // The default shortcuts sheet was named "快捷鍵 2" because "快捷鍵" was taken by KV sheet
        try check(
            migratedApp.sheets.map(\.name) == ["快捷鍵 2", "快捷鍵"],
            "Legacy migration collision resolution failed: expected ['快捷鍵 2', '快捷鍵'], got \(migratedApp.sheets.map(\.name))"
        )
        try check(migratedApp.sheets[0].kind == .shortcuts, "First sheet must be shortcuts.")
        try check(migratedApp.sheets[1].kind == .keyValue, "Second sheet must be keyValue.")

        // 2. Add extra sheets (shortcuts + key-value)
        let kv2ID = try integratedStore.createSheet(kind: .keyValue, name: "Database", applicationID: migratedApp.id)
        let s2ID = try integratedStore.createSheet(kind: .shortcuts, name: "Debugging", applicationID: migratedApp.id)

        try integratedStore.saveShortcut(
            ShortcutItem(title: "Step Over", keys: ["F10"]),
            applicationID: migratedApp.id,
            sheetID: s2ID
        )
        try integratedStore.saveKeyValueEntry(
            KeyValueEntry(key: "PORT", value: "5432"),
            cheatsheetID: kv2ID,
            applicationID: migratedApp.id
        )

        // 3. Customize table layout on kv2
        try integratedStore.updateKeyValueLayout(
            cheatsheetID: kv2ID,
            applicationID: migratedApp.id,
            columnOrder: [.value, .key],
            keyWidth: 180,
            valueWidth: 260
        )

        // 4. Cross-sheet search across key-value sheets
        let searchResults = integratedStore.searchKeyValueEntries("5432", applicationID: migratedApp.id)
        try check(searchResults.count == 1, "Expected 1 search result for '5432'.")
        try check(searchResults[0].cheatsheetID == kv2ID, "Search result should reference Database sheet.")
        try check(searchResults[0].cheatsheetName == "Database", "Search result name mismatch.")

        // 5. Search history session verification
        let recentStore = RecentSearchStore(defaults: UserDefaults(suiteName: "DashCues.Verify.Search")!)
        recentStore.record(query: "5432", for: migratedApp.id)
        let searchSession = SearchHistorySession(
            applicationID: migratedApp.id,
            recentStore: recentStore
        )
        try check(searchSession.history.contains("5432"), "Search history did not record query.")

        // 6. Cross-window selection sync via SharedContentNavigation
        let syncDefaults = UserDefaults(suiteName: "DashCues.Verify.Sync.\(UUID().uuidString)")!
        defer { syncDefaults.removePersistentDomain(forName: syncDefaults.description) }
        let navWindow1 = SharedContentNavigation(defaults: syncDefaults)
        let navWindow2 = SharedContentNavigation(defaults: syncDefaults)

        let targetSheet = try unwrap(integratedStore.application(id: migratedApp.id)?.sheets.first { $0.id == kv2ID })
        navWindow1.selectSheet(targetSheet, for: migratedApp.id)
        try check(
            navWindow2.selectedSheet(for: migratedApp.id, in: integratedStore.application(id: migratedApp.id)!.sheets)?.id == kv2ID,
            "Selection did not sync between window navigation instances."
        )

        // 7. Delete built-in application and verify persistence
        let finderID = "com.apple.finder"
        try integratedStore.deleteApplication(id: finderID)
        let reloadedStore = try ShortcutStore(storageURL: storeURL)
        try check(reloadedStore.application(id: finderID) == nil, "Finder deletion did not persist after reload.")

        // 8. Full backup round-trip
        let backupURL = directory.appendingPathComponent("full-backup.json")
        try reloadedStore.exportBackup(to: backupURL)

        let restoreURL = directory.appendingPathComponent("restored-store.json")
        let restoredStore = try ShortcutStore(storageURL: restoreURL)
        try restoredStore.restoreBackup(from: backupURL)

        guard let restoredApp = restoredStore.application(id: migratedApp.id) else {
            throw IntegratedVerificationSelfTestError.failed("Restored app not found.")
        }
        try check(restoredApp.sheets.count == 4, "Expected 4 sheets restored, got \(restoredApp.sheets.count).")
        let restoredKV2 = try unwrap(restoredApp.keyValueCheatsheets.first { $0.id == kv2ID })
        try check(restoredKV2.columnOrder == [.value, .key], "Column order not preserved in backup.")
        try check(restoredKV2.keyWidth == 180 && restoredKV2.valueWidth == 260, "Column widths not preserved in backup.")
        try check(restoredApp.sheetShortcuts(id: s2ID).map(\.title) == ["Step Over"], "Shortcuts not preserved.")

        // 9. Verify backup does not contain transient preference keys
        let backupContent = try String(contentsOf: backupURL, encoding: .utf8)
        try check(!backupContent.contains("DashCues.selectedCheatsheetIDs"), "Backup leaked selected cheatsheet IDs.")
        try check(!backupContent.contains("DashCues.recentContentSearches"), "Backup leaked search history.")

        print("Integrated verification checks passed.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw IntegratedVerificationSelfTestError.failed(message) }
    }

    private static func unwrap<T>(_ value: T?, _ message: String = "Unexpected nil") throws -> T {
        guard let value else { throw IntegratedVerificationSelfTestError.failed(message) }
        return value
    }
}

enum IntegratedVerificationSelfTestError: LocalizedError {
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .failed(let message):
            return "Integrated verification failed: \(message)"
        }
    }
}
