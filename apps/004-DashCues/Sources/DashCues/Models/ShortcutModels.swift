import Foundation

enum TagList {
    static func clean(_ tag: String) -> String {
        tag.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func key(_ tag: String) -> String {
        clean(tag).lowercased()
    }

    /// Trims tags and drops empty and case-insensitive duplicates, keeping the first spelling.
    static func normalized(_ tags: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for tag in tags.map(clean) where !tag.isEmpty && seen.insert(key(tag)).inserted {
            result.append(tag)
        }
        return result
    }
}

struct TagEdit: Equatable {
    /// The tag's current name in the app; the new name is `name`.
    var original: String
    var name: String
}

struct ShortcutItem: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var keys: [String]
    var tags: [String]
    var notes: String

    init(
        id: String = UUID().uuidString,
        title: String,
        keys: [String],
        tags: [String] = [],
        notes: String = ""
    ) {
        self.id = id
        self.title = title
        self.keys = keys
        self.tags = tags
        self.notes = notes
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, keys, tags, category, notes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        keys = try container.decode([String].self, forKey: .keys)
        notes = try container.decodeIfPresent(String.self, forKey: .notes) ?? ""
        if let decodedTags = try container.decodeIfPresent([String].self, forKey: .tags) {
            tags = TagList.normalized(decodedTags)
        } else {
            // Data saved before tags existed stored a single `category` string.
            let legacy = try container.decodeIfPresent(String.self, forKey: .category) ?? ""
            tags = TagList.normalized([legacy])
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(keys, forKey: .keys)
        try container.encode(tags, forKey: .tags)
        try container.encode(notes, forKey: .notes)
    }

    var keyCombination: String {
        keys.joined()
    }

    /// A shortcut needs at least a name or a key combination to be kept.
    var isBlank: Bool {
        title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && keys.isEmpty
    }
}

struct ShortcutApplication: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var bundleIdentifier: String
    var symbolName: String
    var isBuiltIn: Bool
    var isPinned: Bool
    var shortcuts: [ShortcutItem]
    /// The app's own tag list. Always contains every tag used by its shortcuts.
    var tags: [String]

    init(
        id: String = UUID().uuidString,
        name: String,
        bundleIdentifier: String = "",
        symbolName: String = "app",
        isBuiltIn: Bool = false,
        isPinned: Bool = false,
        shortcuts: [ShortcutItem] = [],
        tags: [String] = []
    ) {
        self.id = id
        self.name = name
        self.bundleIdentifier = bundleIdentifier
        self.symbolName = symbolName
        self.isBuiltIn = isBuiltIn
        self.isPinned = isPinned
        self.shortcuts = shortcuts
        self.tags = tags
        syncTags()
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, bundleIdentifier, symbolName, isBuiltIn, isPinned, shortcuts, tags
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        bundleIdentifier = try container.decode(String.self, forKey: .bundleIdentifier)
        symbolName = try container.decode(String.self, forKey: .symbolName)
        isBuiltIn = try container.decode(Bool.self, forKey: .isBuiltIn)
        isPinned = try container.decode(Bool.self, forKey: .isPinned)
        shortcuts = try container.decode([ShortcutItem].self, forKey: .shortcuts)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        syncTags()
    }

    /// Keeps the app tag list a superset of the tags used by its shortcuts.
    mutating func syncTags() {
        tags = TagList.normalized(tags + shortcuts.flatMap(\.tags))
    }

    /// Maps tags to the spelling already used in this app's tag list.
    func canonicalTags(_ candidates: [String]) -> [String] {
        let known = Dictionary(tags.map { (TagList.key($0), $0) }, uniquingKeysWith: { first, _ in first })
        return TagList.normalized(candidates.map { known[TagList.key($0)] ?? $0 })
    }

    /// Applies renames and deletions: tags missing from `edits` are removed everywhere.
    mutating func applyTagEdits(_ edits: [TagEdit]) {
        var mapping: [String: String] = [:]
        for edit in edits { mapping[TagList.key(edit.original)] = TagList.clean(edit.name) }
        for index in shortcuts.indices {
            shortcuts[index].tags = TagList.normalized(shortcuts[index].tags.compactMap { mapping[TagList.key($0)] })
        }
        tags = TagList.normalized(edits.map(\.name))
        syncTags()
    }
}

struct HotKeyConfiguration: Codable, Equatable {
    var keyCode: UInt32
    var modifiers: UInt32

    static let defaultValue = HotKeyConfiguration(
        keyCode: 40,
        modifiers: HotKeyModifiers.command | HotKeyModifiers.option | HotKeyModifiers.control
    )
}

enum HotKeyModifiers {
    static let command: UInt32 = 1 << 8
    static let shift: UInt32 = 1 << 9
    static let option: UInt32 = 1 << 11
    static let control: UInt32 = 1 << 12
}

struct ShortcutStoreSnapshot: Codable, Equatable {
    var schemaVersion: Int
    var applications: [ShortcutApplication]
    var hotKey: HotKeyConfiguration

    static let currentSchemaVersion = 1
}

enum ShortcutStoreError: LocalizedError {
    case storageUnavailable
    case unsupportedSchema(Int)
    case invalidApplication
    case invalidShortcut
    case applicationNotFound
    case builtInApplicationCannotBeDeleted
    case duplicateApplication
    case invalidBackup
    case invalidTag
    case duplicateTag

    var errorDescription: String? {
        switch self {
        case .storageUnavailable:
            "找不到可用的本機資料目錄。"
        case .unsupportedSchema(let version):
            "此備份版本（\(version)）不受支援。"
        case .invalidApplication:
            "App 名稱不可空白。"
        case .invalidShortcut:
            "快捷鍵名稱與按鍵組合不可空白。"
        case .applicationNotFound:
            "找不到指定的 App。"
        case .builtInApplicationCannotBeDeleted:
            "內建 App 不可刪除，但可以編輯其快捷鍵。"
        case .duplicateApplication:
            "此 App 已存在。"
        case .invalidBackup:
            "備份資料格式不正確或包含無效的快捷鍵資料。"
        case .invalidTag:
            "標籤名稱不可空白。"
        case .duplicateTag:
            "標籤名稱重複。"
        }
    }
}
