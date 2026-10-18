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
  - [x] 5 款純原生 DSP 合成舒緩喚醒鈴聲（晨曦微光木琴、頌缽冥想鐘聲、森林晨鳥與溪流、柔和暖陽馬林巴、水晶音樂盒）與無縫無限重複播放 (`AVAudioPlayer.numberOfLoops = -1`)
  - [x] 支援使用者從 iOS「檔案 (Files) / iCloud Drive」匯入自訂音樂（`.mp3`, `.m4a`, `.wav`, `.caf`, `.aiff`, `.flac`），自動截取 28 秒並正規化轉檔為 Apple 原生 `.caf` 寫入 `Library/Sounds/`，同時相容前景循環與背景 `AlarmKit` / `UNNotificationSound`
  - [x] 15 秒漸進式溫和喚醒 (Gentle Fade-in：音量由 8% 平滑爬升至 100%)
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
  - `UserNotifications` / `AlarmKit`（就寢提前提醒與系統級喚醒鬧鐘通知）
  - `AVFoundation`（CoreAudio 即時低頻白噪音、5 款 `.caf` 舒緩鬧鈴 DSP 合成與自訂音訊轉檔）
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
2. **全螢幕睡覺貓頭鷹待機畫面 (Sleep Standby)**：按下「開始睡眠」後自動進入 OLED 暗夜貓頭鷹睡眠待機畫面，上方顯示鬧鐘時間與「倒數 XX:XX」起床倒計時，中央呈現 4-4 助眠深呼吸節奏的熟睡貓頭鷹動畫；輕觸貓頭鷹可觸發耳羽晃動微互動並展開「引導睡眠」、「即時紀錄」、「早起打卡」、「長按取消」四合一選單。內建 **5 分鐘無觸控自動調暗計時功能**，連續 5 分鐘無觸控即自動將螢幕調至最暗護眼狀態，點擊觸控螢幕任意處即恢復原本亮度。
3. **晨間鬧鐘睡醒伸懶腰貓頭鷹與起床打卡 (Wake-Up & Slide to Stop)**：
   - **鎖屏時**：透過 iOS 系統 `AlarmKit` 突破靜音與勿擾模式響鈴，並同步於鎖屏發送「起床打卡通知」；滑動停止系統鬧鐘後，可直接點選鎖屏通知進入 App 打卡。
   - **App 內**：將標題替換為「貓頭鷹睡醒伸懶腰」幾何動畫 (`WakingOwlView`)，搭配「滑動來停止」互動滑桿；停止鬧鐘後進入起床確認畫面，提供【起床打卡】（直接開啟「編輯睡眠記錄」畫面紀錄昨晚睡眠）與【略過】2 個按鈕。
4. **睡前避坑與引導 (Checklist)**：確認下午不攝取咖啡因、睡前遠離螢幕、調暗環境光線，可一鍵開啟雨夜/潮汐白噪音放鬆入眠。
5. **智慧鬧鐘與自訂鈴聲庫 (Alarm)**：設定滾輪式就寢與起床時間，自動換算符合人體生理學之 90 分鐘睡眠週期數；可於「鬧鐘鈴聲」選擇 5 款內建舒緩鈴聲、開啟 15 秒漸進式溫和喚醒，或從 iOS「檔案」App 匯入個人喜愛的音樂（自動轉為 `.caf` 無縫循環鈴聲）。
6. **睡眠趨勢與歷史 (History)**：圖表化呈現平均睡眠時長、平均睡眠健康評分、賴床頻率與歷史紀錄列表。

---

## 應用架構
- **純原生架構 (Pure Native iOS)**：基於 SwiftUI 聲明式介面與 `@MainActor` 單向資料流。
- **本機優先 (Local-First)**：所有資料均在本機持久化，完全保護個人隱私，免聯網、無外部伺服器依賴。
- **低刺激視覺規範**：採用高對比低亮度之 OLED 深藍黑深夜護眼主題，全面降低夜間螢幕對褪黑激素的干擾。

---

## 📋工作快照

| 日期 | Agent | 工作記錄 | 下一步 | 備注 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-19 | Antigravity | 1. 新增鎖屏 `AlarmKit` 伴隨「起床打卡通知」，讓使用者在鎖屏停止系統鬧鐘後可點選鎖屏通知進入 App 開啟打卡畫面；2. 於貓頭鷹睡覺待機畫面 (`SleepStandbyView`) 新增 5 分鐘無觸控自動調暗計時功能，連續 5 分鐘無觸控即把螢幕調到最暗，點擊螢幕時恢復原本亮度 | 持續優化睡眠體驗與微互動細節 | 通過 Swift 6 與 `xcodebuild` 編譯驗證 |
| 2026-10-18 | Antigravity | 擴充鬧鈴系統 (`RingtoneLibraryManager`, `SoundManager`, `AlarmView`)：新增 5 款純 Swift DSP 合成 `.caf` 舒緩喚醒鈴聲、支援從 iOS 檔案 App 匯入自訂音樂（`.mp3`/`.m4a`/`.wav`/`.caf`/`.aiff`/`.flac` 自動轉檔為 `Library/Sounds/*.caf` 供前景無限循環與背景 `AlarmKit`/`UNNotificationSound` 共用），並加入 15 秒漸進式溫和喚醒 (Fade-in) | 持續優化睡眠體驗與微互動細節 | 通過 Swift 6 與 `xcodebuild` 編譯驗證 |
| 2026-10-18 | Antigravity | 新增「貓頭鷹睡醒伸懶腰」動畫 (`WakingOwlView`) 並重構鬧鐘響起畫面 (`AlarmRingingView`)：將原「好好睡覺」替換為睡醒伸懶腰貓頭鷹動畫，支援「滑動來停止」互動滑桿與系統 AlarmKit 停止連動，滑動停止後切換至包含【起床打卡】（開啟 `EditSleepLogSheet` 編輯睡眠記錄）與【略過】的晨間喚醒畫面 | 持續優化睡眠體驗與微互動細節 | 零外部依賴純原生實現 |
| 2026-10-18 | Antigravity | 新增純 SwiftUI 幾何插畫「睡覺貓頭鷹」動畫 (`SleepingOwlView`) 與全螢幕睡眠待機畫面 (`SleepStandbyView`)，支援 4-4 深呼吸起伏、飄浮 Zzz、鬧鐘與起床倒數計時顯示，以及點擊貓頭鷹展開四合一選單（引導睡眠、即時紀錄、早起打卡、防誤觸長按取消） | 持續優化睡眠體驗與微互動細節 | 零外部依賴純原生實現 |
| 2026-10-15 | Antigravity | 完成原生 Xcode 專案結構、SwiftUI 4 大功能模組、本地持久化儲存、通知管理器與 AVFoundation 聲景播放器，通過 xcodebuild 編譯驗證 | 進行模擬器真機測試驗證與截圖 | 達成 MVP 核心功能標準 |
| 2026-10-15 | Antigravity | 完成專案初期規劃、建立 apps/002-Good-Sleep 目錄與標準工程文件 README.md | 初始化原生 Xcode 專案結構與 UI 原型 | 依據 rules.md 規範建立 |

---

## 未來展望
- **Apple Watch 獨立延伸 App (WatchOS / WatchKit)**：同步心率與手腕體溫，提供無聲觸覺震動喚醒。
- **iOS 鎖定畫面小工具 (WidgetKit) 與靈動島 (Live Activities)**：即時掌握離目標就寢時間倒數。
- **深度 HealthKit 雙向同步**：無縫將睡眠數據同步至 Apple Health 健康資料庫。
- **咖啡因截止時間提醒**： 比如設定睡前多久不可再喝咖啡，然後截止日期前提醒用戶要把咖啡喝完。
