import Foundation

enum ShortcutMappingParser {
    static let cheatSheetText: String = """
【macOS 常用快捷鍵符號對照表】
- ⌘ : Command
- ⇧ : Shift
- ⌥ : Option / Alt
- ⌃ : Control
- 左右修飾鍵（可選）：LCmd / RCmd、LCtrl / RCtrl、LOpt / ROpt、LShift / RShift
- ⇪ : Caps Lock
- Fn 或 🌐 : Function / 地球儀鍵
- ↩ : Return / Enter
- ⌫ : Delete / Backspace
- ⌦ : Forward Delete
- ⇥ : Tab
- ⎋ 或 Esc : Escape
- Space : 空白鍵
- ↑ / ↓ / ← / → : 方向鍵（上、下、左、右）
- ↖ 或 Home : Home（行首 / 頁首）
- ↘ 或 End : End（行尾 / 頁尾）
- ⇞ / ⇟ : Page Up / Page Down
- F1～F12 : 功能鍵

【滑鼠操作對照表】
- 左鍵 : Click 或 左鍵
- 右鍵 : Right Click 或 右鍵
- 中鍵 : Middle Click 或 中鍵
- 左鍵雙擊 : Double Click 或 左鍵雙擊
- 中鍵雙擊 : Middle Double Click 或 中鍵雙擊
- 右鍵雙擊 : Right Double Click 或 右鍵雙擊
- 拖曳 : Drag 或 拖曳
- 垂直滾輪 : Scroll 或 垂直滾輪
- 水平滾輪 : Horizontal Scroll 或 水平滾輪
- 前滾 : Scroll Up 或 前滾
- 後滾 : Scroll Down 或 後滾
- 左滾 : Scroll Left 或 左滾
- 右滾 : Scroll Right 或 右滾
"""

    static let templatePrompt: String = """
請照以下的 JSON 格式製作快捷鍵映射檔案，將製作好的內容提供給我：
```json
[
  {
    "title": "複製",
    "keys": ["⌘", "C"]
  },
  {
    "title": "貼上",
    "keys": ["⌘", "V"]
  }
]
```

\(cheatSheetText)

注意事項：
- `keys` 陣列請填寫按鍵符號、大寫英文字母／數字或滑鼠關鍵字（例如 `["⌘", "C"]`、`["⌥", "Drag"]` 或 `["⌘", "Click"]`）。
- 修飾鍵請依照 `⌃`、`⌥`、`⇧`、`⌘` 之順序排列，滑鼠動作請置於最後。
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
        case "lcmd", "leftcmd", "leftcommand": return "LCmd"
        case "rcmd", "rightcmd", "rightcommand": return "RCmd"
        case "lctrl", "leftctrl", "leftcontrol": return "LCtrl"
        case "rctrl", "rightctrl", "rightcontrol": return "RCtrl"
        case "lopt", "leftopt", "leftoption", "lalt", "leftalt": return "LOpt"
        case "ropt", "rightopt", "rightoption", "ralt", "rightalt": return "ROpt"
        case "lshift", "leftshift": return "LShift"
        case "rshift", "rightshift": return "RShift"
        case "capslock", "caps", "⇪": return "⇪"
        case "fn": return "Fn"
        case "globe", "🌐": return "🌐"
        case "esc", "escape", "⎋": return "Esc"
        case "enter", "return": return "↩"
        case "tab": return "⇥"
        case "space": return "Space"
        case "backspace", "delete", "⌫": return "⌫"
        case "forwarddelete", "del", "⌦": return "⌦"
        case "up", "uparrow", "↑": return "↑"
        case "down", "downarrow", "↓": return "↓"
        case "left", "leftarrow", "←": return "←"
        case "right", "rightarrow", "→": return "→"
        case "pageup", "pgup", "⇞": return "⇞"
        case "pagedown", "pgdn", "⇟": return "⇟"
        case "home", "↖": return "Home"
        case "end", "↘": return "End"
        case "click", "左鍵": return "Click"
        case "right click", "rightclick", "右鍵": return "Right Click"
        case "middle click", "middleclick", "中鍵": return "Middle Click"
        case "double click", "doubleclick", "左鍵雙擊": return "Double Click"
        case "middle double click", "middledoubleclick", "中鍵雙擊": return "Middle Double Click"
        case "right double click", "rightdoubleclick", "右鍵雙擊": return "Right Double Click"
        case "drag", "拖曳": return "Drag"
        case "scroll", "垂直滾輪": return "Scroll"
        case "horizontal scroll", "horizontalscroll", "水平滾輪": return "Horizontal Scroll"
        case "scroll up", "scrollup", "前滾": return "Scroll Up"
        case "scroll down", "scrolldown", "後滾": return "Scroll Down"
        case "scroll left", "scrollleft", "左滾": return "Scroll Left"
        case "scroll right", "scrollright", "右滾": return "Scroll Right"
        default:
            if lower.hasPrefix("f"), let num = Int(lower.dropFirst()), num >= 1 && num <= 24 {
                return "F\(num)"
            }
            return trimmed.count == 1 ? trimmed.uppercased() : trimmed
        }
    }

    static func parseKeyString(_ str: String) -> [String] {
        let separators = CharacterSet(charactersIn: "+ -")
        let components = str.components(separatedBy: separators).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        return components.map(normalizeKeySymbol)
    }

    static func parseKeysInput(_ input: String) -> [String] {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        if let data = trimmed.data(using: .utf8),
           let array = try? JSONSerialization.jsonObject(with: data) as? [String] {
            return array.map(normalizeKeySymbol).filter { !$0.isEmpty }
        }

        var cleaned = trimmed
        if cleaned.hasPrefix("[") && cleaned.hasSuffix("]") {
            cleaned.removeFirst()
            cleaned.removeLast()
        }

        let separators = CharacterSet(charactersIn: ",+")
        let rawParts = cleaned.components(separatedBy: separators)
        var result: [String] = []
        for part in rawParts {
            var token = part.trimmingCharacters(in: .whitespacesAndNewlines)
            if (token.hasPrefix("\"") && token.hasSuffix("\"")) || (token.hasPrefix("'") && token.hasSuffix("'")) {
                if token.count >= 2 {
                    token.removeFirst()
                    token.removeLast()
                }
            }
            let normalized = normalizeKeySymbol(token)
            if !normalized.isEmpty {
                result.append(normalized)
            }
        }
        return result
    }
}
