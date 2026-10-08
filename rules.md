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
- 保持各專案文檔 `README.md` 即時更新，方便其他接手的 Agent 快速理解現狀。

---

## 3. 開發規範與工程標準
- **技術選型建議**：每次開始一個新的子專案時，均先調查清楚使用者需求，依照使用場景，比如手機、網頁、desktop app、嵌入式，甚至是跨平台、多平台應用，提供 2～3 種可行的技術路線，做利弊分析後提供給使用者選擇。
  - 若為網頁開發以現代化前端/全端工具為主。
- **依賴管理**：請優先使用同一種套件管理工具（如 `pnpm` 或 `npm`），並在各子專案內維護。
- **程式碼風格**：保持代碼簡潔、型別安全（比如網頁開發的話以 TypeScript 優先），不留下無用的測試檔案或廢棄註解。

---

## 4. 工程文件 `README.md` 
工程文件就是項目開發的說明書，讓 agents 在共同開發時有一致性，使用相同的依賴管理、相同的技術路線，也能參照工作快照快速掌握目前的項目狀態。應包含:

```markdown
# 項目名稱
概要描述，也可以加入這個應用主要畫面的截圖

## MVP
當一個 App 達成 MVP 階段時，主動為對應的 MVP 項目打勾表示完成。

### 核心痛點
條列不超過 5 個核心痛點。

### MVP 核心功能清單
以核取方塊條列不超過 5 個核心功能，若有子功能請縮排一樣條列展示。

## 🛠️ 技術路線
如有符合以下欄位請填入後面內容，沒有符合可自行創建欄位，用不到的欄位請不要新增。範例：
- **前端框架**：React 19 + TypeScript
- **建置工具**：Vite 8
- **依賴管理**：pnpm
- **樣式庫**：Tailwind CSS v4
- **圖示庫**：Lucide React
- **動畫庫**：Canvas Confetti (點擊愛心/互動慶祝微動效)
- **資料庫**：Supabase
- **前端託管**：GitHub + Vercel 
- **Markdown 渲染**：marked 套件
- **留言板**：Giscus + GitHub discussions

## 🚀 安裝與啟動說明

## 💡 使用說明

## 應用架構

## 📋工作快照

請使用表格記錄每次的 commit 或重大架構新增或修正記錄。最新的記錄在最上方。表格標題依序為：
  - 日期
  - Agent （如 Claude Code/ Antigravity/ Codex/... 等）
  - 工作記錄
  - 下一步
  - 備注

## 未來展望（若沒有可留白）

```

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

### 技術討論與概念筆記 (Tech Notes)
當使用者要求記錄某項技術概念或架構討論時：
- Agent 需檢視並比對 `Journey/04_Coding/技術討論與概念/` 資料夾或其子資料夾中的現有文件。
- 比對既有內容：若該主題已存在相關文件，僅增補尚未提及或需深入擴充的部分，避免重複堆疊。
- 若無合適的現有文件，主動創建對應主題的全新 Markdown 筆記進行結構化記錄。

### Frontmatter 更新：
當專案啟動，或使用者提出「更新專案狀態」時，更新 Obsidian 筆記頂部的 YAML 屬性：
- status： 比如 in-progress / completed
- tech_stack
- update_date

### 專案管理
當專案啟動，或使用者提出「更新專案狀態」時，按照目前規劃討論項目分門別類，整理出專案的規劃方向，條列工作項目並估計所需時間。
若已有列好的工作項目，可以按照需求變動新增、刪除或重整。

### 專案筆記
若使用者要求將某些內容記錄到「專案筆記」時，請找到對應的專案 `Journey/04_Coding/100 Apps Challenge/<id>-<appname>.md` ，尋找適合的位置插入筆記。
若筆記內已有相關的概念，或關聯的筆記區塊，可以直接補充或加入。

如果使用者有自訂筆記標題，那就按照使用者標題建立內容。

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
|feat      | 新增功能(Feature)	                 |feat(001): add filter tags for challenge apps|
|fix	     | 修復 Bug	                         |fix(001): resolve layout overflow on mobile screens
|docs 	  | 純文件更新（Markdown、註解）	          |docs: update rules.md with commit conventions
|style	  | 不影響程式邏輯的排版/樣式修改	        |style(001): adjust card border radius and shadow
|refactor  | 重構（既非修 bug 也未增功能的代碼重整）	|refactor(001): extract AppCard into standalone component
|perf	     | 效能提升 (Performance)	              |perf(001): lazy load preview images
|chore	  | 建置工具、依賴項升級或雜項維護	         |chore(root): add pnpm workspace config
|test	     | 新增或修改測試	                      |test(001): add unit tests for date formatter

### 分支（Branch）管理

- 每款 App 採用獨立 App-Branch（以 App 為單位的分支）：如 `<id>-<name>`，開發完成後再 PR / Merge 回 main。
- 若需同時進行兩個不同 App 的開發，請確保各自在獨立的 Git Worktree 或等單一 App 併入 main 後再開新分支。

### commit 時機點
- 每完成一定的階段時，讓使用者確認無誤後才 add 進 repository，並規劃 commit 訊息請求提交。

## 8. 初次建立專案時要與使用者共同規劃的重點
- 命名
- 要解決的問題
- 專案的 MVP 功能
- 應用場景、scalability
- 技術路線
