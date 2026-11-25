# 0001. Lock 屬性與容器層級排版設計

Status: accepted

我們將每個 Canvas Object 原本的三態 `LayoutMode`（`auto-elk | manual | fixed`）簡化為單一布林屬性 `Lock`，並將排版控制（Page 上的 `One-shot Auto Layout`；Diagram 內的 `One-shot` + `Continuous` 核取方塊）收斂至容器層級。過去在每個節點上同時維護 `auto-elk` 與 `manual` 狀態，容易在使用者混合手動拖曳與自動排版時產生狀態認知混亂；改為「所有未鎖定物件皆可被容器的 Auto Layout 重排，而 `Lock` 則同時凍結手動拖曳與自動排版」，能提供更直覺且可預期的心智模型。
