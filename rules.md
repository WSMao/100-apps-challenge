# 100 Apps Challenge - AI Agents 開發協作守則 (rules.md)

本文件為整個儲存庫中所有 AI Agent（包括但不限於 Claude Code、Cursor、Codex、Antigravity、GitHub Copilot 等）的最高準則。
當你在本專案進行任何操作前，請務必詳讀並遵守以下原則。

---

## 1. 專案背景與定位
- 本儲存庫為 **100 Apps Challenge** 專案集合，所有獨立應用皆放置於 `apps/` 目錄下。子專案命名與編號規範為 `apps/<id>-<name>`，開始專案時若使用者尚未提供專案名稱，那就按照討論的細節，提供 5 個符合命名規範的名稱供使用者評估選擇（例：`001-appName`、`apps/001-xxx`）
- 目標是打造 100 個獨立、高質感、且具實用性或趣味性的應用專案。
- 專案採用 **多 Agent 同步/接力協作開發** 模式。

---

## 2. 多 Agent 協作核心原則

### 🔒 邊界意識 (Scope Isolation)
1. **嚴格限制操作範圍**：
   - 每次任務開始前，明確確認當前正在開發的特定目標應用（例如 `apps/001-Challenge Showcase/`）。
   - **禁止** 未經指示擅自修改其他 `apps/` 子資料夾中的程式碼或依賴。
2. **根目錄變更謹慎度**：
   - 根目錄（`rules.md`、`CLAUDE.md`、`agents.md`、workspace 設定等）屬於全域設定，除非使用者明確要求，否則不得任意更動。

### 📦 獨立與自包含 (Self-contained Apps)
- 每個位於 `apps/<id>-<name>` 的子專案應維持高度自包含（擁有各自獨立的建置設定如`package.json`，以及專案說明文件 `README.md`）。
- 避免不同應用之間產生隱性依賴，確保單一應用的更動不會破壞其他應用。

### 📝 狀態與變更透明 (Transparency & Auditability)
- 進行任何重大結構改動、安裝新套件或修改核心邏輯前，需向使用者清楚說明。
- 保持各專案文檔（如 `README.md`、版本紀錄）即時更新，方便其他接手的 Agent 快速理解現狀。

---

## 3. 開發規範與工程標準
- **技術選型建議**：每次開始一個新的子專案時，均先調查清楚使用者需求，依照使用場景，比如手機、網頁、desktop app、嵌入式，甚至是跨平台、多平台應用，提供 2～3 種可行的技術路線，做利弊分析後提供給使用者選擇。
  - 若為網頁開發以現代化前端/全端工具為主。
- **依賴管理**：請優先使用同一種套件管理工具（如 `pnpm` 或 `npm`），並在各子專案內維護。
- **程式碼風格**：保持代碼簡潔、型別安全（TypeScript 優先），不留下無用的測試檔案或廢棄註解。

---

## 4. 工程文件 `README.md` 應包含
- 項目名稱以及描述
- 技術路線
- 依賴管理
- 安裝說明
- 使用說明
- 工作快照，格式：Agent 名稱（Claude Code/ Antigravity/ Codex/... ）｜目前階段｜最近完成｜下一步｜備注（問題）

工程文件就是項目開發的說明書，讓 agents 在共同開發時有一致性，使用相同的依賴管理、相同的技術路線，也能參照工作快照快速掌握目前的項目狀態。

## 5. showcase 展示
每個項目（包含第一個項目）都會是第一個項目`001-Challenge Showcase`的展示內容，而第一個項目的設計架構為「資料驅動」。
- 每個子專案根目錄都放置一個標準的 `app-manifest.json` 如：
   ```json
      {
      "id": "001",
      "name": "Challenge Showcase",
      "description": "用來展示 100 Apps Challenge 的入口網站",
      "tags": ["React", "TailwindCSS", "Web"],
      "platform": "Web",
      "status": "completed",
      "demoUrl": "http://localhost:5173",
      "docUrl": "https://github/xxx/README.md",
      "coverImage": "assets/cover.png"
      }
   ```

- 第一個項目只需自動讀取各 App 的 json，無需手動修改程式碼。

## 6. Obsidian 專案紀錄

### Frontmatter 更新：
「當專案啟動或狀態改變時，主動同步更新 Obsidian 筆記頂部的 YAML 屬性（如 status 改為 completed、更新 tech_stack 與 update_date）。」

### 技術架構與資料流

每當與使用者得出技術架構與資料流的設計之後，主動維護架構與設計模式。

### 工作記錄
- 在完成一定的階段時，比如 commit 後或由使用者主動提出時，整理出可供複製到 Obsidian 的開發指標與總結，記錄到 `Journey/04_Coding/100 Apps Challenge/<id>-<name>.md` ，比如：
   ```md
   ## 工作記錄
   ### 2026-09-29 
   - 【新建】/【修正】/【調整】/【刪除】... 
   ```

### Bug 解決紀錄

當遇到難解 Bug 並成功解決時，Agent 主動整理出一組 「Troubleshooting 表格項目」（問題描述、原因分析、解決方案），加入Obsidian 的對應欄位。

### MVP 完成時記錄

當一個 App 達成 MVP 階段時，主動為對應的 MVP 項目打勾表示完成，並且新增「關鍵 Prompt」以及 「AI 表現評估」區塊的內容。


### 技術討論與概念筆記 (Tech Notes)
當使用者要求記錄某項技術概念或架構討論時：
- Agent 需檢視並比對 `Journey/04_Coding/技術討論與概念/` 資料夾中的現有文件。
- 比對既有內容：若該主題已存在相關文件，僅增補尚未提及或需深入擴充的部分，避免重複堆疊。
- 若無合適的現有文件，主動創建對應主題的全新 Markdown 筆記進行結構化記錄。

非必要不要動到除了上述提及的項目內容，除非使用者有提出要求。

## 7. Git 版控與分支策略
### 資安防護
- 禁止 Commit 敏感憑證：各 App 必須在自己的目錄或全域 .gitignore 中明確排除 .env、*.local、金鑰文件。
- 任何 Agent 建立新 App 時，必須同時建立範例環境檔 .env.example。

### 統一採用 Conventional Commits 格式，標準結構如：
```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- 因為本專案有 100 個獨立 App，加入 <scope> 嚴格綁定應用編號
- 因為有多個 AI Agent 參與，使用 Footer 標註 AI Agent 來源

| Type | 說明 | 範例 |
| -----| ----|----- |
| feat     | 新增功能(Feature)	                 |feat(001): add filter tags for challenge apps|
|fix	     | 修復 Bug	                         |fix(001): resolve layout overflow on mobile screens
|docs 	  | 純文件更新（Markdown、註解）	          |docs: update rules.md with commit conventions
|style	  | 不影響程式邏輯的排版/樣式修改	        |style(001): adjust card border radius and shadow
|refactor  | 重構（既非修 bug 也未增功能的代碼重整）	|refactor(001): extract AppCard into standalone component
|perf	     | 效能提升 (Performance)	              |perf(001): lazy load preview images
|chore	  | 建置工具、依賴項升級或雜項維護	         |chore(root): add pnpm workspace config
|test	     | 新增或修改測試	                      |test(001): add unit tests for date formatter

### 分支（Branch）管理

- 每款 App 採用獨立 App-Branch（以 App 為單位的分支）：如 `<id>-<name>`，開發完成後再 PR / Merge 回 main。理論上都會是fast-forward merge，因為每個專案彼此獨立。
- 若需同時進行兩個不同 App 的開發，請確保各自在獨立的 Git Worktree 或等單一 App 併入 main 後再開新分支。

### commit 時機點
- 每完成一定的階段時，規劃 commit 訊息並詢問是否提交。

## 8. 初次建立專案時要與使用者共同規劃的重點
- 命名
- 要解決的問題
- 應用場景、scalability
- 專案的 MVP 功能
- 技術路線
