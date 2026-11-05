# 003 - Creative-Neuro

> 以無限白板打造視覺化思考工具，讓各種形式的視覺化內容，能夠同時呈現並關聯。同時能與 AI 以文字或語音即時交互，共同協作激發創意。

[![Status](https://img.shields.io/badge/Status-Active-emerald.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()
[![React](https://img.shields.io/badge/React-19-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)]()

---

## 🎯 核心痛點與特色 (Why Creative-Neuro?)

1. 市面上有許多好用的「心智圖」、「流程圖」以及「自由白板」的繪圖工具，但鮮少有同時做好這三種解決方案的工具。你可能需要個別向三家廠商付費以取得最好的使用體驗。
2. 流程圖也有分手動拖放建置以及靠 Mermaid 語法定義並自動排版建置的兩種方式。
   
  是否能打造一個集各個優質軟體的優點於一身的創意激發工具？
  - 同時支援「心智圖」、「流程圖」以及「自由白板」甚至「HTML 網頁互動式頁面」
  - 能透過程式快速生成 Mermaid 語法並自動 Layout 的同時，保留手動調整的權利。

  是否能在 AI 時代下，與 AI 即時互動，共同以視覺化的方式進行腦力激盪。

---

## 💡 使用者指南 (User Guide)

### 快速開始
1. **多頁工作區**：啟動後自動載入展示專案（包含心智圖發想、系統架構圖與 Mermaid 複合圖三頁），可透過頂部 Page Tabs 切換或點擊「Reset Demo」重置範例。
2. **極速發想**：點擊任一心智圖節點，敲擊 `Tab` 產生子節點，或敲擊 `Enter` 產生並排兄弟節點。
3. **專注圖表模式**：雙擊畫布上的 `Diagram` 節點（或點擊卡片右上角 Focus 按鈕），即可進入全螢幕雙欄專注模式（左側 CodeMirror 6 編輯 Mermaid 原始碼，右側即時視覺化並支援 Auto-ELK 與手動微調）。
4. **無損匯出與分享**：點擊右上角「Export / Import」，可匯出 `.neuro.png`、`.neuro.svg`、`.neuro.json` 或 `.mmd`。匯出的圖片可直接拖曳回畫布還原所有編輯歷史與座標。

### 常用快捷鍵 (Keyboard Shortcuts)

| 快捷鍵 / 操作 | 功能說明 | 適用場景 |
| :--- | :--- | :--- |
| `Tab` | 新增子節點 (Child Node) | 向右衍生下一層發想 |
| `Enter` | 新增並排兄弟節點 (Sibling Node) | 同層級快速發想排隊 |
| `⌥ + ↑ / ↓ / ← / →` | 智慧避障向指定方向新增節點 | 四向任意維度發想 |
| `單擊節點 + 打字` | 行內即時編輯文字（支援 IME 首字保護） | 極速改字與思維輸入 |
| `Space` | 在現有文字末端追加內容 | 快速追加關鍵字 |
| `雙擊 Diagram 卡片` | 進入全螢幕專注編輯模式 | Mermaid 與視覺畫布雙欄同步 |
| `Cmd + Z` / `Cmd + Shift + Z` | 無限次復原 (Undo) / 重做 (Redo) | 歷史回滾與操作防呆 |
| `Delete` / `Backspace` | 刪除選取之節點、群組或連線 | 清理畫布物件 |
| `V` / `S` / `T` / `C` / `D` / `F` | 切換工具（選取 / 形狀 / 文字 / 連線 / 手繪 / 容器） | 工具列切換 |

---

## 🛠️ 開發者指南 (Developer Guide)

### 技術棧 (Tech Stack)

- **前端核心**：React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Lucide React
- **畫布與圖元渲染**：`@xyflow/react` (React Flow v12, HTML DOM + SVG 混合渲染) + `perfect-freehand` 手繪筆跡
- **自動排版引擎**：`elkjs` (Eclipse Layout Kernel，支援複合子圖與階層式自動佈局)
- **程式碼編輯器**：CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`)
- **狀態管理與撤銷復原**：Zustand v5 + Immer + Zundo (Undo/Redo 歷史棧)
- **本機持久化**：Dexie.js v4 (IndexedDB 離線優先，內建 500ms Debounce 防抖存檔)
- **圖片匯出與無損封裝**：`html-to-image` + `pako` (zlib 壓縮嵌入 PNG `tEXt` chunk 與 SVG Metadata)
- **自動化測試體系**：Vitest + Node 22 原生測試執行器 + Headless Chrome CDP 真實瀏覽器測試

### 五層模組化架構 (Bottom-Up 5-Layer Architecture)

```
Layer 5: Workspace & UI (頂部 Page Tabs、懸浮工具列、全域快捷鍵協同器、匯出視窗)
   ▲
Layer 4: Dedicated Editors (CodeMirror 6 雙向專注編輯器、屬性面板)
   ▲
Layer 3: Canvas & Primitives (@xyflow/react 節點、跳線邊緣、手繪塗鴉、Frame 容器)
   ▲
Layer 2: Core Engines (Mermaid AST 對帳、ELK 佈局、AABB 碰撞避障、SVG 跳線幾何引擎)
   ▲
Layer 1: State Store & Persistence (Zustand 領域切片、Zundo 歷史棧、Dexie 本機持久化)
```


### 本機開發與指令 (Getting Started)

```bash
# 1. 安裝子專案依賴
pnpm -C apps/003-Creative-Neuro install

# 2. 啟動 Vite 本機開發伺服器 (支援 HMR 熱重載)
pnpm -C apps/003-Creative-Neuro dev

# 3. 執行測試套件
pnpm -C apps/003-Creative-Neuro test:unit    # Vitest 單元測試
pnpm -C apps/003-Creative-Neuro test:engine  # 核心演算法引擎測試 (純函數)
pnpm -C apps/003-Creative-Neuro test:domain  # Store 領域切片與持久化測試
pnpm -C apps/003-Creative-Neuro test:e2e     # 原生 Headless Chrome CDP 測試

# 4. 執行型別檢查與生產環境打包
pnpm -C apps/003-Creative-Neuro build
```

---

## 🔮 未來展望 (Roadmap)

- [ ] **AI 即時語音共同繪圖**：整合 Gemini Multimodal Live API (WebSocket / WebRTC + VAD + Function Calling)，支援用語音邊對話、AI 邊在畫布上即時增刪與調整架構圖。
- [ ] **桌面端原生應用**：透過 Tauri 2.0 封裝 macOS 全螢幕無干擾桌面版。
- [ ] **雲端互動分享**：支援一鍵產生互動式 Embed URL，便利嵌入 Obsidian、Notion 或投影片中展示。
