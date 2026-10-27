# Creative-Neuro 功能需求與 TDD 測試規格清單 (Requirements Specification)

此份清單為 `Creative-Neuro` 專案互動、操作、專案管理、工具、UI 與進階功能之測試規格基準，所有項目均透過測試案例驗證，每次驗證通過後於測試報告中更新勾選狀態。

---

## 一、 操作與互動 (Operations & Interactions)

- [ ] **OP-01: 右鍵拖移畫布與自訂功能性選單**
  - 在任何工具模式下，滑鼠右鍵拖移 (Right-drag) 為平移畫布 (Pan canvas)。
  - 單純點擊右鍵 (Right-click without drag) 彈出應用專屬功能性上下文選單 (App Context Menu)，攔截瀏覽器原生選單。
- [ ] **OP-02: 滑鼠滾輪多維度導覽**
  - 滾輪 (Wheel垂直) 為上下捲動 (Pan Vertical)。
  - `⇧ + 滾輪` (Shift + Wheel) 為左右捲動 (Pan Horizontal)。
  - `⌘ + 滾輪` (Cmd/Ctrl + Wheel) 或側邊滾輪 (Pinch / Zoom) 為畫布平滑縮放 (Zoom In/Out)。
- [ ] **OP-03: 滑鼠左鍵拖移框選 (Selection Box)**
  - 滑鼠左鍵在空白處拖移時，拉出矩形選取框，框選範圍內的物件被多選。
  - 框選判定模式設定為完整涵蓋 (`selectionMode={SelectionMode.Full}`)：物件幾何範圍必須完整落在選取框內才算被選取（僅邊緣觸碰或部分相交不列入選取）。
  - 設定 `selectionKeyCode={null}` 支援直接拖曳框選（Figma/Miro 模式），無需按住 Shift 鍵即可觸發矩形框選。
  - 區分內部選取與外部程式化導航（`isInternalSelectionRef`），防止框選過程觸發 `setReactFlowNodes` 破壞手勢與無窮重新渲染。
  - 選取狀態更新具備冪等性集合比對（Set Equality Guard），防止框選過程中與 React Flow 內部選取事件觸發無窮重新渲染乒乓循環（防止 Maximum update depth exceeded 黑屏崩潰）。
  - 全域與畫布配置 ErrorBoundary 防護網，任何渲染例外自動攔截並提供復原按鈕，徹底杜絕黑屏。
- [ ] **OP-04: 節點選中外框高亮 (Active Node Outline Highlight)**
  - 點選節點時，節點邊框具備清晰高亮光暈與外框色（如亮青藍 ring/outline），易於辨識選取狀態。
- [ ] **OP-05: 懸停加號拉出連線 (Quick Connector Drag)**
  - 移到節點上方時，點擊邊框四周的「加號 (+)」並拖曳不放，可即時拉出連接線並吸附至目標節點建立連線。
- [ ] **OP-06: 空白處左鍵雙擊建立浮動節點 (Double-Click Create Node)**
  - 在畫布空白處雙擊左鍵，於滑鼠所在畫布座標即時建立一個新的浮動節點。
- [ ] **OP-07: Tab / Enter 繼承方向記憶 (Inherited Directional Spawn)**
  - 系統記憶使用者最後一次按【⌥ + 方向鍵】建立的方向（右/下/左/上）。
  - 按【Tab】（子節點）與【Enter】（兄弟節點）時，以該記憶方向作為首選產生方位，並記錄新方位。
- [ ] **OP-08: 選中節點按方向鍵進行鄰近節點跳轉 (Directional Node Navigation)**
  - 當已選中一個節點時，按下方向鍵（↑、↓、←、→），選取焦點朝該方向自動移動到空間距離最近的相鄰節點。
- [ ] **OP-09: 畫布控制按鈕功能修復與右下角放置 (Controls Navigation)**
  - 放大 (+) 按鈕點擊有效。
  - 縮小 (-) 按鈕點擊有效。
  - 縮放至合適大小 / 全螢幕 (Fit View / Fullscreen) 點擊有效。
- [ ] **OP-10: 節點連接點懸停顯隱與中心線邊界交點對齊 (Hover-Only & Centerline-Aligned Handles)**
  - 物件周圍保留單一組互動連接點，平時不顯露；只有當滑鼠移動到物件上方時才顯示連接點。
  - 四個「+」連接點中心座標精確對齊物件水平中心線 ($y = H / 2$) 與垂直中心線 ($x = W / 2$) 與物件實際幾何邊框之交點（消除 CSS `transform` 與 Tailwind v4 `translate` 雙重位移偏差）。
- [x] **OP-11: 框選連接線完整涵蓋判定 (Fully Enclosed Edge Box Selection)**
  - 滑鼠左鍵拉出矩形框選時，連接線段（Edges）亦必須兩端端點（Source 與 Target 節點）皆完整落在選取框內才算被框選到。
  - 若線段僅有一端在框選框內，另一端連接至框外節點，則該線段不被選入，符合線段完整在框內的選取語意。

---

## 二、 專案與多工作區管理 (Project Management)

- [ ] **PM-01: 建立新專案 (Create Project)**
  - 支援建立新 Project，並初始化預設 Board 與 Page。
- [ ] **PM-02: 瀏覽與切換所有專案 (List & Switch Projects)**
  - 提供專案管理檢視/面板，可瀏覽所有已儲存之專案清單、切換當前專案、重新命名或刪除專案。
  - 資料儲存於 Dexie.js (IndexedDB) 且支援本地持久化。

---

## 三、 工具列功能 (Tools & Interaction Modes)

- [ ] **TL-01: Connector 連接線工具互動修復**
  - 切換至 Connector 工具時：點擊第一個節點設定為起點，接著點擊第二個節點設定為終點，自動建立最佳適配連線。
  - 連線建立完畢或按 Esc 後可順暢結束連線流程。
- [ ] **TL-02: Connector 自動選擇最近端點與連續連接 (Optimal Handles & Continuous Connect)**
  - 點擊第一個節點產生連接指示，點擊第二個節點時建立連線。
  - 連接時自動從 2 個物件各 4 個端點中，選擇彼此距離最近的一對端點進行連接。
  - 建立完一組連線後，保留於 Connector 模式，可接續進行另外物件的連續連接。
- [ ] **TL-03: 連接線尾端點選與拖移重新連接 (Edge Reconnection)**
  - 連接線尾端支援點選與拖移，可直接指向並重新連接至其他物件節點。
- [ ] **TL-04: 多種連接線樣式與快速選單 (Edge Routing Types & Floating Action Bar)**
  - 支援多種線條幾何：跳線 (Jump Arc)、直角折線 (Smoothstep)、平滑曲線 (Bezier)、直線 (Straight)。
  - 點擊連接線時出現快速浮動選單，可即時切換線條幾何、線型（實線/虛線/點線）、箭頭樣式（單向/雙向/無）與刪除。
  - **多選線段集中快速選單 (Unified Edge Floating Action Bar)**：當框選或多選多條連接線時，僅在目前選取之活動連線上顯示「單一集中快速選單」，不重複堆疊多個選單；設定項目（跳線/折線/曲線/直線、實線/虛線/點線、單向/雙向/無箭頭、刪除）支援批次套用 (`batchUpdateEdgeData`) 至所有被選取之連線。
- [ ] **TL-05: Connector 工具提供連線類型選單並記憶預設連線類型 (Connector Type Preset Selector)**
  - 左側工具列 Connector 工具提供類型選擇選單（Jump Arc 跳線、Smoothstep 直角折線、Bezier 平滑曲線、Straight 直線）。
  - 選擇後記憶為預設連線類型（`defaultEdgeRoutingType`），後續在 Connector 工具點擊連續連接或節點把手拖曳拉出連線時，均自動套用該預設類型。
- [x] **TL-06: 選取工具提供可選物件過濾複選選單與全工具點擊外部自動收起 (Selection Tool Category Filter & Click-Outside Auto-Close)**
  - 左側工具列之【選取工具】（Select Tool, V）提供彈出式複選選單，包含：形狀與節點 (Shapes)、連接線段 (Lines / Edges)、文字區塊 (Text Blocks)、容器外框 (Frames)、Mermaid 圖表 (Diagrams)。
  - 提供 Checkbox 勾選哪些類別物件可以被選取，未勾選類別之物件無法被點擊或框選選中。
  - 選單頂部提供【全選】與【取消全選】快速操作按鈕（取代原 X 關閉圖示）；若有部分類型被取消勾選，選取工具按鈕顯示青藍色圓點提示。
  - **點擊外部自動收起**：整個工具列所有工具（選取過濾選單、圖形子選單、連接線子選單）開啟後，只要滑鼠點擊該選單或工具列外部任何區域，立即自動收起彈出選單。

---

## 四、 介面佈局與風格外觀 (UI Layout & Theme System)

- [ ] **UI-01: 控制工具移至右下角**
  - 畫布縮放控制項（放大、縮小、適應畫面）由左下角移至畫布右下角。
- [ ] **UI-02: 快速提示清單移至左下角**
  - 畫布快捷鍵與操作提示（Hints / Shortcuts List）移至畫布左下角。
- [x] **UI-03: 設定彈窗 (Settings Modal) 與左上方 Icon 下拉選單 (Logo Dropdown Menu)**
  - 設定彈窗移除 Projects 分頁，保留 General 與 About。
  - 右上角按鈕佈局優化：【設定】按鈕放置於【Export】按鈕之右側；原頂部工具列之【Import】按鈕移至左上方 Logo 下拉選單內整合。
  - 點擊左上方 Logo Icon 彈出下拉選單，包含：
    - **New Project**：彈出新增專案視窗，輸入名稱（預設為 `untitled`）。若輸入重複名稱則提示警告並要求改名；若未輸入或預設名稱重複，則自動遞增命名（如 `untitled1`），點擊「Create」按鈕確認建立。
    - **Workspace**：彈出工作區所有 Projects 清單視窗，支援一鍵切換與刪除。
    - **New Page**：點擊即時在分頁列表建立新 Page 頁籤。
    - **Import Project**：點擊開啟檔案選擇視窗，支援匯入 `.neuro.json`、`.neuro.svg`、`.neuro.png` 等多格式專案檔案。
  - 品牌區視覺與排版升級：
    - Logo 圖標替換為雙腦半球簡約版（`logo_option_4e.png`），外框採程式化正圓形（`rounded-full`）裁切。
    - 專案名稱預設為 `Demo`，套用膠囊徽章樣式（`rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30`）並微幅加大字級，刪除原本之「Main Workspace board」多餘標籤。
    - Logo 與標題區整體向右平移（`ml-11 sm:ml-12`），展開之下拉選單起始位置完全位於左側垂直工具列右側，絕不遮擋工具列。
    - 點擊「Logo -> Workspace」彈出之專案視窗全面放大至 `max-w-3xl`，座標嚴格錨定於頂部導覽列下方（`pt-20`，留有 24px 呼吸間距），確保頂端標題列完整清晰可見，徹底杜絕頂部被視窗邊界裁切。
- [ ] **UI-04: 主題色彩切換 (Theme Mode: Light / Dark)**
  - 系統預設為亮色風格（Light Mode，以亮灰色 `#f8fafc` / `#f1f5f9` 為背景）。
  - 設定選單的「General」分頁中提供「主題切換（亮色 / 暗色）」，切換即時生效且自動持久化。
- [ ] **UI-05: 節點上方橫向快速選單 (Node Floating Action Bar) 與多選集中快速選單 (Unified Multi-Selection Action Bar)**
  - 當點選單一節點時，節點正上方出現浮動橫向選單（Quick Action Toolbar）。
  - 當框選或多選多個物件（`selectedNodeIds.length > 1`）時，個別節點上方不顯示重複選單，而是在多選包圍外框上方僅出現「單一集中快速選單 (Unified Multi-Selection Action Bar)」。
  - 框選後出現之集中快速選單，內含之設定（佈局模式切換、圖形樣式批量更換、圖層上移/下移、群組化/解散群組、批量刪除）均支援「批次套用 (Batch Apply)」至所有被選取物件。
  - 對於 `ShapeObject` 節點：提供圖形切換下拉選單（矩形、圓形、多邊形、菱形、資料庫等）可快速變更圖形，並提供字級、對齊、色彩快捷變更。
- [x] **UI-06: 快速選單絕對頂層顯示防遮擋 (Topmost Layering for Quick Menus)**
  - 無論單選（節點/連線）或多選框選，所有出現的快速選單（`NodeFloatingActionBar`、`EdgeFloatingActionBar`、多選集中快速選單）皆被強制賦予最上層 z-index（`z-[99999]`），且被選中節點之外層 DOM 容器提升至最高層級（`z-index: 99999 !important`），確保選單在任何情況下皆完整可視，絕不被畫布上其他任何節點、連線或容器遮擋。
  - 所有節點類型（ShapeNode、TextNode、FrameNode、DiagramNode）於單選時均支援呼出頂層快速選單。

---

## 五、 進階編輯功能 (Core Advanced Features)

- [ ] **FN-01: Manual 模式切換與控制 (Manual Layout Mode)**
  - 支援將畫布或指定節點明確設定為 `Manual` 佈局模式。
  - 點擊任一節點上方浮現之快速選單，提供佈局模式圖示按鈕，點擊可在 `auto-elk` 與 `manual` 之間一鍵切換。
- [ ] **FN-02: 圖層管理 (Layers / zIndex Support)**
  - 節點支援圖層層級 (zIndex / Layer)，支援「移至頂層 (Bring to Front)」、「移至底層 (Send to Back)」、「上移一層」、「下移一層」。
- [ ] **FN-03: 多選節點與框選 (Multi-Selection & Selection Bounding Box)**
  - 支援 `⌘ + 滑鼠左鍵點擊` (Cmd/Ctrl + Click) 切換複選物件。
  - 支援滑鼠左鍵拖曳選取框多選節點與連線。
  - 選取多個節點時，除了被選取物件本身外框高亮外，額外顯示矩形包圍外框（Bounding Box），標示選取總數。
  - 包圍外框座標計算具備非有限值 (`NaN`, `Infinity`) 與缺失座標防禦，防止幾何異常導致渲染崩潰。
- [ ] **FN-04: 物件群組化 (Logical Grouping & Shared Group Movement)**
  - 群組採用邏輯歸屬（`groupId`）而非包裝為 FrameNode。
  - 選取多個物件後執行群組（`⌘G` 或快速選單），標記為同一個群組。
  - 點擊群組內任一物件時，自動全選該群組並顯示群組外框；拖移任一物件時，同群組所有物件同步平移。
  - 支援解散群組（`⌘⇧G` 或快速選單）。
- [x] **FN-05: 文字物件預設無背景顏色 (Transparent Default for Text Nodes)**
  - 文字物件（`TextNode`）預設無任何實體背景色（`backgroundColor: 'transparent'`），無邊框（`borderWidth: 0`）。
  - 取消硬編碼之選取/懸停深色背景色塊，僅保留細緻的外框高亮（Cyan Ring），確保文字純粹置於畫布之上。

---

## 六、 復原與重做功能保證 (Undo / Redo Reliability & Atomicity)

- [x] **UR-01: 子節點與兄弟節點 directional spawn 單步原子復原 (Atomic Spawn Undo)**
  - 按【Tab】（子節點）或【Enter】（兄弟節點）建立新節點與連接線時，採用原子交易；按 `⌘Z` 復原時，同時移除節點與連線，無須按兩次復原。
  - 按 `⌘⇧Z` 重做時，一併復原節點與連線。
- [x] **UR-02: 畫布拖曳位移單步原子復原 (Atomic Drag Gesture Undo)**
  - 拖曳節點或物件時，暫停歷程紀錄並在拖曳結束時注入起點快照；按一次 `⌘Z` 即可精確復原回原點座標，無拖曳過程之零碎中繼狀態。
- [x] **UR-03: 分頁切換與選取操作不污染歷程 (Non-Mutating Navigation & Selection)**
  - 切換 Page/分頁不產生空白歷史步驟，不影響當前畫布之復原狀態。
  - 單選、多選（`⌘+Click`、矩形框選）與連接線選取僅更新暫態選取陣列，不修改節點物件實體，不產生歷程亦不清除重做堆疊（Redo Stack）。
- [x] **UR-04: 自動 DOM 尺寸測量與 Mermaid 反向同步不清除 Redo 堆疊 (Safe DOM Measurement & Bi-Directional Sync)**
  - React Flow ResizeObserver 觸發的自動 DOM 尺寸測量不觸發歷程異動，避免 Undo 後重做堆疊被無故清空。
  - CodeMirror Mermaid 編輯器反向同步派發時設定旗標，避免回音觸發畫布重新寫入導致 Redo 堆疊失效。
- [x] **UR-05: 專案歷史隔離與批次刪除歷程 (Cross-Project History Isolation & Batch Delete)**
  - 切換專案、新建專案或匯入專案時主動清空歷史紀錄，杜絕跨專案狀態污染。
  - `Delete` / `Backspace` 同時刪除多個節點與連線時，採單一交易批次刪除，按 `⌘Z` 一鍵復原全部選取元素。
  - 自由塗鴉橡皮擦（Eraser）手勢採軌跡收集與批次刪除，擦除手勢結束時單次提交，按 `⌘Z` 完整復原。

