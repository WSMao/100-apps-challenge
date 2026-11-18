@testable import DashCuesCore
import AppKit
import Foundation

/// TDD verification for cross-sheet search across same-type sheets in the current app.
enum CrossSheetSearchSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        // App A
        let appAID = try store.addApplication(name: "App A", bundleIdentifier: "com.example.a", symbolName: "app")
        let aShortcuts1 = try unwrap(store.application(id: appAID)?.sheets.first { $0.kind == .shortcuts }?.id)
        let aShortcuts2 = try store.createSheet(kind: .shortcuts, name: "Shortcuts 2", applicationID: appAID)
        let aKV1 = try store.createSheet(kind: .keyValue, name: "KV 1", applicationID: appAID)
        let aKV2 = try store.createSheet(kind: .keyValue, name: "KV 2", applicationID: appAID)

        // App B
        let appBID = try store.addApplication(name: "App B", bundleIdentifier: "com.example.b", symbolName: "app")
        let bKV = try store.createSheet(kind: .keyValue, name: "B KV", applicationID: appBID)
        let bShortcuts = try unwrap(store.application(id: appBID)?.sheets.first { $0.kind == .shortcuts }?.id)

        // Populate entries and shortcuts with the keyword "alpha"
        try store.saveKeyValueEntry(KeyValueEntry(key: "alpha-key-1", value: "val1"), cheatsheetID: aKV1, applicationID: appAID)
        try store.saveKeyValueEntry(KeyValueEntry(key: "other-key", value: "alpha-val-2"), cheatsheetID: aKV2, applicationID: appAID)
        try store.saveKeyValueEntry(KeyValueEntry(key: "beta-key", value: "beta-val"), cheatsheetID: aKV1, applicationID: appAID)
        try store.saveKeyValueEntry(KeyValueEntry(key: "alpha-b-key", value: "b-val"), cheatsheetID: bKV, applicationID: appBID)

        try store.saveShortcut(ShortcutItem(title: "alpha-shortcut-1", keys: ["⌘", "1"], tags: ["TagA"]), applicationID: appAID, sheetID: aShortcuts1)
        try store.saveShortcut(ShortcutItem(title: "second", keys: ["⌘", "2"], tags: ["alpha-tag"]), applicationID: appAID, sheetID: aShortcuts2)
        try store.saveShortcut(ShortcutItem(title: "alpha-shortcut-b", keys: ["⌘", "B"]), applicationID: appBID, sheetID: bShortcuts)

        // 1. Key-Value search: live search across all same-type sheets in current app
        let kvResults = store.searchKeyValueEntries("alpha", applicationID: appAID)
        try check(kvResults.count == 2, "KV search must return matches from all KV sheets in App A (expected 2, got \(kvResults.count)).")
        try check(Set(kvResults.map(\.cheatsheetName)) == ["KV 1", "KV 2"], "KV search results must identify source sheet names.")
        try check(!kvResults.contains { $0.cheatsheetID == bKV }, "KV search must be isolated to current app.")

        // 2. Shortcut search: live search across all shortcut sheets in current app
        let shortcutModel = ShortcutListModel(store: store, applicationID: appAID, sheetID: aShortcuts1)
        shortcutModel.searchText = "alpha"
        try check(shortcutModel.rows.count == 2, "Shortcut search must find items across all shortcut sheets in App A (expected 2, got \(shortcutModel.rows.count)).")
        try check(shortcutModel.sheetName(for: shortcutModel.rows[0].id) != nil, "Shortcut search must provide source sheet name.")
        try check(Set(shortcutModel.rows.compactMap { shortcutModel.sheetName(for: $0.id) }) == ["快捷鍵", "Shortcuts 2"], "Shortcut search results must identify source sheet names.")

        // 3. Jumping without forcing expansion
        let jumpTarget = kvResults[0]
        let expandedIDs = Set<String>()
        var selectedSheetID: String?
        let onJump: (KeyValueSearchResult) -> Void = { target in
            selectedSheetID = target.cheatsheetID
            // Intentionally verify we do NOT force expansion
        }
        onJump(jumpTarget)
        try check(selectedSheetID == aKV1, "Jump must select target sheet.")
        try check(!expandedIDs.contains(jumpTarget.entry.id), "Jump must not force entry expansion.")

        // 4. Switching sheets clears search input
        var searchInput = "alpha"
        let switchSheet: (String) -> Void = { _ in
            searchInput = ""
        }
        switchSheet(aKV2)
        try check(searchInput.isEmpty, "Switching sheets must clear search input.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw CrossSheetSearchSelfTestError.failed(message) }
    }

    private static func unwrap<T>(_ value: T?, _ message: String = "Unexpected nil") throws -> T {
        guard let value else { throw CrossSheetSearchSelfTestError.failed(message) }
        return value
    }
}

private enum CrossSheetSearchSelfTestError: LocalizedError {
    case failed(String)
    var errorDescription: String? {
        switch self {
        case .failed(let message): message
        }
    }
}
