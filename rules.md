# 100 Apps Challenge - AI Agents 開發協作守則 (rules.md)

本文件為整個儲存庫中所有 AI Agent 的最高原則，在本專案進行任何操作前，務必詳讀並遵守本文件內容。
- 如果本文件有變更，需立即重新讀取，確保遵守最新規範。
- 任何 Skills 均不得違反本文件規範，若有衝突，請以本文件規範作為指引；若還是沒有明確執行方向，請停下來詢問，得到回覆後再繼續。

---

## 1. 專案背景與定位
- 本儲存庫為 **100 Apps Challenge** 專案集合，目標是打造 100 個獨立、高質感、且具實用性或趣味性的應用專案。所有獨立應用皆放置於 `apps/` 目錄下，並建立自己專屬的子資料夾：
- 每個專案資料夾的命名與編號規範為 `apps/<id>-<app-name>`：
  - `<id>` 為第幾號應用。
  - `<app-name>` 為專案名稱，若專案開始時開發者未提供專案名稱，那就按照討論細節，提供 5 個符合命名規範的名稱供開發者評估選擇（例：`001-my-todos`）

---

## 2. Agent 進行獨立應用開發時應遵守

### 🔒 邊界意識 (Scope Isolation)
1. **嚴格限制操作範圍**： 每次任務開始前，明確確認當前正在開發的專案項目，**禁止** 修改 `apps/` 下其他子資料夾中的內容。
2. **根目錄變更謹慎度**： 根目錄下（`rules.md`、`CLAUDE.md`、`agents.md`、workspace 設定等）屬於全域設定，除非開發者明確要求，否則不得任意更動。

### 📦 獨立與自包含 (Self-contained Apps)
- 每個位於 `apps/<id>-<app-name>` 的子專案應維持高度自包含（擁有各自獨立的建置設定如`package.json`，以及專案說明文件 `README.md`）。
- 避免不同應用之間產生隱性依賴，確保單一應用的更動不會破壞其他應用。

### 📝 狀態與變更透明 (Transparency & Auditability)
- 進行任何重大結構改動、安裝新套件或修改核心邏輯前，需向開發者確認。

---

## 3. 初始化專案
先建立專案資料夾及說明文件：
- 在 `apps/` 下，以專案名稱建立專案資料夾 `apps/<id>-<app-name>`。
- 在專案資料夾下建立 `README.md` 說明文件，內容結構遵循 `project-docs` skill。

若初次建立專案時，開發者未提供以下幾點資訊（或者不夠詳盡），則進入 plan 模式，與開發者討論出方向：
- **專案命名**
- **要解決的問題**
- **目標 Platform 為何**： webapp / iOS / macOS / watchOS / Linux / Windows。
- **專案的 MVP 功能**
- **技術路線**： 框架、程式語言、套件或 plugins，第三方服務如資料庫、前端託管服務...。
- **資料儲存方案**：本地或雲端服務。
- **安全性、可維護性、可擴展性**：探討 Security、Maintenance、Scalability。

**提供技術選型建議**：按照開發者需求，依照使用場景，目標平台甚至是跨平台、多平台應用，提供 2～3 種可行的技術路線，做利弊分析後提供給開發者選擇。

👉 **引導與規格工具推薦**：
- 需求深入盤查與架構決策：調用 `/grill-me` skill 進行問題樹訪談。
- 討論成案與規格產出：調用 `/to-spec` skill。
- 將規格轉換為工作項目 Issues：調用 `/to-tickets` skill。
- 互動與架構可行性探索：調用 `/prototype` skill 建立拋棄式原型。

### 初始化 GitHub Issue/Project Label
- **App 標籤**：開發 App 時，請確認對應該 App 的標籤 `app-<NNN>` 已存在（`gh label list`）；若不存在須先用 `gh label create` 建立。

---

## 4. 開發流程 (Development Workflow)

開發者若沒有明確表示「直接開發」，就不要直接開發，而是按照「mattpocock skills」流程：
1. `/grill-me`：釐清需求與設計決策。若過程需要同步沉澱領域名詞或架構決策，改用 `/grill-with-docs`。
2. `/to-spec`：產出規格 Spec Issue。
3. `/to-tickets`：把較大的 Spec Issue 拆成數個較小的 Issues。
4. 由開發者下命令觸發：
   - `/implement <ticket>`：單張 ticket，遵循 `/tdd`，完成後自動呼叫 `/code-review` 檢查。
   - `/implement-spec`：整份規格含多張 ticket，按 ticket 依賴圖由多個 subagent 平行實作（每個 subagent 遵循 `/tdd`），合併到整合分支，完成後自動呼叫 `/code-review` 檢查。
5. `/pr`：`/code-review` 檢查沒問題後，先透過 Skill 工具載入並遵循 `pr` skill，再建立 PR 到專案主分支，由開發者審核與合併。實際 GitHub 操作可使用 `gh` CLI，但不得以直接執行 `gh pr create` 取代 `pr` skill 的流程。

走「mattpocock skills」流程需按照上述步驟一一執行。
- `/grill-me` 到 `/to-tickets` 這幾個階段需要開發者決策，請引導開發者一步步的執行，在 `/to-tickets` 之後停下來等開發者下一步指示。
- 從開發者下達實作命令 `/implement` 或 `/implement-spec` 時，Agent 才開始自動做開發工作。

### 分支與 PR 規則
- **分支命名**：一律為 `feat/<project>/#<issue>-<描述>`（參見 `/monorepo-gitflow` skill），`<issue>` 為 GitHub Issue 編號。issue 跟 ticket 是同一個概念，只是用詞不同，`/implement` 單張 ticket 就是對應到該 ticket 的 Issue 編號，`/implement-spec` 的整合分支用規格 Issue 的編號，該規格下開出來的 ticket 也是同樣用 Issue 編號為分支命名。
- **`/implement`**：從專案主分支切出對應分支；每張 ticket 各發一個 PR。
- **`/implement-spec`**：每張 ticket 各有自己的分支與 worktree，完成後合併進整合分支並清除，不單獨發 PR；只有整合分支發 PR 到專案主分支。
- **發 PR 之後**：Agent 不得自行合併。若還有不被未合併 PR 擋住、可並行的 ticket，就繼續執行，讓開發者有空時能一次審核多個 PR。

---

## 5. 專案文件 (Documentation Architecture)

本專案文件嚴格遵守 Single Source of Truth 原則，按用途分為 4 種：
1. **公開展示用 (`apps/<id>-<app-name>/README.md`)**：面向 GitHub 訪問者（使用者與外部開發者），專注產品解決了什麼問題，提供什麼價值。
2. **動態任務用 (GitHub Projects & Issues)**：日常 Sprint、功能拆票（`/to-tickets`）、Bug 追蹤與阻擋依賴。
3. **架構知識用 (`GLOSSARY.md` & `docs/adr/`)**：領域專有名詞與架構決策（遵循 `/domain-modeling` skill）。
4. **個人認知用 (Obsidian 筆記庫)**：個人做中學反思與技術深入探討。

詳細規範請一律參照 `project-docs` skill 及其[範本](.skills-repo/wsmao/project-docs/resources/app-readme-template.md)進行撰寫或重構。

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

## 7. Obsidian 專案與知識庫紀錄

專案筆記為開發者構思專案原型想法、沉澱技術概念以及記錄開發過程的地方。
當需要將對話精華、技術概念或新點子保存至個人 Obsidian 知識庫時，請一律調用：

👉 **`/to-obsidian-note` skill**（支援全對話導出 `/to-obsidian-note all` 與分類提取 `/to-obsidian-note <category> <scope> <style>`，並嚴格遵循技術討論比對與點子分類規則）。


## 8. Git 與 GitHub 規範

本專案為多個子專案的架構，故採用 monorepo 方式建立 GitHub 儲存庫，並以 GitHub Project 來管理任務。

Agent 開發前務必確認任務與邊界，使用正確的分支進行開發。比如應確認 GitHub Issue 的 label 標籤，像是從 `app-<NNN>` 得知執行中的任務是屬於那個 app 的範疇。

此 Repository 中的每個獨立子專案都是一個 app，其「專案主分支」(`<project-name>`) 的命名規則為 `<id>-<app-name>`。

提交訊息採用 Conventional Commit message 的格式 `<type>(<scope>): <description>`。
其中 `<scope>` 應視變更範疇而定：
  - App 變更：`<scope>` 為 3 碼 App 編號（例如 `001`、`002`）。
  - 全域變更：`<scope>` 為 `base`（例如 `feat(base): ...`）。

👉 這邊沒有明確規範到的 git 使用操作，請遵守 `/monorepo-gitflow` skill 的規範。

### 資安防護
- 禁止 Commit 敏感憑證：各 App 必須在自己的目錄或全域 .gitignore 中明確排除 .env、*.local、金鑰文件。
- 任何 Agent 建立新 App 時，必須同時建立範例環境檔 .env.example。

---

## 9. 自動化測試規範 (Automated Testing Standards)

### 9.1 測試設計原則與分層邊界 (Testing Principles & Boundaries)

測試設計與實作一律以 **TDD skill** 為最高設計指導：
- **核心心法**：測試只驗證公開介面（Public Seams）可觀察的功能行為，嚴禁依賴私有變數或原始碼字串等實作細節（詳見 TDD 之 Anti-patterns）。
- **紅綠循環與 Mock 邊界**：遵循 Red-Green 逐步推進，Mock 僅限於系統外部邊界（API、資料庫、時間），嚴禁 Mock 內部協作者。
- **可核對的 TDD 紀錄**：每個實作 ticket 的 Agent 必須按垂直切片遵循「先新增或修改行為測試並執行至 Red，再寫最少實作使該測試 Green，最後執行相關回歸測試」的順序。完成回報須逐個列出代表性測試名稱及 Red、Green 的實際結果（例如失敗／通過的測試輸出或診斷），並列出最後執行的回歸測試結果；僅回報最終測試通過不算紅綠循環證據。若變更不適用自動化測試、無法觀察 Red，或環境阻礙執行，須明確說明原因與實際完成的驗證，不得宣稱已完成 Red-Green。
- **疑難排查**：疑難 Bug 與效能回歸遵循 **Diagnosing Bugs skill** 建立 Feedback Loop 迴圈。

> [!CAUTION] 測試分層防禦與誠實驗證原則 (Anti-Cheat & Layered Boundaries)
> 1. **嚴禁用單元測試假冒 UI 正常**：純內部邏輯測試通過僅代表運算無誤，**絕對無法保證**真實 DOM 渲染、組件生命週期與事件監聽沒有崩潰。
> 2. **嚴禁偽造瀏覽器截圖**：嚴禁使用純資料計算導出的向量圖（如 `exportCanvasAsSvg` 拼裝之 SVG）渲染成圖片宣稱為「網頁運作截圖」。截圖必須誠實標註來源，真機驗收必須取自真實瀏覽器 Viewport。

---

### 9.2 開發目標平台測試規範：通用 Web 應用 (Webapp Development)

針對所有 Web 應用（無論是 SPA、SSR、圖形畫布、資料儀表板或一般後台），依功能層級嚴格對應測試選型，並遵守 Bug 修復驗收標準：

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
3. **雙重斷言檢驗**：檢查真實瀏覽器 Console Log 確認零 Error，並對真實視窗實際截圖存證。

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

---

### 9.4 測試豁免與輕量化驗收規範 (Test-Exempt Fast-Track)

為避免 AI Agent 陷入「過度防衛型無效測試（Over-testing / Testing Overkill）」或因瑣碎變更無端耗費驗證成本，特別明定以下豁免條款：

#### 全面免除自動化測試的場景 (Test-Exempt Scenarios)
當變更僅涉及以下任一類型時，**嚴禁無差別執行全套測試套件（如 `test:unit`、`test:engine`、`test:e2e`）**：
1. **純靜態資源與多媒體檔案（Assets Only）**：
   - 包含：圖片（PNG/SVG/WebP/ICO）、圖示、Favicon、音訊、字型等檔案新增或覆蓋。
   - 包含：僅修改組件中靜態資源的 `import` 路徑（例如更換 Logo 檔名）。
2. **純文案與國際化翻譯（Copywriting & i18n Strings）**：
   - 按鈕標籤、介面說明、Tooltip 提示詞、錯誤訊息字串調整。
3. **純樣式外觀微調（Styling & Cosmetic Tweaks）**：
   - 微調 Tailwind 顏色色碼、邊框圓角、間距（Padding/Margin）、文字顏色等純視覺屬性（未改動組件結構與條件渲染邏輯）。
4. **專案文件與註解（Documentation & Comments）**：
   - `README.md`、架構圖、程式碼註解、JSDoc / TypeScript 註解或檔案整理。

**免測場景的輕量化驗收標準**：
- 僅需透過開發伺服器（如 Vite HMR）確認熱重載編譯通過、無語法/路徑報錯，並於瀏覽器視窗直接預覽確認即完成驗收。

---

## 10. Agent Skills 規範 (Agent Skills Workflow)

本專案支援由 [mattpocock/skills](https://github.com/mattpocock/skills) 擴充之工程與生產力工作流程。當在對話中使用相關技能（如 `/to-spec`、`/to-tickets`、`/implement`、`/grill-with-docs`、`/triage`）時，遵循以下統一規格：

所有自訂與引入的 skills 以 `.skills-repo/` 為唯一來源，依 skill 名稱使用；本文件不重複列出已安裝 skills 的載入路徑。

### Skill 正式載入

- 當工作流程、使用者指令或其他 Skill 要求使用某個 Skill 時，必須先透過 Skill 工具以該 Skill 的正式名稱載入，再依其指引執行。
- 閱讀 `SKILL.md` 可用於補充理解或查閱細節，但不等同於透過 Skill 工具載入，也不能取代載入步驟。不得只閱讀 Skill 文件便宣稱已使用或載入該 Skill。
- Skill 工具載入後若要求閱讀相關文件，仍須閱讀；工具載入與閱讀文件是可並行要求的步驟，不可互相替代。
- 建立、撰寫或發布 Pull Request 前，必須先載入 `pr` Skill 並遵循其流程；GitHub 的實際操作使用 `gh` CLI 不構成略過此要求。

### Issue tracker

GitHub issues & projects via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage vocabulary with `triage:` prefix (`triage: needs-triage`, `triage: needs-info`, `triage: ready-for-agent`, `triage: ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout (`GLOSSARY-MAP.md` mapping to per-app `apps/<id>/GLOSSARY.md` & `apps/<id>/docs/adr/`). See `docs/agents/domain.md`.



