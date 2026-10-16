# 002-Good-Sleep

一款專注於睡前預防、溫和引導與晨間正向復盤的原生 iOS 應用程式。針對現代人失眠的真實痛點，在睡前透過極簡、OLED 深色低刺激的介面，引導建立放鬆儀式與避坑檢核，並於醒來時提供晨間報告與自評記錄，打破「越想睡越睡不著」的焦慮惡性循環。

---

## MVP

### 核心痛點
- 又失眠了。睡覺超級重要，一失眠就會感受到狀態變差，不管是臉色暗沈、冒痘痘、眼睛酸、頭腦昏沈反應變慢等等。
- 失眠的原因有很多種，在失眠的時候才來想如何入睡基本上只是更加無法入睡，需要事前預防與低認知負擔的儀式引導。

### MVP 核心功能清單
- [x] 睡眠建議（時刻檢視自己哪些沒有做好：避坑防範、環境調節、放鬆靜心）
- [x] 數據顯示
  - [x] 入睡 / 起床時間紀錄
  - [x] 睡眠時長與 90 分鐘睡眠週期計算
  - [x] 今日晨間報告摘要卡片
- [x] 智慧鬧鐘
  - [x] 循環鬧鐘，也可隨時微調
  - [x] 自動進入勿擾（iOS 專注模式連動導引與提示）
  - [x] 入睡就寢排程提醒推播
- [x] 睡眠檢測評分
  - [x] 起床狀態自評貼圖 (🤩 精力充沛 / 😊 感覺良好 / 🥱 略帶倦意 / 😵 昏沈熊貓眼)
  - [x] 是否賴床檢測（記錄響鈴到實際起床時間差）
  - [x] 晨間微筆記（起床隨手記錄做夢或身心感受）
- [x] 助眠微音效（雨夜窗台、寧靜潮汐、深山晚風、溫柔白噪即時合成聲景）

---

## 🛠️ 技術路線
- **作業系統**：iOS 18+
- **開發語言**：Swift 6 (開啟嚴格並行檢查 Swift Concurrency)
- **UI 框架**：SwiftUI
- **建置工具**：Xcode 16 / xcodebuild
- **資料儲存**：UserDefaults (JSON Local-First 本機優先持久化)
- **系統框架**：
  - `UserNotifications`（就寢提前提醒與喚醒鬧鐘通知）
  - `AVFoundation`（CoreAudio 即時低頻白噪音與環境微音效合成）
- **專案結構**：原生 Xcode 專案 (`GoodSleep.xcodeproj`)

---

## 🚀 安裝與啟動說明

```bash
# 1. 確保已安裝 macOS 與 Xcode 16+
# 2. 開啟本專案目錄中的 Xcode 專案檔
open apps/002-Good-Sleep/GoodSleep.xcodeproj

# 3. 於 Xcode 目標選擇模擬器（如 iPhone 16 Pro）或實體 iPhone
# 4. 按下 Cmd + R 進行建置與執行
```

亦可透過終端機進行命令列編譯驗證：
```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project apps/002-Good-Sleep/GoodSleep.xcodeproj \
  -scheme GoodSleep \
  -destination "generic/platform=iOS Simulator" \
  CODE_SIGNING_ALLOWED=NO build
```

---

## 💡 使用說明
1. **今日儀表板 (Today)**：首頁呈現今晚目標就寢倒數、預計睡眠時長，醒來後第一時間呈現晨間報告或打卡入口。
2. **睡前避坑與引導 (Checklist)**：確認下午不攝取咖啡因、睡前遠離螢幕、調暗環境光線，可一鍵開啟雨夜/潮汐白噪音放鬆入眠。
3. **智慧鬧鐘與排程 (Alarm)**：設定滾輪式就寢與起床時間，自動換算符合人體生理學之 90 分鐘睡眠週期數，並提供就寢推播提醒。
4. **睡眠趨勢與歷史 (History)**：圖表化呈現平均睡眠時長、平均睡眠健康評分、賴床頻率與歷史紀錄列表。

---

## 應用架構
- **純原生架構 (Pure Native iOS)**：基於 SwiftUI 聲明式介面與 `@MainActor` 單向資料流。
- **本機優先 (Local-First)**：所有資料均在本機持久化，完全保護個人隱私，免聯網、無外部伺服器依賴。
- **低刺激視覺規範**：採用高對比低亮度之 OLED 深藍黑深夜護眼主題，全面降低夜間螢幕對褪黑激素的干擾。

---

## 📋工作快照

| 日期 | Agent | 工作記錄 | 下一步 | 備注 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-15 | Antigravity | 完成原生 Xcode 專案結構、SwiftUI 4 大功能模組、本地持久化儲存、通知管理器與 AVFoundation 聲景播放器，通過 xcodebuild 編譯驗證 | 進行模擬器真機測試驗證與截圖 | 達成 MVP 核心功能標準 |
| 2026-10-15 | Antigravity | 完成專案初期規劃、建立 apps/002-Good-Sleep 目錄與標準工程文件 README.md | 初始化原生 Xcode 專案結構與 UI 原型 | 依據 rules.md 規範建立 |

---

## 未來展望
- **Apple Watch 獨立延伸 App (WatchOS / WatchKit)**：同步心率與手腕體溫，提供無聲觸覺震動喚醒。
- **iOS 鎖定畫面小工具 (WidgetKit) 與靈動島 (Live Activities)**：即時掌握離目標就寢時間倒數。
- **深度 HealthKit 雙向同步**：無縫將睡眠數據同步至 Apple Health 健康資料庫。
- **咖啡因截止時間提醒**： 比如設定睡前多久不可再喝咖啡，然後截止日期前提醒用戶要把咖啡喝完。
