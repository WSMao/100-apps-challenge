@testable import DashCuesCore
import Foundation

enum ShortcutMappingParserSelfTest {
    static func run() throws {
        // 1. Template Prompt Verification
        try check(
            ShortcutMappingParser.templatePrompt.contains("請照以下的 JSON 格式製作快捷鍵映射檔案，將製作好的內容提供給我"),
            "Template prompt must contain the required prompt string."
        )
        try check(
            ShortcutMappingParser.templatePrompt.contains("```json"),
            "Template prompt must contain json code block."
        )
        try check(
            ShortcutMappingParser.templatePrompt.contains("【macOS 常用快捷鍵符號對照表】"),
            "Template prompt must contain macOS shortcut symbols table."
        )
        try check(
            ShortcutMappingParser.templatePrompt.contains("【滑鼠操作對照表】"),
            "Template prompt must contain mouse operations table."
        )

        // 2. Empty string
        let emptyResult = try ShortcutMappingParser.parse("")
        try check(emptyResult.isEmpty, "Empty string should return empty array.")

        // 2b. Minimal format without tags and notes
        let minimalJSON = """
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
        """
        let minimalItems = try ShortcutMappingParser.parse(minimalJSON)
        try check(minimalItems.count == 2, "Expected 2 shortcuts from minimal JSON.")
        try check(minimalItems[0].title == "複製", "Title should match.")
        try check(minimalItems[0].keys == ["⌘", "C"], "Keys should match.")
        try check(minimalItems[0].tags.isEmpty, "Tags should be empty.")
        try check(minimalItems[0].notes.isEmpty, "Notes should be empty.")

        // 3. Standard JSON array
        let standardJSON = """
        [
          {
            "title": "複製",
            "keys": ["⌘", "C"],
            "tags": ["編輯"],
            "notes": "備註文字"
          },
          {
            "title": "貼上",
            "keys": ["⌘", "V"],
            "tags": ["編輯", "常用"]
          }
        ]
        """
        let standardItems = try ShortcutMappingParser.parse(standardJSON)
        try check(standardItems.count == 2, "Expected 2 shortcuts from standard JSON.")
        try check(standardItems[0].title == "複製", "Title should match.")
        try check(standardItems[0].keys == ["⌘", "C"], "Keys should match.")
        try check(standardItems[0].tags == ["編輯"], "Tags should match.")
        try check(standardItems[0].notes == "備註文字", "Notes should match.")
        try check(standardItems[1].tags == ["編輯", "常用"], "Multiple tags should match.")

        // 4. String keys and text modifier normalization
        let stringKeysJSON = """
        [
          {
            "name": "全局搜索",
            "keys": "Cmd+Shift+F",
            "category": "導覽"
          },
          {
            "name": "終端機",
            "keys": "Ctrl+`",
            "tags": "系統, 開發"
          }
        ]
        """
        let stringKeyItems = try ShortcutMappingParser.parse(stringKeysJSON)
        try check(stringKeyItems.count == 2, "Expected 2 shortcuts from string keys.")
        try check(stringKeyItems[0].title == "全局搜索", "name should map to title.")
        try check(stringKeyItems[0].keys == ["⌘", "⇧", "F"], "Cmd+Shift+F should normalize to [⌘, ⇧, F].")
        try check(stringKeyItems[0].tags == ["導覽"], "category should map to tags.")
        try check(stringKeyItems[1].keys == ["⌃", "`"], "Ctrl should normalize to ⌃.")
        try check(stringKeyItems[1].tags == ["系統", "開發"], "Comma-separated tags should parse into array.")

        // 4b. Special keys normalization: Caps Lock, Fn, Home (↖), End (↘)
        let specialKeysJSON = """
        [
          {
            "title": "大寫鎖定測試",
            "keys": ["capslock", "a"]
          },
          {
            "title": "功能鍵測試",
            "keys": ["fn", "f1"]
          },
          {
            "title": "行首行尾測試",
            "keys": ["↖", "↘"]
          }
        ]
        """
        let specialItems = try ShortcutMappingParser.parse(specialKeysJSON)
        try check(specialItems[0].keys == ["⇪", "A"], "capslock should normalize to ⇪.")
        try check(specialItems[1].keys == ["Fn", "F1"], "fn should normalize to Fn.")
        try check(specialItems[2].keys == ["Home", "End"], "↖ and ↘ should normalize to Home and End.")

        // 5. Object wrapper {"shortcuts": [...]}
        let wrapperJSON = """
        {
          "shortcuts": [
            {
              "title": "儲存檔案",
              "keys": ["⌘", "S"]
            }
          ]
        }
        """
        let wrapperItems = try ShortcutMappingParser.parse(wrapperJSON)
        try check(wrapperItems.count == 1, "Expected 1 shortcut from wrapper object.")
        try check(wrapperItems[0].title == "儲存檔案", "Title should match.")
        try check(wrapperItems[0].keys == ["⌘", "S"], "Keys should match.")

        // 6. Wrapped in Markdown code fences
        let markdownJSON = """
        ```json
        [
          {
            "title": "重構",
            "keys": ["⌃", "T"]
          }
        ]
        ```
        """
        let mdItems = try ShortcutMappingParser.parse(markdownJSON)
        try check(mdItems.count == 1, "Expected 1 shortcut from markdown code block.")
        try check(mdItems[0].title == "重構", "Title should match.")

        // 7. Invalid JSON throws error
        var caughtError = false
        do {
            _ = try ShortcutMappingParser.parse("{ invalid json content ]")
        } catch {
            caughtError = true
        }
        try check(caughtError, "Invalid JSON must throw error.")

        // 8. Scheme B left/right modifiers and mouse operations normalization
        let schemeBAndMouseJSON = """
        [
          {
            "title": "左修飾鍵與滑鼠拖曳",
            "keys": ["lcmd", "拖曳"]
          },
          {
            "title": "右Ctrl點擊",
            "keys": ["rcmd", "rctrl", "lopt", "rshift", "右鍵雙擊"]
          },
          {
            "title": "滾輪操作",
            "keys": ["垂直滾輪", "水平滾輪", "前滾", "後滾", "左滾", "右滾"]
          }
        ]
        """
        let mouseItems = try ShortcutMappingParser.parse(schemeBAndMouseJSON)
        try check(mouseItems[0].keys == ["LCmd", "Drag"], "lcmd + 拖曳 should normalize to [LCmd, Drag].")
        try check(mouseItems[1].keys == ["RCmd", "RCtrl", "LOpt", "RShift", "Right Double Click"], "Modifiers and double click should normalize.")
        try check(mouseItems[2].keys == ["Scroll", "Horizontal Scroll", "Scroll Up", "Scroll Down", "Scroll Left", "Scroll Right"], "Scroll keywords should normalize.")

        // 9. parseKeysInput tests
        let parsedJson = ShortcutMappingParser.parseKeysInput("[\"⌘\", \"V\"]")
        try check(parsedJson == ["⌘", "V"], "parseKeysInput should parse JSON array.")

        let parsedMouseJson = ShortcutMappingParser.parseKeysInput("[\"⌥\", \"Drag\"]")
        try check(parsedMouseJson == ["⌥", "Drag"], "parseKeysInput should parse mouse keyword in JSON.")

        let parsedLoose = ShortcutMappingParser.parseKeysInput("LCtrl, 拖曳")
        try check(parsedLoose == ["LCtrl", "Drag"], "parseKeysInput should normalize loose input.")

        let parsedPlus = ShortcutMappingParser.parseKeysInput("⌘ + C")
        try check(parsedPlus == ["⌘", "C"], "parseKeysInput should handle plus-separated keys.")

        print("ShortcutMappingParserSelfTest passed.")
    }

    private static func check(_ condition: Bool, _ message: String) throws {
        guard condition else {
            throw SelfTestError.failed(message)
        }
    }

    private enum SelfTestError: Error {
        case failed(String)
    }
}
