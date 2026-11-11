import Foundation

/// Per-app recent content search history stored in user preferences (not in backups).
@MainActor
final class RecentSearchStore: ObservableObject {
    static let maxHistoryPerApp = 20
    private static let defaultsKey = "DashCues.recentContentSearches"

    static let shared = RecentSearchStore()

    private let defaults: UserDefaults
    @Published private(set) var historyByApp: [String: [String]] = [:]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let stored = defaults.dictionary(forKey: Self.defaultsKey) as? [String: [String]] {
            self.historyByApp = stored
        }
    }

    func recentSearches(for applicationID: String) -> [String] {
        historyByApp[applicationID] ?? []
    }

    func record(query: String, for applicationID: String) {
        let cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return }

        var list = historyByApp[applicationID] ?? []
        list.removeAll { $0.caseInsensitiveCompare(cleaned) == .orderedSame }
        list.insert(cleaned, at: 0)
        if list.count > Self.maxHistoryPerApp {
            list = Array(list.prefix(Self.maxHistoryPerApp))
        }

        historyByApp[applicationID] = list
        defaults.set(historyByApp, forKey: Self.defaultsKey)
    }

    func clear(for applicationID: String) {
        historyByApp.removeValue(forKey: applicationID)
        defaults.set(historyByApp, forKey: Self.defaultsKey)
    }

    func resetForTesting() {
        historyByApp = [:]
        defaults.removeObject(forKey: Self.defaultsKey)
    }
}

/// Manages keyboard navigation (Up/Down/Esc/Enter) through recent search history previews.
@MainActor
final class SearchHistorySession: ObservableObject {
    @Published var isBrowsingHistory = false
    @Published var historyIndex: Int? = nil
    @Published var prePreviewText: String = ""
    @Published var previewText: String? = nil

    let applicationID: String
    private let recentStore: RecentSearchStore

    init(applicationID: String, recentStore: RecentSearchStore? = nil) {
        self.applicationID = applicationID
        self.recentStore = recentStore ?? .shared
    }

    var history: [String] {
        recentStore.recentSearches(for: applicationID)
    }

    /// Previews the next older history item on Up arrow.
    func handleUp(currentText: String) -> String? {
        guard !history.isEmpty else { return nil }
        if !isBrowsingHistory {
            isBrowsingHistory = true
            prePreviewText = currentText
            historyIndex = 0
            let item = history[0]
            previewText = item
            return item
        } else if let current = historyIndex {
            let nextIndex = min(current + 1, history.count - 1)
            historyIndex = nextIndex
            let item = history[nextIndex]
            previewText = item
            return item
        }
        return nil
    }

    /// Moves toward newer history items or restores original text on Down arrow.
    func handleDown() -> String? {
        guard isBrowsingHistory, let current = historyIndex else { return nil }
        if current > 0 {
            let prevIndex = current - 1
            historyIndex = prevIndex
            let item = history[prevIndex]
            previewText = item
            return item
        } else {
            let restored = prePreviewText
            dismiss()
            return restored
        }
    }

    /// Applies the chosen history item and records it on Enter.
    func handleEnter() -> String? {
        guard isBrowsingHistory, let item = previewText else { return nil }
        dismiss()
        recentStore.record(query: item, for: applicationID)
        return item
    }

    /// Restores pre-preview text and cancels history browsing on Esc.
    func handleEsc() -> String? {
        guard isBrowsingHistory else { return nil }
        let restored = prePreviewText
        dismiss()
        return restored
    }

    func dismiss() {
        isBrowsingHistory = false
        historyIndex = nil
        previewText = nil
        prePreviewText = ""
    }
}
