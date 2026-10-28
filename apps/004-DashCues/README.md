# 004-DashCues

DashCues 是一款原生 macOS 快捷鍵查閱工具。使用者可從選單列或全域快捷鍵快速叫出介面，查看各個 App 的快捷鍵地圖，並管理自己的快捷鍵資料。

## 產品規劃與 MVP 範圍

### 核心痛點

- 使用者需要離開目前工作情境、搜尋文件或記憶各個 App 的快捷鍵，查閱成本高。
- 不同 App 的快捷鍵分散，缺乏可快速掃描與比較的集中介面。
- 一般提示視窗會被其他 App 覆蓋，不方便在操作時持續參照。
- 使用者自己的快捷鍵筆記缺乏統一、可編輯且可備份的管理方式。

### MVP 核心功能清單

- [ ] 從 macOS 選單列開啟快捷鍵查閱 popover，並支援可設定的全域快捷鍵。
- [ ] 介面依序顯示「打開 DashCues」、釘選的應用程式、其他應用程式（順序與 Dashboard 一致）；移入 App 時顯示完整的已收錄快捷鍵地圖。
- [ ] 快捷鍵地圖提供 pin 按鈕，可開啟可拖曳、浮在其他視窗上方的地圖；可同時 pin 多個 App，再按各地圖上的 pin 按鈕即可關閉該地圖。
- [ ] 內建 macOS 常用 App 快捷鍵資料，並支援新增、編輯、刪除 App 與快捷鍵。
- [ ] 資料預設儲存在本機；可手動匯出備份及從備份還原。使用檔案選擇器可將備份存放到 iCloud Drive；不做即時同步。

Google Drive 整合與跨裝置即時同步不在 MVP 範圍內。內建快捷鍵清單採可擴充、可編輯的資料集；使用者可補上自己的快捷鍵。

## 💡 使用者應用指南

1. 從選單列的鍵盤圖示點開 DashCues。popover 左側最上方是「打開 DashCues」，其下是「搜尋 App」輸入框（依名稱或 Bundle ID 篩選，開啟時預設聚焦，可直接輸入；`↓` 跳到第一個結果，`↑` 回到「打開 DashCues」，`Esc` 先清空再關閉），接著是釘選的 App，最後是其他 App（順序與 Dashboard 一致）。
2. 將游標移至 App 名稱即可在右側檢視目前收錄的快捷鍵地圖。點擊 pin 可開啟可移動的浮動地圖；點擊地圖上的 pin 按鈕即可關閉該地圖。可以同時保留多張地圖。
3. popover 開啟時預設聚焦在搜尋框；`↑` 移到「打開 DashCues」後按 `Enter` 開啟 Dashboard；`↑`/`↓` 在「打開 DashCues」、搜尋框與各 App 間移動並即時顯示快捷鍵地圖，`→` 進入右側快捷鍵列表（`↑`/`↓` 瀏覽、`←` 回到 App 列表），`Esc` 關閉 popover。點擊 popover 外部也會關閉；已 pin 的浮動地圖會繼續顯示。
4. 點「打開 DashCues」進入完整管理視窗，可搜尋 App、釘選 App（釘選的 App 固定排在清單最上方並顯示 pin 圖示）、拖移調整 App 順序（pinned 永遠在未 pinned 之上；搜尋中停用拖移）、新增/編輯/刪除 App 與快捷鍵（新增 App 時按「選擇 App…」從電腦挑選 .app，會自動帶入名稱、Bundle ID 並顯示該 App 的真實圖示；找不到圖示時以預設符號代替），並點標題列右側的齒輪「設定」設定全域快捷鍵。
5. 管理視窗的快捷鍵列表（行內編輯，無跳出視窗）：
   - 「新增快捷鍵」會在列表最下方加一列空條目並直接進入「功能名稱」輸入；名稱與按鍵都空白就離開時，條目會自動刪除。
   - 列表上方的搜尋框：輸入關鍵字會比對功能名稱、標籤與按鍵組合；輸入時下拉列出該 App 的標籤，可用滑鼠或 `↑`/`↓` + `Enter` 加入為標籤篩選（可多個，需全部符合）；點鍵盤圖示進入按鍵搜尋，直接按下要找的組合（`Esc` 結束）。關鍵字、標籤、按鍵條件同時成立才顯示，列表只顯示符合的快捷鍵。
   - 單選的條目，名稱／按鍵組合／標籤會變成輸入框；標籤欄可貼上多個標籤（每個標籤右上角的 ✕ 可移除），輸入時會列出該 App 已有的標籤，可用滑鼠或 `↑`/`↓` + `Enter` 選取，輸入新名稱則新增標籤並加入該 App 的標籤清單；「編輯 App」視窗內的「標籤管理」可重新命名或刪除標籤（按「儲存」後套用）；點擊欄位或按 `Enter` 進入輸入模式（橘框為目前焦點）。`Tab`／`Shift+Tab` 在欄位間循環，`Enter` 儲存並離開，`Esc` 還原該欄位並離開，點擊該條目以外的地方也會離開輸入模式。
   - 「按鍵組合」欄位不會出現游標，而是即時顯示你按下的組合，可重新按鍵覆蓋；不需要修飾鍵（可錄 `F5`、`Space` 等）。單獨的 `Tab`／`Enter`／`Esc` 是操作鍵，要記錄請搭配修飾鍵。
   - 非輸入模式時，`↑`/`↓` 移動選取（加 `Shift` 延伸），`Esc` 取消選取；可用 `Shift`／`⌘` 點擊多選。
   - 在左側 App 清單按 `→` 進入快捷鍵列表（自動選取第一筆），列表非輸入模式時按 `←` 回到 App 清單。
   - 有選取時列表下方出現紅色垃圾桶，點擊後需按「確定」才會刪除（多選會一併刪除）。
6. 在管理視窗標題列右側點齒輪「設定」，再點「備份至檔案…」，於系統存檔視窗選擇儲存位置（例如 iCloud Drive）。還原時會提示目前資料將被備份內容取代。

## 🛠️ 技術路線

- **平台**：macOS 13 或更新版本
- **UI 框架**：SwiftUI
- **系統整合**：AppKit（選單列 popover、可浮動的 `NSPanel`、系統檔案選擇器）與 Carbon（全域快捷鍵）
- **建置工具**：Swift Package Manager
- **本機儲存**：JSON，位於 `~/Library/Application Support/DashCues/shortcuts.json`
- **備份**：使用者透過系統檔案選擇器手動匯出/還原 JSON；可選 iCloud Drive 位置，不要求帳號或自動同步服務
- **測試**：內建 SwiftPM self-test（不依賴 XCTest/Xcode）

## 🚀 開發者安裝說明

需要 macOS 13+ 與 Swift 5.9+。Xcode IDE 不需要用於 Swift Package 的建置與測試；產生可啟動的 `.app` bundle 時，`Scripts/build-app.sh` 會使用 SwiftPM 與系統 `codesign`。

```bash
cd apps/004-DashCues
./Scripts/build-icon.sh
swift build
swift run DashCues --self-test
./Scripts/build-app.sh
open build/DashCues.app
```

快速關閉並重啟 App：`./restart`；若要先重新打包再重啟：`./restart --build`。
若要改用其他 SVG 產生 App icon：

```bash
./Scripts/build-icon.sh Assets/Logos/<your-logo>.svg
```

`.env.example` 保留專案標準；目前不需要環境變數、外部 API 或憑證。

## 🎨 Logo 設計草稿

- 正式採用：`Assets/Logos/logo.svg`（原 `logo-j-variant-2-sunset.svg`，內容未修改）。
- Candidate 1：`Assets/Logos/Candidate1.svg`
- Candidate 2：`Assets/Logos/Candidate2.svg`
- Candidate 3：`Assets/Logos/Candidate3.svg`
- Candidate 4：`Assets/Logos/Candidate4.svg`
- Candidate 5：`Assets/Logos/Candidate5.svg`
- Candidate 6：`Assets/Logos/Candidate6.svg`
- Candidate 7：`Assets/Logos/Candidate7.svg`
- PNG 格式的草稿與素材保留原檔名及格式。

App 圖示檔為 `Assets/AppIcon.icns`。

### Icon 產線注意事項（避免再次踩雷）

- Dock icon 固定走單一路徑：`SVG -> Scripts/build-icon.sh -> Assets/AppIcon.icns -> build-app.sh`
- 不使用 runtime `NSApp.applicationIconImage` 覆蓋 Dock icon（避免與 bundle icon 不一致）。
- 不使用 `qlmanage` 或其他會改變渲染結果的縮圖流程產生正式 icon（曾導致白底與外觀偏差）。
- 需要更新 icon 時只執行：
  - `./Scripts/build-icon.sh Assets/Logos/<logo>.svg`
  - `./Scripts/build-app.sh`
- 若 Dock 未立即更新，執行 LaunchServices + Dock/Finder refresh（先前已驗證有效）。

## 應用架構與設計

- `Models/ShortcutCatalog.swift`：macOS 常用 App 的初始快捷鍵資料。
- `Sources/DashCues/Models/ShortcutModels.swift`：App、快捷鍵、全域快捷鍵與備份快照模型。
- `Sources/DashCues/Services/ShortcutStore.swift`：本機 JSON 持久化、資料驗證、快捷鍵 CRUD 與備份/還原。
- `Sources/DashCues/Services/GlobalHotKeyManager.swift`：使用 Carbon 註冊全域組合鍵；新組合鍵無法註冊時保留原設定並顯示錯誤。
- `Sources/DashCues/Services/PinnedMapWindowManager.swift`：以獨立浮動 `NSPanel` 管理多張可移動快捷鍵地圖。
- `Sources/DashCues/Views/ShortcutPopoverView.swift`、`ShortcutMapView.swift`：選單列 popover、App 清單、hover 地圖與 pin 操作。
- `Sources/DashCues/Views/DashboardView.swift`：App 管理、全域快捷鍵設定與備份/還原操作。
- `Sources/DashCues/Views/ShortcutListView.swift`、`ShortcutListModel.swift`：Dashboard 的快捷鍵列表（行內編輯、多選、鍵盤操作、刪除確認）；`ShortcutSearchBar.swift`：搜尋框。
- `Sources/DashCues/Services/ShortcutStoreSelfTest.swift`：資料持久化、CRUD 限制、排序與備份還原驗證。

資料預設只在本機儲存。iCloud Drive 是由使用者在檔案選擇器中自行選擇的備份位置；備份還原會明確告知並以備份內容取代目前資料。Google Drive 與即時雲端同步留待後續評估。

## 📋 工作快照

| 日期 | Agent | 工作記錄 | 下一步 | 備注 |
|---|---|---|---|---|
| 2026-10-27 | Copilot | 建立原生 macOS 專案骨架，規劃選單列查閱、快捷鍵地圖 pin 視窗、本機資料與 iCloud 手動備份。 | 完成介面、資料管理、備份/還原並執行測試。 | 在獨立 `004-DashCues` worktree 開發；初始資料可由使用者擴充。 |
| 2026-10-28 | Copilot | 完成 Dashboard／popover 介面：App 釘選與拖移排序、快捷鍵列表行內編輯與多選、多標籤與標籤管理、列表搜尋（關鍵字／標籤／按鍵）、設定按鈕、popover 搜尋與鍵盤導覽、`restart` 腳本。 | 實機驗證互動細節，確認後 merge 回 main。 | 滑鼠／鍵盤互動僅通過自測，尚待人工確認。 |

## 未來展望

- 評估 Google Drive 備份與多裝置即時同步。
- 擴充常用第三方 App 的快捷鍵資料集。
