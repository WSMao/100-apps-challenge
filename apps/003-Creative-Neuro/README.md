# 003 - Creative-Neuro

融合 Xmind 的絲滑操作體驗、Mermaid 的純文字與 AI 雙向驅動，以及無限白板的多對多自由連結，打造打破心智圖與流程圖界線的「Any Chart」視覺化思考工具。

## MVP

### 核心痛點
1. **工具功能單一或割裂**：市面軟體往往將「心智圖（一對多）」、「流程圖（多對多）」與「自由白板」硬性切開，無法在同一張圖中自然演進與共存。
2. **自動排版與手動微調衝突**：如 Mermaid.ai 從自動排版（Auto）切回手動調整（Manual）時版面容易錯亂，且修改程式碼後無法保留手動微調的座標。
3. **高昂訂閱與格式封閉**：主流進階工具多採昂貴訂閱制，且不易產生輕量可嵌入筆記軟體、網頁或投影片的互動連結。
4. **缺乏即時語音 AI 共同繪圖體驗**：思考發散時，缺乏能像真人討論般「邊用口語對話、AI 邊即時在畫布上生成與調整架構圖」的流暢協作模式。

### MVP 核心功能清單
- [x] **Phase 1：初版核心畫布與雙向同步引擎（All-in-One 一次到位 Web MVP）**
  - [x] **1. 工作空間與基礎無限畫布**：
    - [x] 實作 `Project → Board → Page → Canvas → CanvasObject` 扁平化單一陣列架構與頂部 `Page Tabs` 多分頁切換
    - [x] 內建預設展示專案（Seed Project）與 `Dexie.js` (IndexedDB) 本機自動存檔、一鍵重置範例
    - [x] 支援無限次復原與重做（`Cmd+Z` / `Cmd+Shift+Z`，基於 `zundo`）
    - [x] 實作基礎物件：`ShapeObject`、`TextObject`、`ConnectorObject`（含 **SVG 交錯跳線 Line Jumps** 與流動動畫）、`FrameObject`、`FreehandObject`（手繪塗鴉）及 `PageObject`（跨頁跳轉卡片）
  - [x] **2. `DiagramObject` 雙模式互動與極速鍵盤流**：
    - [x] 支援狀態 A（畫布內嵌模式：直接點擊內部節點改字、移動）與狀態 B（雙擊進入專注編輯模式：鏡頭聚焦鎖定並展開左側編輯器）
    - [x] 支援滑鼠懸停節點邊框四向箭頭、快捷鍵 `⌥+方向鍵`、`Tab`（子節點）、`Enter`（兄弟節點）極速新增節點與連線
    - [x] 實作 `Manual` 模式下的智慧空位搜尋演算法（方向基準偏移 + 兄弟節點自動排隊 + AABB 碰撞偵測避障）
  - [x] **3. Mermaid 雙向同步與混合排版引擎**：
    - [x] 左側 CodeMirror 6 編輯器支援 Mermaid `flowchart / graph` 語法與右側圖形雙向即時同步（Node ID 對帳保留手動座標）
    - [x] 整合 `elkjs` 支援 `Auto-ELK`、`Manual`、`Fixed` 三態無損切換，以及 `sub-graph` 局部排列方向設定與收折（Fold / Collapse）
    - [x] 支援一鍵匯出為 `Mermaid`、`JSON`、`SVG`、`PNG`（含 `pako` 壓縮原始碼內嵌圖片 Metadata 支援拖回還原）
- [ ] **Phase 2：AI 即時語音與雲端嵌入擴充**
  - [ ] 串接 `Gemini Live API / OpenAI Realtime API`（WebSocket/WebRTC + VAD + Function Calling 邊講話邊畫圖）
  - [ ] 串接 `Supabase` 一鍵產生雲端互動嵌入連結（Embed URL）與 `Tauri 2.0` macOS 全螢幕原生封裝

## 💡 使用者應用指南
1. **多頁工作區切換（Page Tabs）**：
   - 開啟即自動載入三頁互動式展示專案：`1. Mindmap Brainstorming`、`2. System Architecture`、`3. Mermaid Flow & Sub-Diagram`。
   - 可透過頂部標籤列新增分頁、雙擊標籤改名、刪除分頁，或點擊「Reset Demo」一鍵還原預設範例。
2. **無限畫布與工具列（Toolbar）**：
   - 左側懸浮工具列支援切換：`Select (V)`、`Shape (S)`、`Text (T)`、`Connect (C)`、`Freehand Draw (D)`、`Frame (F)`、`Sub-Diagram (M)`。
   - 支援在畫布上自由繪製具有擬真筆壓感的手繪塗鴉（`perfect-freehand`），以及將節點拖入 `Frame` 容器並一鍵收折/展開（Fold / Collapse）。
3. **極速鍵盤發想流（Xmind 風格快捷鍵）**：
   - 選取任意節點後：按 `Tab` 在右側產生子節點、按 `Enter` 在下方產生並排兄弟節點、按 `⌥ + ↑/↓/←/→`（或懸停節點點擊四向 `+` 按鈕）朝指定方向衍生新節點（內建 Minkowski Sum AABB 碰撞避障，絕不重疊）。
   - 雙擊節點即可行內編輯文字；按 `Backspace / Delete` 刪除選取節點與附屬連線；按 `Cmd+Z` / `Cmd+Shift+Z` 無限次復原與重做。
4. **`DiagramObject` 雙模式與 Mermaid 雙向同步**：
   - 在畫布上雙擊 `Diagram` 物件（或點擊右上角 `Focus Mode`）即可進入全螢幕雙欄專注模式（左側 CodeMirror 6 編輯器 + 右側專屬互動畫布）。
   - 修改左側 Mermaid 語法時，透過 **Node ID 對帳引擎（Reconciliation）** 自動保留已手動微調（`manual` / `fixed`）節點的精確座標，並可隨時透過 `Auto-ELK` 一鍵進行階層式自動排版。
5. **多格式匯出與圖片無損還原（Export & Lossless Restore）**：
   - 點擊右上角「Export / Import」可匯出 `.mmd`（Mermaid 語法）、`.neuro.json`（完整專案檔）、`.neuro.svg` 與 `.neuro.png`。
   - 匯出的 `.neuro.png`（透過 PNG `tEXt` chunk）與 `.neuro.svg`（透過 `data-neuro-payload` 屬性）皆內嵌經 `pako` (zlib) 壓縮的完整專案狀態，直接將匯出的 PNG 或 SVG 圖片拖入匯入視窗即可 100% 無損還原所有分頁、節點座標與排版狀態！

## 🛠️ 技術路線
- **前端框架**：React 19 + TypeScript
- **建置工具**：Vite 6
- **依賴管理**：pnpm
- **樣式與 UI 庫**：Tailwind CSS v4 + Lucide React
- **核心圖形畫布引擎**：`@xyflow/react` (React Flow v12, HTML DOM + SVG 混合渲染) + `perfect-freehand` (手繪筆跡)
- **自動排版引擎**：`elkjs` (Eclipse Layout Kernel，支援複合子圖與多方向佈局)
- **程式碼編輯器**：CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`)
- **狀態與歷史管理**：Zustand v5 + Immer + Zundo (Undo/Redo)
- **本機與雲端儲存**：Dexie.js v4 (IndexedDB 本機離線優先，含 500ms Debounce 自動存檔)
- **匯出與壓縮封裝**：`html-to-image` + `pako` (zlib 壓縮原始碼嵌入 PNG `tEXt` chunk 與 SVG Metadata)
- **AI 即時語音與協作**：Gemini Multimodal Live API / OpenAI Realtime API (Phase 2 擴充)
- **桌面端跨平台封裝**：Tauri 2.0 (Phase 2 擴充)
- **自動化測試**：Vitest + Node Native TypeScript Runner（共 198 項自動化測試：54 項 Store/Persistence 壓力測試 + 90 項四大演算法引擎單元與對抗測試 + 54 項四層級 E2E 整合測試）

## 🚀 開發者安裝說明
```bash
# 1. 安裝依賴套件
pnpm -C apps/003-Creative-Neuro install

# 2. 啟動本地開發伺服器 (Vite HMR)
pnpm -C apps/003-Creative-Neuro dev

# 3. 執行完整自動化測試套件 (Store + 4 Engines + 4-Tier E2E)
pnpm -C apps/003-Creative-Neuro test

# 4. 執行型別檢查與生產環境打包 (tsc -b && vite build)
pnpm -C apps/003-Creative-Neuro build
```

## 應用架構與設計
- **統一 Scene Graph 架構**：打破外層 `Canvas` 與內層 `DiagramObject` 的雙引擎界線，統一以 `@xyflow/react` 嵌套容器（Parent-Child Grouping）實現 `FrameObject`、`sub-graph` 與 `DiagramObject`。
- **結構與幾何分離對帳（Node ID Reconciliation）**：以 JSON Store 作為唯一真實資料源，獨立記錄每個節點的 `position` 與 `layoutMode ('auto-elk' | 'manual' | 'fixed')`，確保 `Auto-ELK` 與 `Manual` 切換不亂跳、Mermaid 雙向修改不遺失手動座標。
- **五層由下而上模組化架構（Bottom-Up 5-Layer Architecture）**：
  1. `Layer 1 (src/types & src/store)`：核心型別、Zustand/Immer/Zundo 狀態樹與 Dexie 本機持久化。
  2. `Layer 2 (src/engine)`：Mermaid AST 雙向對帳、ELK 複合圖排版、Manual AABB 空位避障與 SVG 跳線純函數引擎（配屬 Vitest 單元測試）。
  3. `Layer 3 (src/components/canvas)`：自訂圖元（Shape/Text/Frame/Diagram/Freehand）與跳線 Edge。
  4. `Layer 4 (src/components/editor)`：專注模式左側 CodeMirror 6 雙向編輯器與排版模式切換器。
  5. `Layer 5 (src/components/workspace)`：頂部 Page Tabs、左側工具列、全域快捷鍵（`Tab`/`Enter`/`⌥+方向鍵`）與匯出系統。

## 📋工作快照

| 日期 | Agent | 工作記錄 | 下一步 | 備注 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-27 | Antigravity | 實作節點周邊四向（上右下左）按鈕新增物件時自動建立連接線（Edge）與立即選中新節點（清空前一節點選取），修正 Handle ID 與 JumpConnectorEdge 反向規格相容，並於 `tests/requirements.test.ts` 新增全覆蓋測試，全量 247 項測試與生產建置 100% 通過 | 持續優化畫布連線與衍生節點操作細節 | 247/247 Tests PASS |
| 2026-10-27 | Antigravity | 實作畫布點擊單一節點鍵盤直接輸入修改內容（Direct Type-to-Edit，支援可列印字元、空格、中文輸入法 IME Process/compositionstart、Shift+Enter/F2 明確編輯、預設佔位文字自動替換、既有自訂文字末端追加且防止誤刪、編輯期間熱鍵抑制防護、Diagram 節點排除保護、分頁切換乾淨清理），全量 242 項自動化測試 100% 通過 | 持續針對畫布互動與專案功能進行驗證優化 | 242/242 Tests PASS |
| 2026-10-27 | Antigravity | 徹底排查並解決框選兩連接節點及其連線時之無限迴圈崩潰（在 `handleEdgesChange` 中過濾 incident edge 之 `select` 異動阻斷雙通道衝突、解耦 `userSelectionActive` 確保回呼函式參考穩定、建立組件與 Store 雙層冪等性防護網），全量 242 項自動化測試 100% 通過 | 持續針對畫布互動與專案功能進行驗證優化 | 242/242 Tests PASS |
| 2026-10-27 | Antigravity | 深度排查並修復框選邏輯（清除手動拖曳後殘留之 dragging 標記避免異常選中）、選取工具選單操作按鈕樣式一致化、文字節點無背景色多層淨化，通過全量 183 項自動化測試與生產打包 | 持續優化畫布互動體驗與功能迭代 | 183/183 Tests PASS |
| 2026-10-26 | Antigravity | 完成 Phase 1 All-in-One Web MVP 五層模組化全量實作（Layer 1 Zustand/Immer/Zundo/Dexie、Layer 2 四大純函數演算法引擎、Layer 3 React Flow v12 畫布與自訂節點/跳線/手繪、Layer 4 CodeMirror 6 雙向專注編輯器、Layer 5 多頁標籤/快捷鍵/Pako PNG & SVG 匯出還原），並通過全部 198 項自動化測試與生產環境建置 (`tsc -b && vite build`) | 進入瀏覽器實機體驗微調或啟動 Phase 2 AI 即時語音與雲端嵌入功能 | 198/198 Tests PASS |
| 2026-10-25 | Antigravity | 完成啟動前總體架構審視、將 MVP 1~3 升級為「All-in-One 一次到位 Web MVP」，並確立五層模組化實作藍圖與 Vitest + E2E 雙層自動化測試策略 | 依據五層模組化藍圖初始化專案並一次實作完成 Phase 1 初版與自動化測試 | 架構契約完備 |
| 2026-10-25 | Antigravity | 完成五大競品底層架構調研（`docs/市場競品調查.md`），並透過架構訪談確立 `Creative-Neuro` 完整技術路線與四大核心機制，同步更新至 Obsidian 筆記與 `README.md` | 初始化 React 19 + TypeScript + Vite + `@xyflow/react` 專案環境，開始實作 MVP 第 1 階段 | 專案定名為 `003-Creative-Neuro` |
| 2026-10-24 | Antigravity | 建立子專案空間，初始化工程文件、規範設定與工作快照 | 討論並確立技術路線、前端框架與畫布渲染引擎 | 初始建立 |

## 未來展望
- 支援 macOS Tauri 2.0 本地全螢幕無干擾模式。
- 探索 `.xmind` 格式檔案逆向解包與一鍵無損匯入。
- 支援 `.neuro.svg` / `.neuro.png` 圖片內嵌壓縮原始碼，拖入圖片即可無損還原可編輯畫布。
