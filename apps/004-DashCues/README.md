# 004-DashCues

> A native macOS menu bar companion that lets you summon, browse, and pin app shortcut maps in seconds.

[![Status](https://img.shields.io/badge/Status-In%20Progress-ffb020.svg)]()
[![Platform](https://img.shields.io/badge/Platform-macOS%2013%2B-111827.svg)]()
[![Stack](https://img.shields.io/badge/Stack-SwiftUI%20%2B%20AppKit-0ea5e9.svg)]()

---

## 核心痛點與價值 (Why DashCues?)

1. **快捷鍵資訊分散**：不同 App 的官方文件、教學文章與個人筆記分散，切換查找成本高。  
   **DashCues 解法**：集中成單一入口，從 menu bar 即可快速查閱。
2. **操作中難以持續參照**：一般說明視窗容易被覆蓋，邊操作邊查看不順。  
   **DashCues 解法**：可將快捷鍵地圖 pin 成浮動視窗，跨視窗持續顯示。
3. **自訂快捷鍵缺乏結構化管理**：臨時筆記難搜尋、難維護，也不易備份。  
   **DashCues 解法**：提供 App 與快捷鍵的結構化管理、搜尋、排序與手動備份/還原。
4. **全域喚出不夠直覺**：進入查詢流程步驟太多，打斷工作節奏。  
   **DashCues 解法**：支援全域快捷鍵快速開啟，保持高頻使用效率。

---

## 使用者指南 (User Guide)

### 1) 快速喚出

- 點擊 menu bar 鍵盤圖示開啟 DashCues popover。
- 或使用你設定的全域快捷鍵直接喚出。

### 2) 查閱與 pin 快捷鍵地圖

- 左側是 App 清單（釘選優先，其他依名稱排序）。
- 將游標移到 App，即可在右側查看該 App 的快捷鍵地圖。
- 點擊地圖上的 pin，可開啟獨立浮動地圖視窗。
- 可同時 pin 多張地圖；再次點擊 pin 可關閉單一地圖。

### 3) 管理 App 與快捷鍵

- 點擊「打開 DashCues」進入 Dashboard。
- 可新增/編輯/刪除 App 與快捷鍵，並釘選常用 App。
- 支援關鍵字、標籤與按鍵組合搜尋，方便快速定位。

### 4) 備份與還原

- 在設定中可手動匯出 JSON 備份檔。
- 還原前會顯示覆寫確認，避免誤覆蓋現有資料。
- 備份可儲存到本機或 iCloud Drive（手動備份流程，非即時同步）。

---

## 開發者指南 (Developer Guide)

### 技術棧 (Tech Stack)

- **UI**: SwiftUI
- **System Integration**: AppKit (`NSPopover`, `NSPanel`, 檔案面板) + Carbon (global hotkey)
- **Build**: Swift Package Manager
- **Storage**: Local JSON (`~/Library/Application Support/DashCues/shortcuts.json`)
- **Validation**: Built-in SwiftPM self-test (`--self-test`)

### 架構概要 (Architecture Overview)

```text
Layer 5: App Entry & Window Flow
  - AppDelegate, Status Bar, Dashboard Window
    ▲
Layer 4: UI Views
  - ShortcutPopoverView, ShortcutMapView, DashboardView, ShortcutListView
    ▲
Layer 3: UI Models & Interaction
  - ShortcutListModel, search/filter/sort interactions
    ▲
Layer 2: Services
  - ShortcutStore, GlobalHotKeyManager, PinnedMapWindowManager
    ▲
Layer 1: Data Models & Catalog
  - ShortcutModels, ShortcutCatalog
```

### 本機開發與建置 (Getting Started)

```bash
cd apps/004-DashCues

# Optional: regenerate app icon from SVG
./Scripts/build-icon.sh

# Build
swift build

# Validation (store persistence, CRUD rules, backup/restore checks)
swift run DashCues --self-test

# Package .app bundle and launch
./Scripts/build-app.sh
open build/DashCues.app
```

快速重啟：

```bash
./restart
./restart --build
```

`.env.example` 僅作為專案標準占位，目前無需外部 API 金鑰或環境變數。

---

## 品牌與素材 (Brand Assets)

- 主 Logo: `Assets/Logos/logo.svg`
- App Icon: `Assets/AppIcon.icns`
- Logo 候選稿: `Assets/Logos/Candidate1.svg` ~ `Assets/Logos/Candidate7.svg`

---

## 目前產品邊界 (Current Scope)

- 以 **本機資料管理 + 手動備份/還原** 為主。
