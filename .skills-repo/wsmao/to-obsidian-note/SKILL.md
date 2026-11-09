---
name: to-obsidian-note
description: >-
  Record session summaries, specific technical concepts, or new ideas directly into the user's
  Obsidian Second Brain vault (`Journey/...`). Supports `/to-obsidian-note all` or
  `/to-obsidian-note <category> <scope1> <scope2>... <style>`. Automatically routes to the correct
  vault location based on the category or inferred scope.
---

# 記錄至 Obsidian 筆記庫 (to-obsidian-note)

本 Skill 用於將對話過程中的核心思考、架構決策、技術概念或新點子，結構化沉澱至使用者的 Obsidian 個人知識庫（Second Brain）。

---

## 1. 筆記庫路徑與知識架構 (Vault Taxonomy)

- **Obsidian 根目錄**：
  `/Users/wsmao/Library/Mobile Documents/iCloud~md~obsidian/Documents/`
- **主要分區路徑 (`Journey/`)**：
  - **技術概念庫**：`Journey/04_Coding/技術討論與概念/`
    - 存放純技術概念、演算法、底層原理與程式設計心法（例如 React Flow 核心對帳機制、Node.js 原生測試架構、SVG 幾何算法等）。
  - **專案紀錄庫**：`Journey/04_Coding/100 Apps Challenge/<id>-<appname>.md`
    - 存放子專案的構思原型、技術路線、實作決策與歷程反思。
  - **新點子庫**：`Journey/05_Ideas/`
    - 存放各領域的靈感與產品點子，內含分類子資料夾（`軟體開發/`、`商業/`、`寫作/`、`自媒體/`、`生活用品/`、`機器人/`、`開店/` 等）或直接存於 `05_Ideas/` 根目錄。

> [!NOTE] 沙盒執行提示 (Sandbox Mode)
> 由於 Obsidian 筆記庫位於工作區（Workspace）外部的 iCloud 目錄，執行讀取、檢視目錄或寫入檔案時，若遭遇權限限制，需使用 `BypassSandbox: true` 執行相應指令或工具。

---

## 2. 調用模式與參數解析 (Invocation Modes)

### 模式 A：`/to-obsidian-note all`
- **語義**：保存整個對話 Session 的完整精華內容（包含背景脈絡、解決之核心問題、架構演進、關鍵知識點與下一步）。
- **預設路徑**：
  - 若當前對話正在開發特定子專案，預設記錄至 `Journey/04_Coding/100 Apps Challenge/<id>-<appname>.md`。
  - 若對話為純理論探討或發散發想，主動推斷後記錄至對應的技術筆記或點子筆記。

### 模式 B：`/to-obsidian-note <category> <scope1> <scope2> ... <style>`
- **參數說明**：
  - `<category>`（**可選**）：指定筆記分類。
    - **常見分類值**：
      - `技術概念`（或 `tech`、`技術討論`）→ 導向 `Journey/04_Coding/技術討論與概念/`（參照**規則一**）
      - `新點子`（或 `點子`、`idea`）→ 導向 `Journey/05_Ideas/` 及其子資料夾（參照**規則二**）
      - `專案筆記`（或 `project`、`app`）→ 導向 `Journey/04_Coding/100 Apps Challenge/<id>-<appname>.md`（參照**規則三**）
      - 特定子領域（如 `商業`、`軟體開發`、`生活用品` 等）→ 導向對應分類子資料夾
  - **🤖 自動分類推斷 (Inference Fallback)**：
    - 若使用者**未提供 `<category>`**，Agent **必須根據 `<scope>` 與上下文語意自行推斷分類**：
      - 若主題聚焦於程式架構、演算法、底層原理、框架特性 → 自動推斷為「`技術概念`」
      - 若主題聚焦於新產品構想、市場靈感、創意功能、生活用品點子 → 自動推斷為「`新點子`」
      - 若主題聚焦於子專案當前開發狀態、進度回顧、技術選型決策 → 自動推斷為「`專案筆記`」
    - **❓ 詢問原則**：若上下文資訊不足、語意模糊或難以斷定適合之分類與存放路徑，**Agent 必須直接向使用者提問確認**（例如：「請問這段內容您希望記錄到【技術討論與概念】還是【05_Ideas/軟體開發】？」），切忌憑空猜測亂放。
  - `<scope1> <scope2> ...`：指定需要提取並記錄的討論範圍/主題（可為複數）。
  - `<style>`（**可選**）：文章整理風格（例如：`卡片筆記 (Zettelkasten)`、`深度概念解析 (Deep Dive)`、`教學手冊 (Tutorial)`、`架構決策 (ADR/Summary)`、`精華條列 (Bullet Points)` 等）。

- **🚨 目標檔案衝突檢查 (Conflict Check)**：
  - 定位出目標路徑與檔案名稱後，**在寫入前必須先檢查該檔案是否已存在**。
  - **若路徑已存在**：
    - 若為既有筆記的正常內容增補（如專案筆記或已有的技術主題），依規則比對差集後無縫插入。
    - 若可能產生主題衝突或覆蓋風險，**必須先詢問使用者**：「目標筆記 `<path>` 已存在，您希望將內容【整合/增補至該現有文件】，還是【另取新的檔案名稱/路徑】？」待使用者確認後方可執行。

---

## 3. 知識鏈接與雙向連結 (Knowledge Linking & Backlinks)

在記錄技術概念或專案筆記時，盡量將相關概念、工具與專案用 Obsidian 雙向連結語法（如 `[[React]]`、`[[Mermaid]]`）互相鏈接，形成知識網絡，便於後續查閱與知識沉澱。

---

## 4. 執行標準作業程序 (Step-by-Step SOP)

```
[使用者觸發 /to-obsidian-note]
              │
              ▼
    解析參數 (all 或 category+scope+style)
              │
              ▼
    是否有提供 <category>？
       ├── [是] ──► 依指定分類決定目標資料夾
       └── [否] ──► 依據 <scope> 與上下文語意自行推斷分類
                      │
                      └──► [若仍無法推斷] ──► 直接向使用者提問確認
              │
              ▼
   檢查目標檔案是否存在？
       ├── [是] ──► 依主題比對差集增補；若有衝突疑慮則詢問使用者
       └── [否] ──► 依對應規範創建全新結構化 Markdown 檔案
              │
              ▼
   輸出完成報告（包含實際寫入的檔案路徑與變更摘要）
```
