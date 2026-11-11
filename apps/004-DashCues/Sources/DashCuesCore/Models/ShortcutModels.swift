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

struct KeyValueEntry: Codable, Identifiable, Equatable {
    var id: String
    var key: String
    var value: String

    init(id: String = UUID().uuidString, key: String, value: String) {
        self.id = id
        self.key = key
        self.value = value
    }

    var isBlank: Bool {
        key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

enum KeyValueColumn: String, Codable, Equatable, CaseIterable {
    case key
    case value

    var title: String {
        switch self {
        case .key: "Key"
        case .value: "Value"
        }
    }
}

struct KeyValueTableLayout: Codable, Equatable {
    static let minColumnWidth: Double = 120
    static let defaultOrder: [KeyValueColumn] = [.key, .value]

    var columnOrder: [KeyValueColumn]
    var keyWidth: Double?
    var valueWidth: Double?

    init(
        columnOrder: [KeyValueColumn] = defaultOrder,
        keyWidth: Double? = nil,
        valueWidth: Double? = nil
    ) {
        self.columnOrder = Self.normalized(columnOrder)
        self.keyWidth = keyWidth
        self.valueWidth = valueWidth
    }

    static func normalized(_ order: [KeyValueColumn]) -> [KeyValueColumn] {
        var result: [KeyValueColumn] = []
        for col in order where !result.contains(col) {
            result.append(col)
        }
        for col in KeyValueColumn.allCases where !result.contains(col) {
            result.append(col)
        }
        return result
    }

    /// Computes resolved widths for (key, value) given available container width.
    func resolvedWidths(containerWidth: Double) -> (key: Double, value: Double) {
        let minW = Self.minColumnWidth
        let available = max(containerWidth, minW * 2)
        switch (keyWidth, valueWidth) {
        case let (.some(kw), .some(vw)):
            return (max(kw, minW), max(vw, minW))
        case let (.some(kw), .none):
            let clampedKey = max(kw, minW)
            return (clampedKey, max(available - clampedKey, minW))
        case let (.none, .some(vw)):
            let clampedValue = max(vw, minW)
            return (max(available - clampedValue, minW), clampedValue)
        case (.none, .none):
            let half = max(available / 2, minW)
            return (half, half)
        }
    }
}

struct KeyValueCheatsheet: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var entries: [KeyValueEntry]
    var columnOrder: [KeyValueColumn]
    var keyWidth: Double?
    var valueWidth: Double?

    init(
        id: String = UUID().uuidString,
        name: String,
        entries: [KeyValueEntry] = [],
        columnOrder: [KeyValueColumn] = KeyValueTableLayout.defaultOrder,
        keyWidth: Double? = nil,
        valueWidth: Double? = nil
    ) {
        self.id = id
        self.name = name
        self.entries = entries
        self.columnOrder = KeyValueTableLayout.normalized(columnOrder)
        self.keyWidth = keyWidth
        self.valueWidth = valueWidth
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, entries, columnOrder, keyWidth, valueWidth
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        entries = try container.decode([KeyValueEntry].self, forKey: .entries)
        let rawOrder = try? container.decode([KeyValueColumn].self, forKey: .columnOrder)
        columnOrder = KeyValueTableLayout.normalized(rawOrder ?? KeyValueTableLayout.defaultOrder)
        keyWidth = try? container.decode(Double.self, forKey: .keyWidth)
        valueWidth = try? container.decode(Double.self, forKey: .valueWidth)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(entries, forKey: .entries)
        try container.encode(columnOrder, forKey: .columnOrder)
        try container.encodeIfPresent(keyWidth, forKey: .keyWidth)
        try container.encodeIfPresent(valueWidth, forKey: .valueWidth)
    }

    var layout: KeyValueTableLayout {
        get {
            KeyValueTableLayout(columnOrder: columnOrder, keyWidth: keyWidth, valueWidth: valueWidth)
        }
        set {
            columnOrder = newValue.columnOrder
            keyWidth = newValue.keyWidth
            valueWidth = newValue.valueWidth
        }
    }
}

struct ShortcutSheet: Codable, Identifiable, Equatable {
    static let defaultName = "快捷鍵"

    var id: String
    var name: String
    var shortcuts: [ShortcutItem]

    init(id: String = UUID().uuidString, name: String = ShortcutSheet.defaultName, shortcuts: [ShortcutItem] = []) {
        self.id = id
        self.name = name
        self.shortcuts = shortcuts
    }
}

enum SheetKind: String, Codable, Equatable, CaseIterable {
    case shortcuts
    case keyValue
}

/// One ordered, named tab of an app: either a shortcut sheet or a Key-Value sheet.
enum AppSheet: Codable, Identifiable, Equatable {
    case shortcuts(ShortcutSheet)
    case keyValue(KeyValueCheatsheet)

    var id: String {
        switch self {
        case .shortcuts(let sheet): sheet.id
        case .keyValue(let sheet): sheet.id
        }
    }

    var name: String {
        switch self {
        case .shortcuts(let sheet): sheet.name
        case .keyValue(let sheet): sheet.name
        }
    }

    var kind: SheetKind {
        switch self {
        case .shortcuts: .shortcuts
        case .keyValue: .keyValue
        }
    }

    private enum CodingKeys: String, CodingKey {
        case type, id, name, shortcuts, entries, columnOrder, keyWidth, valueWidth
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let id = try container.decode(String.self, forKey: .id)
        let name = try container.decode(String.self, forKey: .name)
        switch try container.decode(SheetKind.self, forKey: .type) {
        case .shortcuts:
            self = .shortcuts(ShortcutSheet(
                id: id, name: name, shortcuts: try container.decode([ShortcutItem].self, forKey: .shortcuts)
            ))
        case .keyValue:
            let rawOrder = try? container.decode([KeyValueColumn].self, forKey: .columnOrder)
            let columnOrder = KeyValueTableLayout.normalized(rawOrder ?? KeyValueTableLayout.defaultOrder)
            let keyWidth = try? container.decode(Double.self, forKey: .keyWidth)
            let valueWidth = try? container.decode(Double.self, forKey: .valueWidth)
            self = .keyValue(KeyValueCheatsheet(
                id: id,
                name: name,
                entries: try container.decode([KeyValueEntry].self, forKey: .entries),
                columnOrder: columnOrder,
                keyWidth: keyWidth,
                valueWidth: valueWidth
            ))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind, forKey: .type)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        switch self {
        case .shortcuts(let sheet):
            try container.encode(sheet.shortcuts, forKey: .shortcuts)
        case .keyValue(let sheet):
            try container.encode(sheet.entries, forKey: .entries)
            try container.encode(sheet.columnOrder, forKey: .columnOrder)
            try container.encodeIfPresent(sheet.keyWidth, forKey: .keyWidth)
            try container.encodeIfPresent(sheet.valueWidth, forKey: .valueWidth)
        }
    }

    /// Builds the ordered sheets for data saved before sheets existed: the shortcut sheet comes
    /// first and is renamed (`快捷鍵 2`, `快捷鍵 3`, …) if a Key-Value sheet already uses its name.
    static func migrated(shortcuts: [ShortcutItem], keyValueCheatsheets: [KeyValueCheatsheet]) -> [AppSheet] {
        let taken = Set(keyValueCheatsheets.map { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() })
        var name = ShortcutSheet.defaultName
        var suffix = 2
        while taken.contains(name.lowercased()) {
            name = "\(ShortcutSheet.defaultName) \(suffix)"
            suffix += 1
        }
        return [.shortcuts(ShortcutSheet(name: name, shortcuts: shortcuts))] + keyValueCheatsheets.map {
            .keyValue($0)
        }
    }
}

extension AppSheet {
    func renamed(_ name: String) -> AppSheet {
        switch self {
        case .shortcuts(var sheet):
            sheet.name = name
            return .shortcuts(sheet)
        case .keyValue(var sheet):
            sheet.name = name
            return .keyValue(sheet)
        }
    }

    static func nameKey(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Names are unique per app across both sheet types, ignoring whitespace and case.
    static func nameError(_ name: String, excludingID: String?, among sheets: [(id: String, name: String)]) -> ShortcutStoreError? {
        let key = nameKey(name)
        if key.isEmpty { return .invalidCheatsheetName }
        if sheets.contains(where: { $0.id != excludingID && nameKey($0.name) == key }) { return .duplicateCheatsheetName }
        return nil
    }
}

/// One row of the app editor's sheet list: the sheet to keep, in its new order and name.
struct SheetEdit: Equatable {
    var id: String
    var name: String
}

enum SheetSelection {
    /// Keeps the selection if it survives; otherwise picks the next remaining sheet, else the previous, else none.
    static func afterDeleting(selected: String?, from oldIDs: [String], remaining: [String]) -> String? {
        guard let selected else { return nil }
        if remaining.contains(selected) { return selected }
        guard let index = oldIDs.firstIndex(of: selected) else { return remaining.first }
        let next = oldIDs[(index + 1)...].first { remaining.contains($0) }
        let previous = oldIDs[..<index].last { remaining.contains($0) }
        return next ?? previous
    }
}

struct KeyValueSearchResult: Identifiable, Equatable {
    let cheatsheetID: String
    let cheatsheetName: String
    let entry: KeyValueEntry

    var id: String {
        "\(cheatsheetID):\(entry.id)"
    }
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
    /// PNG data of a user-picked icon; overrides the app's real icon when set.
    var customIconData: Data?
    var isBuiltIn: Bool
    var isPinned: Bool
    var sheets: [AppSheet]
    /// The app's own tag list. Always contains every tag used by its shortcuts.
    var tags: [String]

    init(
        id: String = UUID().uuidString,
        name: String,
        bundleIdentifier: String = "",
        symbolName: String = "app",
        customIconData: Data? = nil,
        isBuiltIn: Bool = false,
        isPinned: Bool = false,
        sheets: [AppSheet]? = nil,
        shortcuts: [ShortcutItem] = [],
        keyValueCheatsheets: [KeyValueCheatsheet] = [],
        tags: [String] = []
    ) {
        self.id = id
        self.name = name
        self.bundleIdentifier = bundleIdentifier
        self.symbolName = symbolName
        self.customIconData = customIconData
        self.isBuiltIn = isBuiltIn
        self.isPinned = isPinned
        if let sheets {
            self.sheets = sheets
        } else if !shortcuts.isEmpty || !keyValueCheatsheets.isEmpty {
            self.sheets = AppSheet.migrated(shortcuts: shortcuts, keyValueCheatsheets: keyValueCheatsheets)
        } else {
            self.sheets = [.shortcuts(ShortcutSheet())]
        }
        self.tags = tags
        syncTags()
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, bundleIdentifier, symbolName, customIconData, isBuiltIn, isPinned
        case sheets, shortcuts, keyValueCheatsheets, tags
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        bundleIdentifier = try container.decode(String.self, forKey: .bundleIdentifier)
        symbolName = try container.decode(String.self, forKey: .symbolName)
        customIconData = try container.decodeIfPresent(Data.self, forKey: .customIconData)
        isBuiltIn = try container.decode(Bool.self, forKey: .isBuiltIn)
        isPinned = try container.decode(Bool.self, forKey: .isPinned)
        if let decodedSheets = try container.decodeIfPresent([AppSheet].self, forKey: .sheets) {
            sheets = decodedSheets
        } else {
            sheets = AppSheet.migrated(
                shortcuts: try container.decodeIfPresent([ShortcutItem].self, forKey: .shortcuts) ?? [],
                keyValueCheatsheets: try container.decodeIfPresent([KeyValueCheatsheet].self, forKey: .keyValueCheatsheets) ?? []
            )
        }
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        syncTags()
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(bundleIdentifier, forKey: .bundleIdentifier)
        try container.encode(symbolName, forKey: .symbolName)
        try container.encodeIfPresent(customIconData, forKey: .customIconData)
        try container.encode(isBuiltIn, forKey: .isBuiltIn)
        try container.encode(isPinned, forKey: .isPinned)
        try container.encode(sheets, forKey: .sheets)
        try container.encode(tags, forKey: .tags)
    }

    var shortcuts: [ShortcutItem] {
        get {
            sheets.compactMap { sheet in
                if case .shortcuts(let s) = sheet { return s.shortcuts }
                return nil
            }.first ?? []
        }
        set {
            if let index = sheets.firstIndex(where: { $0.kind == .shortcuts }) {
                guard case .shortcuts(var sheet) = sheets[index] else { return }
                sheet.shortcuts = newValue
                sheets[index] = .shortcuts(sheet)
            } else {
                sheets.insert(.shortcuts(ShortcutSheet(shortcuts: newValue)), at: 0)
            }
        }
    }

    func sheetShortcuts(id: String) -> [ShortcutItem] {
        for case .shortcuts(let sheet) in sheets where sheet.id == id { return sheet.shortcuts }
        return []
    }

    var allShortcuts: [ShortcutItem] {
        sheets.flatMap { sheet in
            if case .shortcuts(let s) = sheet { return s.shortcuts }
            return []
        }
    }

    var keyValueCheatsheets: [KeyValueCheatsheet] {
        get {
            sheets.compactMap { sheet in
                if case .keyValue(let cheatsheet) = sheet { return cheatsheet }
                return nil
            }
        }
        set {
            let nonKeyValue = sheets.filter { $0.kind != .keyValue }
            sheets = nonKeyValue + newValue.map { .keyValue($0) }
        }
    }

    mutating func saveShortcut(_ shortcut: ShortcutItem, sheetID: String? = nil) {
        if let sheetID, let index = sheets.firstIndex(where: { $0.id == sheetID && $0.kind == .shortcuts }) {
            guard case .shortcuts(var sheet) = sheets[index] else { return }
            if let itemIndex = sheet.shortcuts.firstIndex(where: { $0.id == shortcut.id }) {
                sheet.shortcuts[itemIndex] = shortcut
            } else {
                sheet.shortcuts.append(shortcut)
            }
            sheets[index] = .shortcuts(sheet)
            return
        }

        if let index = sheets.firstIndex(where: { sheet in
            if case .shortcuts(let s) = sheet { return s.shortcuts.contains(where: { $0.id == shortcut.id }) }
            return false
        }) {
            guard case .shortcuts(var sheet) = sheets[index] else { return }
            if let itemIndex = sheet.shortcuts.firstIndex(where: { $0.id == shortcut.id }) {
                sheet.shortcuts[itemIndex] = shortcut
            }
            sheets[index] = .shortcuts(sheet)
            return
        }

        if let index = sheets.firstIndex(where: { $0.kind == .shortcuts }) {
            guard case .shortcuts(var sheet) = sheets[index] else { return }
            sheet.shortcuts.append(shortcut)
            sheets[index] = .shortcuts(sheet)
            return
        }

        sheets.append(.shortcuts(ShortcutSheet(shortcuts: [shortcut])))
    }

    mutating func deleteShortcut(id: String, sheetID: String? = nil) {
        for index in sheets.indices {
            if case .shortcuts(var sheet) = sheets[index] {
                if let sheetID, sheet.id != sheetID { continue }
                sheet.shortcuts.removeAll { $0.id == id }
                sheets[index] = .shortcuts(sheet)
            }
        }
    }

    mutating func deleteShortcuts(ids: Set<String>, sheetID: String? = nil) {
        for index in sheets.indices {
            if case .shortcuts(var sheet) = sheets[index] {
                if let sheetID, sheet.id != sheetID { continue }
                sheet.shortcuts.removeAll { ids.contains($0.id) }
                sheets[index] = .shortcuts(sheet)
            }
        }
    }

    /// Keeps the app tag list a superset of the tags used by its shortcuts.
    mutating func syncTags() {
        tags = TagList.normalized(tags + allShortcuts.flatMap(\.tags))
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
        for index in sheets.indices {
            guard case .shortcuts(var sheet) = sheets[index] else { continue }
            for item in sheet.shortcuts.indices {
                sheet.shortcuts[item].tags = TagList.normalized(sheet.shortcuts[item].tags.compactMap { mapping[TagList.key($0)] })
            }
            sheets[index] = .shortcuts(sheet)
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

    static let currentSchemaVersion = 2
    /// Versions that can be loaded or restored; version 1 predates sheets and is migrated.
    static let supportedSchemaVersions = 1...currentSchemaVersion
}

enum ShortcutStoreError: LocalizedError {
    case storageUnavailable
    case unsupportedSchema(Int)
    case invalidApplication
    case invalidShortcut
    case applicationNotFound
    case duplicateApplication
    case invalidBackup
    case invalidTag
    case duplicateTag
    case invalidCheatsheetName
    case duplicateCheatsheetName
    case cheatsheetNotFound
    case invalidKeyValueEntry

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
        case .duplicateApplication:
            "此 App 已存在。"
        case .invalidBackup:
            "備份資料格式不正確或包含無效的快捷鍵資料。"
        case .invalidTag:
            "標籤名稱不可空白。"
        case .duplicateTag:
            "標籤名稱重複。"
        case .invalidCheatsheetName:
            "工作表名稱不可空白。"
        case .duplicateCheatsheetName:
            "此 App 已有同名工作表。"
        case .cheatsheetNotFound:
            "找不到指定的工作表。"
        case .invalidKeyValueEntry:
            "Key 與 Value 不可同時空白。"
        }
    }
}
