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
   - 每次任務開始前，明確確認當前正在開發的特定目標應用（例如 `apps/001-Challenge-Showcase/`）。
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

## 3. 開發流程
先建立專案資料夾及工程文件：
- **建立專案資料夾**：在 `apps/` 下，以專案名稱建立專案資料夾，例如 `apps/<id>-<project name>`。
- **建立工程文件**：在專案資料夾下建立工程文件，記錄使用者已提供之規劃方向，內容及結構按照底下「工程文件 `README.md`」的章節說明。

若初次建立專案時，使用者未提供以下幾點資訊（或者不夠詳盡），則進入 plan 模式，與使用者討論出方向：
- **專案命名**
- **要解決的問題**
- **platform 為何**： webapp / iOS / macOS / watchOS / Linux / Windows
- **專案的 MVP 功能**
- **技術路線**： 框架、程式語言、套件或 plugins，第三方服務如資料庫、前端託管服務...
- **資料儲存方案**：本地或雲端服務。
- **安全性、可維護性、可擴展性**：探討 Security、Maintanence、Scalability


## 4. 開發規範與工程標準
- **技術選型建議**：每次開始一個新的子專案時，均先調查清楚使用者需求，依照使用場景，比如手機、網頁、desktop app、嵌入式，甚至是跨平台、多平台應用，提供 2～3 種可行的技術路線，做利弊分析後提供給使用者選擇。
  - 若為網頁開發以現代化前端/全端工具為主。
- **依賴管理**：請優先使用同一種套件管理工具（如 `pnpm` 或 `npm`），並在各子專案內維護。
- **程式碼風格**：保持代碼簡潔、型別安全（比如網頁開發的話以 TypeScript 優先），不留下無用的測試檔案或廢棄註解。


---

## 5. 工程文件 `README.md` 
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

## 💡 使用者應用指南

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

## 🚀 開發者安裝說明


## 應用架構與設計

## 📋工作快照

請使用表格記錄每次的 commit 或重大架構新增或修正記錄。最新的記錄在最上方。表格標題依序為：
  - 日期
  - Agent （如 Claude Code/ Antigravity/ Codex/... 等）
  - 工作記錄
  - 下一步
  - 備注

## 未來展望（若沒有可留白）

```

## 6. showcase 展示
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

## 7. Obsidian 專案紀錄

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

## 8. Git 版控與分支策略
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

### 分支（Branch）架構與管理策略

本專案採用 **「三層分支架構」**，兼顧多 App 獨立性與全域規範的一致性：

1. **`base` 分支（全域基礎骨架）**：
   - **定位**：專門維護 `apps/` 以外的所有全域內容（例如 `rules.md`、`agents.md`、`CLAUDE.md`、`.agents/` 工具集、全域設定檔）。
   - **原則**：**永遠不 merge 任何個別 App 分支或 `main` 分支**，確保骨架絕對純淨。
   - **全域提交**：所有非特定 App 的全域修改，一律切換至 `base` 進行 Commit 與 Push，再合入 `main`。
   - **新專案起點**：未來所有新建立的 App 分支，一律由 `base` 切出：`git checkout -b <id>-<name> base`。

2. **`<id>-<name>` 分支（獨立 App 開發分支）**：
   - **定位**：個別應用的專屬工作分支（例如 `002-Good-Sleep`）。
   - **邊界隔離**：只能在自己的 `apps/<id>-<name>/` 目錄下作業與提交。
   - **同步全域規範（使用 `merge base`）**：
     - 當 `base` 分支有新增 Skill 或更新規範時，進行中的 App 分支一律執行 **`git merge base`** 進行同步。
     - **嚴禁 `git merge main`**（因為 `main` 匯集了所有其他 App 的程式碼，反向 merge 會污染當前 App 分支）。
     - **為何使用 `merge base` 而非 `rebase base`？**
       - 各 App 分支通常已 Push 至遠端 GitHub 供跨平台 Agent 或多裝置接力協同。`rebase` 會改寫 Commit SHA，導致推送時必須強制覆蓋 (`git push --force`)，極易造成協同衝突或覆蓋他方進度。
       - `git merge base` 屬於安全、非破壞性的前進式合併，完全無需 force push，且因為 `base` 只變動根目錄，與 `apps/<id>-<name>/` 完全無衝突。

3. **`main` 分支（生產整合分支）**：
   - **定位**：展示中心與整體專案的最終集大成分支。
   - **職責**：匯總所有已驗證完成的 App 分支，並同步 merge `base` 的全域更新。禁止直接在 `main` 進行個別 App 的功能開發。

### add 的內容與邊界限制
- **App 分支 (`<id>-<name>`)**：只能 `add` 自己資料夾內的項目，即 `apps/<id>-<name>/`。
- **全域分支 (`base`)**：專門 `add` 根目錄 `100 Apps Challenge` 下的全域檔案（如 `rules.md`、`.agents/`、設定檔等）。
- **主分支 (`main`)**：僅執行 `merge` 操作（如 `git merge base`、`git merge <id>-<name>`），不隨意個別 `add`。

### commit 時機點
- 每完成一定的階段時，讓使用者確認無誤後才 add 進 repository，並規劃 commit 訊息請求提交。

---

## 9. 自動化測試規範 (Automated Testing Standards)

### 9.1 核心原則：測試分層與職責邊界 (Testing Philosophy & Anti-Patterns)

所有 AI Agent 在開發、除錯與驗證交付時，必須嚴格落實「測試分層原則」，**嚴禁將純內部邏輯的單元測試全綠，假冒或混淆為前端 UI 與真實互動正常的證明**。

不同層級的測試具有完全不同的檢驗能力與邊界：

1. **內部純邏輯測試 (Unit / Pure Domain Logic Test)**：
   - **檢驗標的**：純函數 (Pure Functions)、演算法、數學與幾何計算、State Store（如 Zustand/Redux）的純 Action 變更邏輯、資料格式轉換器 (Parsers/Serializers)。
   - **運行環境**：Node.js Headless 環境（極速，毫秒級）。
   - **有效性邊界**：僅能驗證「給定輸入 $A$，運算邏輯保證產出 $B$」。**絕對無法保證** 瀏覽器真實 DOM 渲染、組件生命週期、樣式版面或事件監聽沒有崩潰。

2. **隔離環境的整合與契約測試 (Integration / Component / Mocking & Stubbing Test)**：
   - **檢驗標的**：單一 UI 元件渲染、表單互動、API 請求與回應處理、外部第三方服務對接契約。
   - **核心技術**：
     - **Mocking / Stubbing**：使用 MSW (Mock Service Worker)、`vi.fn()` 或假資料庫隔離真實後端 API、OAuth、或外部雲端服務，專注驗證本體邏輯在各種極端回傳狀態（200、401、500、網路斷線）下的容錯與渲染處理。
     - **虛擬 DOM 渲染**：利用 `jsdom` 或 `happy-dom` 搭配 `@testing-library/react` 測試元件虛擬節點的掛載與 Props 變化。
   - **有效性邊界**：能驗證元件樹的結構，但仍缺乏真實瀏覽器排版引擎（Layout Engine）、真實樣式計算、以及真實 DOM 焦點（Focus/Blur）搶奪機制。

3. **外部操作 UI 自動化測試 (E2E / Real Browser Automation Test)**：
   - **檢驗標的**：使用者真實操作鏈、瀏覽器原生焦點互斥與爭奪 (Focus/Blur)、第三方複雜視圖套件（如 ReactFlow 畫布、CodeMirror、Canvas）與外部 Store 的雙向同步、頁面導航、全域例外攔截 (ErrorBoundary)。
   - **運行環境**：真實 Headless 或 Headed 瀏覽器（Chrome / Chromium，透過 Playwright、Puppeteer 或 CDP 協定控制），載入真實 Dev Server 伺服器網址（如 `http://localhost:5173`）。
   - **有效性邊界**：**這是檢驗「畫面會不會黑屏、會不會發生 React Maximum update depth exceeded 死循環」的唯一權威標準**。

> [!CAUTION] 嚴禁偽造或混淆測試截圖 (Anti-Pattern Warning)
> - **嚴禁**使用純數學運算導出的向量檔（如 `exportCanvasAsSvg` 拼裝出的 SVG）渲染成圖片，並將其宣稱為「瀏覽器端功能正常運作的截圖」。
> - 若提供了截圖，必須明確誠實標註其來源：
>   - **真實瀏覽器視窗截圖 (Real Browser Viewport Screenshot)**：必須經由真正的瀏覽器載入真實網頁動態截取。
>   - **演算法拓撲預覽圖 (Algorithmic Topology Preview)**：若為演算法導出圖，必須明確說明僅代表資料拓撲正確，非真實網頁運行結果。

---

### 9.2 開發目標平台測試規範：通用 Web 應用 (Webapp Development)

針對所有 Web 應用（無論是 SPA、SSR、圖形畫布、資料儀表板或一般管理後台），各模組開發與除錯必須依據以下通用矩陣嚴格選型，不得混為一談：

#### A. Web 通用測試選型矩陣 (General Web Testing Matrix)

| 功能架構層級 | 測試範例與場景 | 強制適用測試層級 | 推薦工具與環境 | 關鍵驗證指標與驗收標準 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 商業領域與資料運算**<br>(Domain Logic & Pure Functions) | 業務計算公式、資料結構轉換、表單驗證器 (Zod/Yup)、字串與日期解析、演算法運算 | **內部純邏輯測試<br>(Unit Test)** | Vitest / Jest<br>(Node.js 極速環境) | 純輸入輸出斷言、邊界極值 (空值/負數/極大集合)、無副作用 (Pure & Deterministic) |
| **2. 狀態管理與本機持久化**<br>(State Management & Storage) | 全局 Store Action/Reducer (Zustand/Redux/Pinia)、快照回滾 (Undo/Redo)、本機儲存 (LocalStorage/IndexedDB) | **內部狀態機測試<br>(State Machine Test)** | Vitest + 記憶體儲存<br>(如 fake-indexeddb) | 狀態不可變性 (Immutability)、Action 冪等性、資料結構遷移 (Schema Migration) |
| **3. 網路通訊與外部服務契約**<br>(API & Network Layer) | RESTful API、GraphQL 查詢、WebSocket 連線重試、第三方授權 (OAuth/SSO)、雲端資料庫 | **Mocking & Stubbing 測試<br>(Integration Test)** | MSW (Mock Service Worker)<br>/ `vi.fn()` / `nock` | 網路逾時重試機制、4xx/5xx 錯誤優雅降級 (Graceful Degradation)、Payload 契約符合度 |
| **4. 獨立 UI 元件與展示邏輯**<br>(Component & Presentation) | 按鈕禁用/啟用狀態、Modal 彈窗開關、下拉選單展示、複合條件標籤渲染、表單即時提示 | **元件整合測試<br>(Component Integration)** | Testing Library + Vitest<br>(jsdom / happy-dom) | 虛擬 DOM 渲染、ARIA 無障礙屬性、元件 Props 響應式變化、事件派發 (userEvent) |
| **5. 複雜操作鏈與焦點互動**<br>(User Journeys & Interactive UI) | 跨組件鍵盤快捷鍵、輸入法 (IME) 組字、表單焦點競爭 (Focus/Blur)、第三方複雜畫布/圖表同步、頁面導航 | **外部操作 UI 自動化測試<br>(E2E Browser Test)** | Playwright / Puppeteer / Headless Chrome (連線真實伺服器) | **真實 DevTools Console 零 Error**、無 React #185/循環渲染崩潰、焦點與游標轉移正確、ErrorBoundary 零攔截 |
| **6. 跨裝置排版與視覺回歸**<br>(Responsive & Visual Quality) | RWD 斷點適配 (Mobile/Tablet/Desktop)、深淺色模式 (Dark/Light)、字級縮放、複雜排版截斷 | **真實視窗截圖測試<br>(Visual Regression)** | Playwright `page.screenshot()`<br>/ CDP 視窗截圖 | 必須截取自真實瀏覽器渲染之 Viewport，**嚴禁使用純資料計算導出之向量圖假冒網頁截圖** |

#### B. 網頁 Bug 修復標準驗證程序 (Webapp Bug Fix Verification SOP)

當遇到的 Bug 涉及以下情境時，**嚴禁僅以單元測試綠燈宣告修復完成**：
1. **涉及 UI 渲染死循環**：例如 `Maximum update depth exceeded`、React Error #185、`useEffect` 依賴無限重入。
2. **涉及原生 DOM 焦點競態**：例如 `<input onBlur>` 觸發存檔但與其他元件的 `.focus()` 或鍵盤事件互相搶奪焦點。
3. **涉及第三方複雜 UI 套件**：例如圖表、畫布、富文本編輯器內部狀態與全局 Store 的雙向同步問題。

**標準驗收三步驟**：
1. **根本修復**：在元件或 Store 層消除問題根源（消除乒乓事件、阻斷不必要的 Re-render）。
2. **真實瀏覽器重現檢驗**：啟動 Dev Server，以真實瀏覽器（Headless/Headed Chrome）導航至真實頁面，模擬使用者出錯的操作鏈。
3. **雙重斷言檢驗**：
   - 檢查真實瀏覽器 Console Log，確認無任何未捕獲的例外或錯誤日誌。
   - 對真實瀏覽器視窗進行實際截圖，提供使用者作為真實環境驗收之依據。

---

### 9.3 開發目標平台測試規範：Apple 原生應用 (iOS / iPadOS / macOS)

針對以 Swift / SwiftUI / UIKit / AppKit 開發之 Apple 生態系應用專案，各層級測試必須嚴格落實以下規範：

#### A. Apple 原生應用測試選型矩陣 (Apple Native Testing Matrix)

| 功能架構層級 | 測試範例與場景 | 強制適用測試層級 | 推薦工具與環境 | 關鍵驗證指標與驗收標準 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 領域邏輯與架構狀態**<br>(Domain, Model & ViewModels) | ViewModels 業務邏輯、TCA / Redux Reducers、業務計算、Codable JSON 序列化/反序列化、資料驗證 | **內部邏輯單元測試<br>(Swift Testing / XCTest)** | Swift Testing (`@Test`)<br>/ `XCTestCase` (Hostless) | 純 Swift 邏輯斷言、非同步狀態 (`async/await`) 正確性、極端數值處理、無 UI 依賴 |
| **2. 資料庫與持久化引擎**<br>(Data Persistence & SwiftData) | SwiftData / CoreData CRUD、關聯級聯刪除 (Cascade Delete)、查詢分頁、Schema 版本遷移 (Migration) | **記憶體持久化測試<br>(In-Memory Container)** | SwiftData in-memory `ModelContainer` / CoreData in-memory Store | 模型關聯完整性、並行寫入安全 (Concurrency Safety)、資料庫遷移無資料遺失 |
| **3. 網路與外部系統契約**<br>(Networking & System Services) | RESTful API 請求、URLSession 封裝、離線快取回退、StoreKit 交易、Keychain / UserDefaults | **隔離模擬與契約測試<br>(Mocking & URLProtocol)** | `URLProtocol` 自訂攔截 / Protocol-Oriented DI / StoreKit Test Configuration | 模擬 200/401/500/Timeout 與無網路狀態、驗證 Token 刷新機制、StoreKit 沙盒交易流程 |
| **4. 真實使用者互動與手勢**<br>(User Interaction & Navigation) | 畫面轉場導航 (NavigationStack)、複雜手勢 (Drag, Long Press, Pinch)、軟體/硬體鍵盤彈出遮擋、多工處理 | **外部操作 UI 自動化測試<br>(XCUITest)** | `XCUIApplication`<br>(Xcode 模擬器 / 實機) | 元素可存取性 (Accessibility Identifier 標註)、無死鎖與 Main Thread 凍結、Navigation 棧無循環堆疊 |
| **5. 平台專屬視窗與多工特性**<br>(Platform-Specific Multi-tasking) | **iPadOS**：Split View / Slide Over / Stage Manager 視窗縮放；<br>**macOS**：選單列 (Menu Bar)、多視窗切換、快捷鍵綁定 | **跨視窗與多工整合測試<br>(XCUITest Multi-Window)** | Xcode 模擬器 (iPad & Mac Catalyst / AppKit) | 視窗動態改變尺寸時版面無爆版、macOS Menu 快捷鍵正確響應、多視窗狀態一致性 |
| **6. 視覺快照與無障礙驗證**<br>(Visual Snapshot & A11y) | 動態字級縮放 (Dynamic Type)、深淺色外觀 (Dark/Light Appearance)、多國語言排版截斷、高對比模式 | **像素級視覺快照測試<br>(Snapshot Testing)** | `swift-snapshot-testing`<br>(Point-Free) | 跨尺寸螢幕精準像素比對 (iPhone SE, Pro Max, iPad Pro, Mac Retina)、極限大字體無截斷 |

#### B. Apple 原生 Bug 修復標準驗證程序 (Apple Bug Fix Verification SOP)

當遭遇以下類型的 Bug 時，**嚴禁僅以 XCTest 單元測試通過宣告修復完成**：
1. **涉及記憶體洩漏與循環引用 (Memory Leaks & Retain Cycles)**：
   - 必須撰寫自動化測試驗證實例銷毀：使用 `weak var` 搭配 `addTeardownBlock` 斷言 `instance == nil`。
   - 透過 Xcode Instruments (Leaks / Allocations) 驗證無殘留物件。
2. **涉及主執行緒阻塞與紫標警告 (Main Thread Hangs & Concurrency Violations)**：
   - UI 相關操作必須標註 `@MainActor`，開啟 Main Thread Checker 驗證零紫標警告。
3. **涉及鍵盤遮擋與第一響應者 (First Responder & Keyboard Avoidance)**：
   - 必須透過真實模擬器執行 XCUITest 或真機驗證，確認 TextField 獲得焦點時畫面平滑滾動，鍵盤收起時無死白或焦點遺失。



