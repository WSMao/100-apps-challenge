import Foundation

/// TDD verification for recent content search history and keyboard preview.
enum RecentSearchSelfTest {
    @MainActor
    static func run(store: ShortcutStore) throws {
        let suiteName = "DashCues.SelfTest.RecentSearch.\(UUID().uuidString)"
        guard let testDefaults = UserDefaults(suiteName: suiteName) else {
            throw RecentSearchSelfTestError.failed("Could not create test UserDefaults.")
        }
        defer { testDefaults.removePersistentDomain(forName: suiteName) }

        let searchStore = RecentSearchStore(defaults: testDefaults)
        let appA = "app-a"
        let appB = "app-b"

        // 1. Empty and whitespace queries ignored
        searchStore.record(query: "   ", for: appA)
        searchStore.record(query: "", for: appA)
        try check(searchStore.recentSearches(for: appA).isEmpty, "Blank queries should not be recorded.")

        // 2. Recording & deduplication
        searchStore.record(query: "alpha", for: appA)
        searchStore.record(query: "beta", for: appA)
        searchStore.record(query: "gamma", for: appA)
        try check(searchStore.recentSearches(for: appA) == ["gamma", "beta", "alpha"], "Queries should be ordered latest first.")

        // Duplicate moves to the front
        searchStore.record(query: "  alpha  ", for: appA)
        try check(searchStore.recentSearches(for: appA) == ["alpha", "gamma", "beta"], "Duplicate query did not move to the front.")

        // 3. Limit to 20 queries
        for i in 1...25 {
            searchStore.record(query: "query-\(i)", for: appA)
        }
        let historyA = searchStore.recentSearches(for: appA)
        try check(historyA.count == 20, "History should be capped at 20 queries (got \(historyA.count)).")
        try check(historyA.first == "query-25", "Latest query should be first.")
        try check(!historyA.contains("query-1"), "Oldest query should have been evicted.")

        // 4. Per-app isolation
        searchStore.record(query: "b-only", for: appB)
        try check(searchStore.recentSearches(for: appB) == ["b-only"], "App B should have its own history.")
        try check(!searchStore.recentSearches(for: appA).contains("b-only"), "App A must not contain App B queries.")

        // 5. Persistence across store recreation
        let reloadedStore = RecentSearchStore(defaults: testDefaults)
        try check(reloadedStore.recentSearches(for: appA).count == 20, "Recent searches did not persist across store reload.")
        try check(reloadedStore.recentSearches(for: appB) == ["b-only"], "App B history did not persist across store reload.")

        // 6. Not part of backup
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let backupURL = directory.appendingPathComponent("no-history-backup.json")
        try store.exportBackup(to: backupURL)
        let backupData = try Data(contentsOf: backupURL)
        let jsonString = String(data: backupData, encoding: .utf8) ?? ""
        try check(!jsonString.contains("recentContentSearches"), "Backup should not contain recent search preferences.")

        // 7. Keyboard preview session (Up / Down / Esc / Enter)
        let session = SearchHistorySession(applicationID: appB, recentStore: searchStore)
        // History for appB: ["b-only"]
        searchStore.record(query: "second-b", for: appB)
        // appB history: ["second-b", "b-only"]

        // Up arrow: previews first item, keeps pre-preview text
        let preview1 = session.handleUp(currentText: "typed-text")
        try check(session.isBrowsingHistory, "Up arrow should enter history browsing.")
        try check(preview1 == "second-b", "Up arrow should preview latest history item.")
        try check(session.prePreviewText == "typed-text", "Pre-preview text should be preserved.")

        // Up arrow again: previews next item
        let preview2 = session.handleUp(currentText: "ignored")
        try check(preview2 == "b-only", "Up arrow should move to older history item.")

        // Down arrow: moves back to previous item
        let previewDown = session.handleDown()
        try check(previewDown == "second-b", "Down arrow should move to newer history item.")

        // Down arrow again: restores original typed text and exits browsing
        let restored = session.handleDown()
        try check(restored == "typed-text", "Down arrow at top should restore pre-preview text.")
        try check(!session.isBrowsingHistory, "Browsing history should be exited.")

        // Esc cancels preview and restores
        _ = session.handleUp(currentText: "draft")
        let escRestored = session.handleEsc()
        try check(escRestored == "draft", "Esc should restore pre-preview text.")
        try check(!session.isBrowsingHistory, "Esc should dismiss history.")

        // Enter applies chosen text
        _ = session.handleUp(currentText: "draft")
        let chosen = session.handleEnter()
        try check(chosen == "second-b", "Enter should choose the previewed item.")
        try check(!session.isBrowsingHistory, "Enter should dismiss history.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else { throw RecentSearchSelfTestError.failed(message) }
    }
}

private enum RecentSearchSelfTestError: LocalizedError {
    case failed(String)
    var errorDescription: String? {
        switch self {
        case .failed(let message): message
        }
    }
}
