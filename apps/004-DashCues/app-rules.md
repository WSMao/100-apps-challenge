# 子專案專屬開發規範 (app-rules.md)

**本文件之特定規範優先於全域 rules.md**；本文件未提及之事項，一律繼承並遵循根目錄 `rules.md`。

---

## Testing Policy

### 1. General Principles
- Testing is required according to the risk and impact of changes.
- TDD is a preferred development approach for complex business logic and critical functionality, but is not mandatory for every change.
- Prefer testing observable behavior over private implementation details.
- Reuse existing tests and test infrastructure whenever possible.

### 2. Testing Strategy
Before implementation, assess the change scope and select appropriate testing methods.

- Static / UI styling changes: No full test suite required. Perform relevant visual or build checks when appropriate.
- Simple feature changes: Run relevant Unit Tests and targeted UI Tests when applicable.
- Business logic / data changes: Add or update Unit Tests. Prefer TDD for new or complex logic.
- Architecture / cross-module changes: Define a testing strategy before implementation. Use appropriate Unit, Integration, UI and E2E Tests.

### 3. Regression Testing
- Run targeted regression tests for affected functionality.
- Run broader regression tests when shared modules, interfaces, or core behavior are affected.
- Do not run the entire test suite for changes that cannot affect application behavior, such as comments, documentation, or isolated static assets.
- Never skip relevant existing tests merely to save execution time.

### 4. Test Quality
- Tests should verify observable behavior, not private implementation details.
- Avoid tests that merely duplicate implementation logic.
- Keep tests deterministic and independent whenever possible.
- Do not modify or delete tests simply to make a failing implementation pass.
- If a test cannot be executed, report the reason explicitly.

### 5. Completion Report
After implementation, report:
- Tests added or modified.
- Tests executed.
- Test results (Passed / Failed / Skipped).
- Any untested areas and known risks.

---


## macOS Specific Considerations

### 測試工具

執行本專案之測試套件時，建議設定 Xcode 開發者路徑並關閉 sandbox 以免快取權限受限：

- **單元與整合測試（含 Hosted Window 互動自測）**：
  ```bash
  DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer" swift test --disable-sandbox
  ```
- **單一功能測試快速驗證**：
  ```bash
  DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer" swift test --disable-sandbox --filter <TestName>
  ```
- **XCUITest 完整操作鏈測試**：
  ```bash
  DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer" ./Scripts/run-ui-tests.sh test -only-testing:DashCuesUITests/<SuiteName>/<TestName>
  ```



## App-Specific Considerations

- **TCC 系統權限防護**：
  - 測試執行期間嚴禁掃描或讀取系統外部應用圖標，避免觸發 macOS 系統隱私權限彈窗阻擋測試。





---