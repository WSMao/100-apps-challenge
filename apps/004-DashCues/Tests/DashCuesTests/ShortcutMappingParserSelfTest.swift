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
