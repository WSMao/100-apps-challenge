# Creative-Neuro (003) — Product Requirement Document (PRD)

## Vision

以無限白板打造整合式視覺化思考工具，讓心智圖極速發想、結構化流程圖（Mermaid + ELK 自動排版）、多媒體白板物件與自由手繪能在同一空間無縫並存並互相關聯；並於後續階段結合 AI 即時語音與自然語言繪圖，成為開發者與思考者的共創白板。

---

## Problem Statement

視覺化思考工作者在整理想法與系統架構時，往往需要在「心智圖工具（快速鍵盤發想）」、「流程圖工具（自動排版與語法同步）」與「自由白板（無邊界構圖、圖片與手繪）」之間反覆切換。現有工作區設計存在以下痛點：

1. **操作流中斷**：缺乏直覺的鍵盤發想與滑鼠手勢（右鍵平移、雙擊建立、懸停拉線），或是手勢與畫布框選相互衝突。
2. **概念邊界混淆**：過去每個節點同時維護 `auto-elk` / `manual` / `fixed` 三種狀態容易與手動拖曳產生認知衝突；`Logical Group` 與 `Frame`、圖層（`Layer`）與疊放順序（`Z-Order`）、`Line Jump` 與線型分類之間邊界不夠清晰。
3. **白板編輯與排版能力不足**：缺少圖片物件匯入與縮放、物件對齊與自動參考線、完整的 Style 控制（背景色、文字色、線條色與粗度），以及獨立封裝的心智圖（`MindMap Mode`）自動均衡對稱排版。
4. **分頁與復原不可靠**：關閉 `Page` Tab 直接等同刪除且無恢復入口；JSON 專案匯入失效；拖曳或背景同步容易污染 Undo/Redo 堆疊。

---

## Solution

打造一個概念邊界清晰、操作零阻力且具備交易級 Undo/Redo 保障的無限畫布工作區：以 `Lock` 單一屬性取代繁瑣的節點佈局狀態，將 `Auto Layout`（One-shot / Continuous）收斂至 `Page` 與 `Diagram` 容器層級，並將 `MindMap Mode` 整合為 `Diagram` 內的一等公民模式，同時補齊 `Image` 物件、對齊參考線、畫布級 `Line Jump`、完整 `Style` 控制與純 `.neuro.json` 專案匯入/匯出。

---

## User Stories

### Phase 1: 核心畫布、雙向圖表與完整編輯體驗 (MVP)

#### 一、操作與互動 (Operations & Interactions)
1. [ ] As a 畫布使用者, I want 在任何工具模式下用滑鼠右鍵拖移平移畫布、單擊右鍵則開啟應用專屬上下文選單並攔截瀏覽器原生選單, so that 我可以隨時快速移動視野或執行快捷操作而不被原生選單打斷。
2. [ ] As a 畫布使用者, I want 使用垂直滾輪上下捲動、`⇧ + 滾輪` 左右捲動、`⌘/Ctrl + 滾輪` 或觸控板雙指縮放畫布, so that 我能流暢地進行多維度畫布導覽。
3. [ ] As a 畫布使用者, I want 在空白處直接左鍵拖曳拉出矩形選取框（完整涵蓋模式 `SelectionMode.Full`，無需按住 Shift），且在快速框選時不會發生狀態乒乓循環或黑屏崩潰, so that 我能精準且穩定地框選目標物件。
4. [ ] As a 畫布使用者, I want 選中物件時看到清晰的高亮外框（如亮青藍 Ring/Outline）, so that 我能一眼辨識目前的選取焦點。
5. [ ] As a 畫布使用者, I want 滑鼠懸停在物件上時拖曳四周的「+」連接點拉出連線並吸附至目標物件（且四個「+」連接點平時隱藏、中心精確對齊物件中心線與邊框交點）, so that 畫布保持簡潔且能不切換工具就快速建立關聯。
6. [ ] As a 畫布使用者, I want 在畫布空白處左鍵雙擊即時於滑鼠座標建立一個新的浮動物件，且其物件類型與我最後一次新增的物件類型相同, so that 我能連續快速建立同類型元素而不用反覆切換工具列。
7. [ ] As a 畫布使用者, I want 在一般 `Page` 畫布上選取節點後，使用 `Tab`（子節點）、`Enter`（兄弟節點）與 `⌥ + 方向鍵` 進行避障衍生並記憶最後建立方向，且支援方向鍵（`↑` / `↓` / `←` / `→`）跳轉選取鄰近物件, so that 我能純靠鍵盤在白板上快速發想與遊走。
8. [ ] As a 畫布使用者, I want 左鍵矩形框選時，只有當 `Connector` 的 Source 與 Target 兩端物件皆完整落在選取框內才將該連線選中, so that 框選局部區域時不會誤選連往框外的線段。
9. [ ] As a 畫布編輯者, I want 雙擊文字或形狀物件進行行內文字編輯，並可按 `Backspace` / `Delete` 刪除選取物件及其附屬連線, so that 我能快速修正文字與清理畫布。

#### 二、專案與 Page 管理 (Project & Page Management)
1. [ ] As a 思考工作者, I want 系統開啟時自動載入內建三頁互動式展示專案（Mindmap Brainstorming、System Architecture、Mermaid Flow & Sub-Diagram），並支援點擊「Reset Demo」一鍵還原預設範例, so that 我能立即體驗核心功能並在測試後快速重置。
2. [ ] As a 思考工作者, I want 在頂部 `Page` Tabs 列新增分頁、雙擊標籤改名與切換分頁；點擊分頁上的關閉（X）按鈕時僅將該分頁從分頁列隱藏，並可隨時從「Pages 管理清單」重新打開，而真正的「刪除 Page」則需經過確認對話框且保留最後一頁防呆保護, so that 我不會因為誤觸關閉分頁而遺失整個畫布內容。
3. [ ] As a 思考工作者, I want 透過左上方 Logo 下拉選單的「New Project」建立新專案（預設名稱 `untitled`，重複名稱警告或自動遞增 `untitled1`，點擊「Create」確認建立），並可透過「Workspace」瀏覽、切換、重新命名或刪除已儲存於本機 IndexedDB 的專案, so that 我能安全管理多個離線專案。
4. [ ] As a 思考工作者, I want 匯出與匯入專案統一使用 `.neuro.json` 格式（修復目前 JSON 匯入失效問題，並移除 PNG/SVG 專案還原匯入），且在同時匯出 `.mmd`、`SVG`、`PNG` 時供純視覺／語法分享使用, so that 專案備份與還原穩定可靠且維護單純。

#### 三、物件與多媒體 (Canvas Objects & Media)
1. [ ] As a 畫布使用者, I want 透過左側工具列切換並建立多樣化 `Canvas Object`（Shape、Text、Image、Freehand、Frame、Diagram）, so that 我能在同一張無限畫布上混合使用各種視覺元素。
2. [ ] As a 畫布編輯者, I want 所有物件皆支援拖拉四個角落或邊緣進行縮放調整大小（Resize）, so that 我能自由控制每個物件在白板上的視覺比例。
3. [ ] As a 畫布使用者, I want 透過拖拉檔案或匯入按鈕將圖片加入畫布成為 `Image` 物件（運行時二進位存於 IndexedDB Asset 表，匯出 `.neuro.json` 時轉為內嵌 Data URL；外部連結亦可存為 URL），並支援調整大小與使用 `Connector` 連接, so that 我能在思考白板中自然整合截圖與視覺參考資料。
4. [ ] As a 畫布使用者, I want 在手繪模式（`Freehand Draw`）繪製具擬真筆壓感的手繪塗鴉, so that 我能像在實體白板上一樣快速草繪與標註。
5. [ ] As a 畫布筆記使用者, I want 文字物件（Text）預設無實體背景色（`transparent`）與無邊框，僅在選取或懸停時保留細緻高亮外框, so that 純文字標註能自然融入白板背景。

#### 四、連線與對齊 (Connectors & Alignment)
1. [ ] As a 流程圖繪製者, I want 在 `Connector` 模式下點選既有連線進行調整（包含拖曳尾端或起點重新指向其他物件），並支援依序點擊兩個物件自動挑選最近端點進行連續連接（按 `Esc` 取消）, so that 我能靈活建立與修正物件關係。
2. [ ] As a 流程圖繪製者, I want `Connector` 的線條幾何種類精簡為直線（Straight）、直角折線（Smoothstep）與貝茲曲線（Bezier），並可在工具列記憶預設線型、以及透過單選／多選連線的集中快速選單批次變更線型、粗度、顏色、虛線樣式與箭頭樣式, so that 連線設定直覺統一。
3. [ ] As a 流程圖繪製者, I want 將 `Line Jump`（交錯跳線）作為整個畫布（`Page` / `Diagram`）層級的切換選項，開啟後所有相交的 `Connector`（無論直線、折線或貝茲曲線）皆自動呈現跳線效果, so that 我不需把跳線當成獨立線型就能讓複雜交叉連線清晰易讀。
4. [ ] As a 畫布編輯者, I want 多選物件後透過快速選單或快捷工具執行幾何對齊（靠左、靠右、水平置中、水平分散／靠上、靠下、垂直置中、垂直分散）, so that 我能一鍵把凌亂的物件排列整齊。
5. [ ] As a 畫布編輯者, I want 拖移或縮放物件時觸發自動對齊（磁吸格線以及對齊其他物件的邊緣與中心線並顯示輔助參考線）, so that 手動排版時能輕鬆精準對齊。

#### 五、工具列與 MindMap 模式 (Tools & MindMap Mode)
1. [ ] As a 畫布使用者, I want 選取工具（V）提供物件類別過濾選單（形狀、連線、文字、圖片、容器、圖表）搭配全選／取消全選按鈕與過濾提示圓點，且所有工具列彈出選單在點擊外部區域時自動收起, so that 在複雜畫布上能只選取特定類型的物件而不被誤觸干擾。
2. [ ] As a 心智圖發想者, I want 切換至 `MindMap` 工具後在 `Page` 空白處雙擊即可建立一個處於 `MindMap Mode` 的 `Diagram` 物件並產生中心節點，或在既有的 `MindMap Mode` 節點上繼續進行一對多樹狀拓撲（支援常見生長方向：左右發散、向右發散、向下發散）, so that 我能在畫布任意區域展開任意數量的獨立心智圖。
3. [ ] As a 心智圖發想者, I want 在 `MindMap Mode` 的 `Diagram` 內雙擊空白處新增尚未連接的 Floating 節點（暫為未展開的獨立小中心），並可透過拖拉靠近其他 MindMap 節點自動產生預覽連結、放開後即正式加入該心智圖（移開則維持 Floating）, so that 我能先把零散想法丟進畫布，再隨時拖曳歸隊。
4. [ ] As a 心智圖發想者, I want 在 `MindMap Mode` 中手動交換兩個節點的位置或將子樹節點移出為獨立節點，並在啟用 `Auto Layout` 或勾選 `Continuous` 時自動維持一對多、父到子且整齊均勻放射狀對稱展開（未勾選 `Continuous` 時允許手動隨意調整節點位置），至於所有 Floating 節點在 `Auto Layout` 時，整齊排列即可（除非有 Lock）, so that 心智圖同時兼顧美觀對稱與調整彈性。
5. [ ] As a 心智圖發想者, I want `MindMap Mode` 下的 `Diagram` 也能同步產生與對應 Mermaid 語法, so that 心智圖結構一樣能被結構化保存與文字檢視。

#### 六、佈局、群組與容器 (Layout, Logical Group & Frame)
1. [ ] As a 畫布編輯者, I want 每個物件只保留一個 `Lock` 屬性（取代原本的 `auto-elk` / `manual` / `fixed` 三態標籤）；當 `Lock = true` 時，物件完全鎖定不可被滑鼠移動且不受 `Auto Layout` 影響，並可透過快速選單上的鎖頭圖示一鍵切換鎖定／解鎖, so that 我不用費心理解三態模式就能精準保護固定位置的元素。
2. [ ] As a 架構圖繪製者, I want 在 `Page` 主畫面預設採自由手動排版，並提供「Auto Layout」按鈕進行 **One-shot** 自動排版（同時調整未鎖定物件位置與 `Connector` 走線，排完後可隨意手動微調），且主畫面的排版完全不會影響 `Diagram` 內部排版, so that 我能一鍵整理整個頁面的結構同時保有微調自由。
3. [ ] As a 架構圖繪製者, I want 每個 `Diagram` 內部擁有獨立的佈局控制區：提供 **Auto Layout** 按鈕（One-shot 單次排版）與 **Continuous** 核取方塊（勾選後只要手動調整就自動依新位置持續平衡重排），且僅作用於該 `Diagram` 內部物件, so that 每個圖表區塊都能獨立決定要手動調整還是持續自動平衡。
4. [ ] As a 畫布編輯者, I want 使用 `⌘G` 切換選取物件的「群組（`Logical Group`）」或「取消群組」；群組後點擊任一內部元素即全選群組並一起移動與統一設定，未選中時預設無背景色但可設定群組框的外框與背景色 Style，且群組不可收合, so that 我能彈性綁定多個既有關聯物件並給予視覺區分。
5. [ ] As a 畫布編輯者, I want 建立 `Frame` 容器並在 `Page` 中規劃獨立區塊（預設具有與 `Page` 區隔的背景色）：移動 `Frame` 時內部物件相對位置不變隨同移動，拉大 `Frame` 涵蓋到的物件會自動歸屬於該 `Frame`，平時仍可直接點選內部單一物件獨立編輯，並支援將 `Frame` 收合（Fold）成僅剩標題與 Frame 圖示, so that 我能先劃分功能區塊並在複雜畫布中暫時收起次要區域。

#### 七、介面、樣式與 Z-Order (UI Layout, Style & Z-Order)
1. [ ] As a 畫布使用者, I want 畫布右下角放置縮放與全螢幕控制列（放大、縮小、Fit View / 全螢幕），左下角放置狀態與快捷鍵提示清單, so that 視窗操作符合直覺且不遮擋主畫布。
2. [ ] As a 應用使用者, I want 系統預設採用亮色風格（亮灰色背景），並可透過右上角 Settings 按鈕開啟設定彈窗（保留 General 與 About 分頁），在 General 分頁即時切換亮色／暗色主題並自動持久化；左上方圓形 Logo 下拉選單整合 New Project、Workspace、New Page 與 Import Project (`.neuro.json`) 且不遮擋左側工具列, so that 導覽清晰且符合個人視覺偏好。
3. [ ] As a 畫布編輯者, I want 單選物件（Shape / Text / Image / Frame / Diagram / Group / Connector）時於上方顯示橫向快速選單，多選時於包圍外框上方僅顯示單一集中式快速選單並強制置於絕對最頂層（`z-[99999]`）, so that 快捷設定永遠完整可視、絕不被畫布元素遮擋。
4. [ ] As a 畫布編輯者, I want 透過快速選單調整物件的 `Style`（包含：**物件背景色**、**文字顏色**、**線條顏色**、**線條粗度**，以及形狀切換、字級、對齊與透明度）, so that 我能清晰區分不同層級與類型的視覺元素。
5. [ ] As a 畫布編輯者, I want 透過快速選單調整物件的 **`Z-Order`**（移至頂層、移至底層、上移一層、下移一層）, so that 重疊物件的前後遮罩順序符合預期。

#### 八、復原與重做保證 (Undo / Redo Reliability & Atomicity)
1. [ ] As a 畫布編輯者, I want 按 `Tab` / `Enter` 產生節點與連線、拖曳移動位移、批次刪除（`Delete` / `Backspace`）與橡皮擦手勢皆視為單一原子交易, so that 按一次 `⌘Z` 就能完整復原，按 `⌘⇧Z` 也能一併重做。
2. [ ] As a 畫布編輯者, I want 切換／隱藏 `Page`、選取物件或連線、DOM 自動尺寸測量（ResizeObserver）與 Mermaid 雙向同步回音皆不產生歷史紀錄也不清除 Redo 堆疊, so that 檢視與背景機制不會破壞原本的復原／重做脈絡。
3. [ ] As a 多專案使用者, I want 新建、切換或匯入專案時自動清空歷史紀錄, so that 不同專案的歷史狀態絕不互相污染。

#### 九、Diagram 與雙向同步 / 匯出 (Diagrams, Mermaid Sync & Export)
1. [ ] As a 架構圖繪製者, I want `Diagram` 支援畫布內嵌模式（直接點擊內部物件編輯移動）與全螢幕雙欄專注模式（雙擊或點擊 Focus Mode 展開左側 CodeMirror 6 編輯器與右側專屬畫布）, so that 我能自由切換全局瀏覽與專注編修。
2. [ ] As a 架構圖繪製者, I want Mermaid 語法僅在 `Diagram` 內部作為結構化定義語言使用，修改左側 Mermaid 語法時透過 Node ID 對帳與右側圖形雙向同步並保留既有位置與 `Lock` 狀態, so that 程式碼與視覺微調能無損並存。

---

### Phase 2: AI 自然語言共創、圖層系統與雲端桌面擴充 (Planned)

#### 一、AI 輔助與自然語言繪圖 (AI & Natural Language)
1. [ ] As a 思考工作者, I want 在 `Diagram` 內以自然語言輸入描述並自動轉化為標準 Mermaid 結構化語言後同步渲染圖表, so that 我不需背誦 Mermaid 語法就能快速產出與保存結構化架構圖。
2. [ ] As a 思考工作者, I want 透過即時語音（Gemini Live API / OpenAI Realtime API）與 AI 對話並即時在畫布上增刪與調整節點及架構圖, so that 我能進行流暢的語音腦力激盪。

#### 二、進階畫布圖層、變形與多媒體 (Layers, Transform & Rich Media)
1. [ ] As a 畫布編輯者, I want 使用完整的 **圖層（Layer）面板** 管理不同圖層的顯示／隱藏、鎖定與跨層分類（獨立於單純的 `Z-Order` 疊放順序）, so that 超大型複雜畫布能分層管理。
2. [ ] As a 畫布編輯者, I want 每個 `Canvas Object` 支援 **`Rotation`（旋轉角度）** 屬性與旋轉把手操作（同步更新連接點與選取外框幾何）, so that 我能自由調整物件角度以呈現更具彈性的視覺構圖。
3. [ ] As a 畫布使用者, I want 在畫布中嵌入互動式多媒體物件（如嵌入 YouTube 影片連結並於物件內支援播放／暫停／快轉功能）, so that 白板能承載更多元的參考素材。

#### 三、雲端分享與原生桌面端 (Cloud & Desktop)
1. [ ] As a 內容創作者, I want 串接雲端儲存（Supabase）一鍵產生互動式 Embed URL, so that 我能將畫布嵌入 Obsidian、Notion 或網頁投影片中展示。
2. [ ] As a 桌面端使用者, I want 透過 Tauri 2.0 使用 macOS / Windows 全螢幕無干擾原生桌面應用程式（若未來支援大量本地影音檔可擴充 `.neuro.zip` 封裝格式）, so that 我擁有獨立且極致的本地桌面體驗。

---

## Implementation Decisions

- **統一 Scene Graph 與五層架構（Bottom-Up 5-Layer Architecture）**：
  - 採用 `Project → Board → Page → Canvas → CanvasObject` 扁平化結構，統一以 `@xyflow/react` 嵌套容器實現 `Frame`、`sub-graph` 與 `Diagram`（包含 `Flowchart Mode` 與 `MindMap Mode`）。
  - Layer 1（Types, Store, IndexedDB Persistence & Asset Store）→ Layer 2（Mermaid AST, ELK, MindMap Symmetric Layout, AABB Collision, Line Jump Geometry）→ Layer 3（Canvas, Objects, Connectors, Freehand, Alignment Guides）→ Layer 4（CodeMirror 6 & FocusDiagramModal）→ Layer 5（Workspace Header, PageTabs/Manager, Toolbar, Shortcuts, Exporter）。
- **簡化佈局模型與 `Lock` 機制（詳見 ADR-0001）**：
  - 移除物件層級的 `auto-elk` / `manual` / `fixed` 三態切換，所有 `CanvasObject` 僅保留 `Lock`（boolean）。`Lock = true` 時禁用拖移並跳過 Auto Layout。
  - `Page` 提供 One-shot Auto Layout；`Diagram` 獨立提供 `Auto Layout`（One-shot）與 `Continuous` 核取方塊，且兩者作用域完全隔離。
- **MindMap 作為 Diagram 模式（詳見 ADR-0002）**：
  - `MindMap Mode` 實作於 `Diagram` 內，強制單一中心根節點與一對多樹狀拓撲，支援放射狀均勻展開、Floating 節點拖曳自動預覽連結與放開歸隊、節點互換及 Mermaid 語法同步；一般 `Page` 仍保留普通節點的 `Tab` / `Enter` 衍生行為。
- **Group vs Frame 嚴格區分**：
  - `Logical Group` 採用 `groupId` 邏輯綁定（`⌘G` 切換），選中任一成員即全選移動與設樣式，支援群組外框與背景色 Style，不可 Fold。
  - `Frame` 採用父子巢狀歸屬，預設有獨立背景色，拉大範圍自動收納被包圍物件，移動時相對座標同步移動，可單獨點選內部物件，支援 Fold 收合為標題列。
- **Line Jump 與 Z-Order 詞彙**：
  - `Line Jump` 改為 `Page` / `Diagram` 層級選項；`Connector` 僅保留 Straight、Smoothstep、Bezier。
  - 物件前後疊放統一使用 `Z-Order`（`zIndex`），`Layer` 保留給 Phase 2 圖層面板。
- **Page Tab 生命週期與資產儲存（詳見 ADR-0003）**：
  - `Page` 新增隱藏狀態（`isOpenInTabs` 或對應視圖清單），關閉 Tab 僅隱藏、刪除 Page 才真正移除。
  - 專案匯入/匯出統一採 `.neuro.json`；圖片二進位運行時存於 IndexedDB 獨立 Asset 表，匯出 `.neuro.json` 時轉為內嵌 Data URL。

---

## Testing Decisions

- **測試原則**：所有測試僅驗證公開介面（Store Actions、純函數引擎 API、快捷鍵分派器、真實瀏覽器 DOM 行為）的可觀察輸出與狀態變化；Mock 僅限外部邊界（如 IndexedDB 或瀏覽器環境）。
- **分層測試策略**：
  1. **核心演算法純函數測試（Engine Tests）**：驗證 Mermaid AST 對帳、ELK 佈局、MindMap 對稱平衡演算法、AABB 碰撞避障、`Lock` 排除邏輯、畫布級 `Line Jump` 幾何與物件對齊吸附計算。
  2. **領域契約與狀態機測試（Domain Tests）**：驗證 Store 切片、Page 關閉隱藏 vs 確認刪除、Zundo 原子交易與歷史隔離、`.neuro.json` 與 Asset Store 匯出/匯入 round-trip、`Logical Group` 切換與 `Frame` 收納/Fold 狀態。
  3. **元件與整合測試（Vitest）**：驗證快速選單（Style / Z-Order / Lock / Group / Alignment）、Page 管理清單與工具列互動。
  4. **真實瀏覽器端對端測試（Headless Chrome CDP E2E）**：驗證右鍵拖移、左鍵完整框選、物件拖拉縮放、圖片拖入匯入、MindMap Floating 拖曳歸隊、`Continuous` 自動平衡、對齊參考線與絕對頂層選單可視性，確保 Console 零錯誤。

---

## Out of Scope

- **Phase 2 所有項目**（自然語言轉 Mermaid、AI 即時語音繪圖、多圖層 `Layer` 面板、互動式多媒體播放器物件、Supabase 雲端嵌入分享、Tauri 2.0 桌面端封裝及 `.neuro.zip` 影音封裝）皆不納入 Phase 1 實作與驗收範疇。

---

## Further Notes

- 相關領域詞彙定義請參見 [`GLOSSARY.md`](file:///Users/wsmao/Personal_Projects/100%20Apps%20Challenge/apps/003-Creative-Neuro/GLOSSARY.md)，重大架構取捨請參見 `docs/adr/0001 ~ 0003`。
- 檢閱無誤後，可依此份 `PRD.md` 為 Phase 1 各功能分類建立對應 GitHub Spec / Tracking Issues（透過 `/to-spec` 與 `/to-tickets`）。
