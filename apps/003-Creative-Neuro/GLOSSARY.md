# Creative-Neuro (003)

整合無限白板、流程圖、心智圖與自由繪圖發想的視覺化思考工作區。

## Language

### 工作區與場景圖 (Workspace & Scene Graph)

**Scene Graph**:
採用 `Project → Board → Page → Canvas → Canvas Object` 的正規化扁平資料結構，作為無限畫布與內嵌圖表的唯一真實資料來源（Single Source of Truth）。

**Project**:
最上層的本機工作區單位，包含多個 Board、Page、Canvas Object、Connector 與媒體 Asset，並擁有各自隔離的 Undo/Redo 歷史紀錄。

**Page**:
隸屬於 Project Board 內的獨立無限畫布；關閉 Page 分頁僅將其從分頁列隱藏（可從 Pages 管理清單重新開啟），刪除 Page 才會永久移除。
_Avoid_: Sheet, Tab

### 畫布物件與關聯 (Canvas Objects & Relationships)

**Canvas Object**:
放置於 Page 或 Diagram 內的任何視覺元素（Shape、Text、Image、Freehand、Frame 或 Diagram），由內容、Style、Lock 狀態與 Z-Order 構成。
_Avoid_: CanvasItem, Widget, Element

**Style**:
Canvas Object、Logical Group 或 Connector 的視覺外觀屬性，包含背景色、文字顏色、線條顏色、線條粗度、字型排版、透明度、邊框與內距。

**Connector**:
連接兩個 Canvas Object 的關係線段，支援 Straight（直線）、Smoothstep（直角折線）與 Bezier（貝茲曲線）三種幾何路徑。
_Avoid_: Link, Wire, Arrow

**Line Jump**:
畫布層級（Page 或 Diagram）的顯示選項，開啟後會在相交的 Connector 處繪製半圓跳線弧線，獨立於線條幾何類型之外。

**Z-Order**:
Canvas Object 在 Page 或 Diagram 內的前後疊放順序（`zIndex`），決定重疊時的遮罩顯示。
_Avoid_: Layer（保留給 Phase 2 的多圖層面板系統）

**Rotation**:
Canvas Object 在畫布上的旋轉角度屬性（計畫於 Phase 2 實作），不同於 Diagram 或 Frame 的排版流向（Orientation）。

### 群組、容器與排版 (Grouping, Containers & Layout)

**Lock**:
Canvas Object 上的布林屬性；設為 `true` 時完全鎖定物件，禁止使用者拖曳移動，且在執行 Auto Layout 時跳過不予重排。
_Avoid_: Fixed, Pin

**Logical Group**:
透過 `⌘G` 建立的扁平邏輯關聯（共用 `groupId`），點擊任一成員即全選、一起移動並統一設定樣式，支援群組外框與背景色 Style，不可收合（Fold）。
_Avoid_: GroupNode, Cluster

**Frame**:
在 Page 上規劃獨立區域的視覺容器（預設具備與 Page 區隔的背景色），移動時內部物件相對位置不變隨同移動，拉大範圍可自動收納被包圍的 Canvas Object，並支援收合（Fold）成標題列。
_Avoid_: Group, BoxContainer

**Auto Layout**:
作用於容器層級的自動排版機制，自動調整未鎖定 Canvas Object 的位置與 Connector 走線；Page 提供單次觸發（One-shot），Diagram 則同時支援 One-shot 與 `Continuous` 持續自動平衡模式。

### 圖表與心智圖 (Diagrams & MindMap)

**Diagram**:
Page 上的獨立作用域容器，定義內部 Auto Layout（One-shot 或 `Continuous`）的明確邊界，支援 Flowchart 模式與 MindMap Mode 兩種運作模式。
_Avoid_: SubCanvas, MermaidBox

**MindMap Mode**:
Diagram 的一種運作模式，強制單一根節點與一對多放射狀／均勻對稱樹狀拓撲，支援自動平衡、節點互換與拖拉加入／移出 Floating 節點，並可選擇同步產生 Mermaid 語法。

**Mermaid**:
僅於 Diagram 內部使用的文字結構化繪圖語言，負責定義物件內容與關係，不負責像素座標或細部樣式。

**ELK**:
自動階層式排版引擎，負責計算 Page 或 Diagram 內未鎖定元素的座標與連線佈局。

**Reconciliation**:
Node ID 對帳程序，將 Mermaid 語法變更同步至 Scene Graph，同時保留既有節點座標與 `Lock` 狀態。
