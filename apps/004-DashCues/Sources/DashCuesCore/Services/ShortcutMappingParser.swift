import Foundation

enum ShortcutMappingParser {
    static let templatePrompt: String = """
請照這個 JSON 格式製作快捷鍵映射檔案，將製作好的 JSON 內容提供給我：
```json
[
  {
    "title": "複製",
    "keys": ["⌘", "C"],
    "tags": ["編輯"],
    "notes": "選填備註"
  },
  {
    "title": "貼上",
    "keys": ["⌘", "V"],
    "tags": ["編輯"],
    "notes": ""
  }
]
```
"""

    static func parse(_ rawText: String) throws -> [ShortcutItem] {
        var text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return [] }

        // Strip markdown code fences if wrapped
        if text.hasPrefix("```") {
            let lines = text.components(separatedBy: .newlines)
            var contentLines: [String] = []
            for (index, line) in lines.enumerated() {
                if index == 0 && line.hasPrefix("```") { continue }
                if index == lines.count - 1 && line.trimmingCharacters(in: .whitespaces).hasPrefix("```") { continue }
                contentLines.append(line)
            }
            text = contentLines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        }

        guard let data = text.data(using: .utf8) else {
            throw ShortcutStoreError.invalidShortcut
        }

        let json = try JSONSerialization.jsonObject(with: data, options: [])
        var rawItems: [[String: Any]] = []

        if let array = json as? [[String: Any]] {
            rawItems = array
        } else if let dict = json as? [String: Any] {
            if let array = dict["shortcuts"] as? [[String: Any]] {
                rawItems = array
            } else if let array = dict["mapping"] as? [[String: Any]] {
                rawItems = array
            } else if let array = dict["items"] as? [[String: Any]] {
                rawItems = array
            } else {
                throw ShortcutStoreError.invalidShortcut
            }
        } else {
            throw ShortcutStoreError.invalidShortcut
        }

        var results: [ShortcutItem] = []
        for dict in rawItems {
            let title = (dict["title"] as? String) ?? (dict["name"] as? String) ?? ""
            let notes = (dict["notes"] as? String) ?? ""
            var tags: [String] = []
            if let tagArray = dict["tags"] as? [String] {
                tags = tagArray
            } else if let tagStr = dict["tags"] as? String {
                tags = tagStr.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            } else if let catStr = dict["category"] as? String {
                tags = [catStr]
            }

            var keys: [String] = []
            if let keyArray = dict["keys"] as? [String] {
                keys = keyArray.map(normalizeKeySymbol)
            } else if let keyStr = dict["keys"] as? String {
                keys = parseKeyString(keyStr)
            } else if let keyArray = dict["shortcut"] as? [String] {
                keys = keyArray.map(normalizeKeySymbol)
            } else if let keyStr = dict["shortcut"] as? String {
                keys = parseKeyString(keyStr)
            }

            let item = ShortcutItem(
                id: (dict["id"] as? String) ?? UUID().uuidString,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                keys: keys,
                tags: TagList.normalized(tags),
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            if !item.isBlank {
                results.append(item)
            }
        }

        guard !results.isEmpty else {
            throw ShortcutStoreError.invalidShortcut
        }
        return results
    }

    static func normalizeKeySymbol(_ symbol: String) -> String {
        let trimmed = symbol.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        switch lower {
        case "cmd", "command", "⌘": return "⌘"
        case "ctrl", "control", "⌃": return "⌃"
        case "opt", "option", "alt", "⌥": return "⌥"
        case "shift", "⇧": return "⇧"
        case "esc", "escape": return "⎋"
        case "enter", "return": return "↩"
        case "tab": return "⇥"
        case "space": return "Space"
        default:
            return trimmed.count == 1 ? trimmed.uppercased() : trimmed
        }
    }

    static func parseKeyString(_ str: String) -> [String] {
        let separators = CharacterSet(charactersIn: "+ -")
        let components = str.components(separatedBy: separators).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        return components.map(normalizeKeySymbol)
    }
}
