# 0002. 將 MindMap 設計為 Diagram 的一種模式

Status: accepted

我們將心智圖（`MindMap Mode`）設計為 `Diagram` 內的一種運作模式，而非獨立的最上層 `MindMapObject` 物件型別。因為 MindMap 同樣需要明確的作用範圍邊界、獨立的內部排版控制（`Auto Layout` 按鈕與 `Continuous` 放射狀／對稱平衡開關）以及選用的 Mermaid 語法同步，共用 `Diagram` 容器可避免重複實作作用域隔離、Focus Mode 與佈局邊界邏輯，同時也能完整保留一般 Page 上普通節點的 `Tab` / `Enter` 快速衍生操作。
