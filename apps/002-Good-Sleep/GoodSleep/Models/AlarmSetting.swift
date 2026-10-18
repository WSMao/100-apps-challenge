import Foundation

/// 內建舒緩喚醒鈴聲（全數支援無縫循環播放與 iOS 系統鎖屏 AlarmKit）
enum BuiltInRingtone: String, CaseIterable, Identifiable, Codable {
    case morningChime = "builtin.morningChime"
    case singingBowl = "builtin.singingBowl"
    case forestBirds = "builtin.forestBirds"
    case warmMarimba = "builtin.warmMarimba"
    case crystalMusicBox = "builtin.crystalMusicBox"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .morningChime: return "晨間清脆鐘琴"
        case .singingBowl: return "西藏頌缽泛音"
        case .forestBirds: return "森林晨曦鳥鳴"
        case .warmMarimba: return "溫暖木琴琶音"
        case .crystalMusicBox: return "星光水晶音樂盒"
        }
    }
    
    var subtitle: String {
        switch self {
        case .morningChime: return "純淨鐘琴頻率 • 溫和喚醒清晨意識"
        case .singingBowl: return "432Hz 深層泛音共振 • 平靜無壓甦醒"
        case .forestBirds: return "清晨微風與林間鳥鳴 • 自然生物鐘律動"
        case .warmMarimba: return "圓潤木質五聲琶音 • 輕快迎向晨光"
        case .crystalMusicBox: return "清透高頻星光音色 • 夢境平滑過渡"
        }
    }
    
    var icon: String {
        switch self {
        case .morningChime: return "bell.and.waves.left.and.right.fill"
        case .singingBowl: return "circle.circle.fill"
        case .forestBirds: return "bird.fill"
        case .warmMarimba: return "pianokeys.inverse"
        case .crystalMusicBox: return "sparkles"
        }
    }
    
    /// 對應存放在 Bundle 或 `<App Container>/Library/Sounds/` 的 `.caf` 檔案名稱
    var fileName: String {
        switch self {
        case .morningChime: return "alarm_melody.caf"
        case .singingBowl: return "ringtone_singing_bowl.caf"
        case .forestBirds: return "ringtone_forest_birds.caf"
        case .warmMarimba: return "ringtone_warm_marimba.caf"
        case .crystalMusicBox: return "ringtone_crystal_box.caf"
        }
    }
}

/// 使用者從「檔案 (Files) / iCloud Drive」匯入並自動轉檔為 `.caf` 的自訂鬧鈴項目
struct CustomRingtoneItem: Codable, Identifiable, Equatable, Sendable {
    var id: String                  // 例如 "custom.<UUID>"
    var displayName: String         // 顯示名稱（使用者原檔名去副檔名）
    var fileName: String            // 儲存於 Library/Sounds/ 下的檔名，例如 "custom_xxx.caf"
    var durationSeconds: Double     // 裁切後音訊長度（≤ 28 秒，確保相容系統通知與無縫循環）
    var createdAt: Date
}

/// 智慧鬧鐘與就寢提醒設定
struct AlarmSetting: Codable, Equatable {
    var isEnabled: Bool
    var targetWakeTime: Date           // 目標喚醒時間 (預設 07:30)
    var targetBedtime: Date            // 目標就寢時間 (預設 23:30)
    var bedtimeReminderMinutes: Int    // 就寢前幾分鐘提醒 (5~60 分鐘，預設 30 分鐘)
    var isReminderEnabled: Bool        // 是否啟用入睡前提醒
    var isDNDGuideEnabled: Bool        // 是否啟用夜間勿擾引導提示
    var repeatDays: Set<Int>           // 1=週日, 2=週一 ... 7=週六
    
    // 鬧鐘進階設定
    var isRepeatingAlarm: Bool         // 循環鬧鐘：若開啟則每天同一時間都會響起，即使未點選「開始睡眠」
    var isSnoozeEnabled: Bool          // 稍後提醒開關
    var snoozeDurationMinutes: Int     // 稍後提醒時間 (1~30 分鐘，預設 5 分鐘)
    
    // 鬧鈴與漸進喚醒設定
    var selectedRingtoneID: String     // 內建 ID ("builtin.xxx") 或自訂 ID ("custom.xxx")
    var selectedSoundFileName: String  // 對應之 .caf 檔名 (供 AlarmKit / UNNotificationSound / AVAudioPlayer 使用)
    var selectedRingtoneTitle: String  // 當前選用鈴聲之顯示名稱
    var isGentleFadeInEnabled: Bool    // 漸進式溫和喚醒 (15 秒內音量由弱漸強並無限重複播放)
    
    // 計算預計睡眠時長 (分鐘)
    var plannedSleepMinutes: Int {
        Self.calculateDurationMinutes(bedtime: targetBedtime, wakeTime: targetWakeTime)
    }
    
    // 計算預計睡眠時長 (小時)
    var plannedSleepHours: Double {
        return Double(plannedSleepMinutes) / 60.0
    }
    
    // 計算完整 90 分鐘睡眠週期個數
    var sleepCycles: Double {
        return plannedSleepHours / 1.5
    }
    
    // MARK: - 自適應時間計算輔助函式
    
    /// 給定起床時間與時長(分鐘)，計算就寢時間
    static func calculateBedtime(wakeTime: Date, durationMinutes: Int) -> Date {
        let calendar = Calendar.current
        let wakeComp = calendar.dateComponents([.hour, .minute], from: wakeTime)
        let wakeM = (wakeComp.hour ?? 7) * 60 + (wakeComp.minute ?? 0)
        var bedM = (wakeM - durationMinutes) % (24 * 60)
        if bedM < 0 {
            bedM += 24 * 60
        }
        let h = bedM / 60
        let m = bedM % 60
        return calendar.date(bySettingHour: h, minute: m, second: 0, of: wakeTime) ?? wakeTime
    }
    
    /// 給定就寢時間與時長(分鐘)，計算起床時間
    static func calculateWakeTime(bedtime: Date, durationMinutes: Int) -> Date {
        let calendar = Calendar.current
        let bedComp = calendar.dateComponents([.hour, .minute], from: bedtime)
        let bedM = (bedComp.hour ?? 23) * 60 + (bedComp.minute ?? 0)
        let wakeM = (bedM + durationMinutes) % (24 * 60)
        let h = wakeM / 60
        let m = wakeM % 60
        return calendar.date(bySettingHour: h, minute: m, second: 0, of: bedtime) ?? bedtime
    }
    
    /// 給定就寢時間與起床時間，計算跨夜時長(分鐘)
    static func calculateDurationMinutes(bedtime: Date, wakeTime: Date) -> Int {
        let calendar = Calendar.current
        let wakeComp = calendar.dateComponents([.hour, .minute], from: wakeTime)
        let bedComp = calendar.dateComponents([.hour, .minute], from: bedtime)
        
        let wakeMinutes = (wakeComp.hour ?? 7) * 60 + (wakeComp.minute ?? 0)
        let bedMinutes = (bedComp.hour ?? 23) * 60 + (bedComp.minute ?? 0)
        
        var diff = wakeMinutes - bedMinutes
        if diff <= 0 {
            diff += 24 * 60
        }
        return diff
    }
    
    // MARK: - Codable 相容性支援
    enum CodingKeys: String, CodingKey {
        case isEnabled, targetWakeTime, targetBedtime
        case bedtimeReminderMinutes, isReminderEnabled, isDNDGuideEnabled, repeatDays
        case isRepeatingAlarm, isSnoozeEnabled, snoozeDurationMinutes
        case selectedRingtoneID, selectedSoundFileName, selectedRingtoneTitle, isGentleFadeInEnabled
    }
    
    init(
        isEnabled: Bool = true,
        targetWakeTime: Date,
        targetBedtime: Date,
        bedtimeReminderMinutes: Int = 30,
        isReminderEnabled: Bool = true,
        isDNDGuideEnabled: Bool = true,
        repeatDays: Set<Int> = [2, 3, 4, 5, 6],
        isRepeatingAlarm: Bool = false,
        isSnoozeEnabled: Bool = true,
        snoozeDurationMinutes: Int = 5,
        selectedRingtoneID: String = BuiltInRingtone.morningChime.id,
        selectedSoundFileName: String = BuiltInRingtone.morningChime.fileName,
        selectedRingtoneTitle: String = BuiltInRingtone.morningChime.title,
        isGentleFadeInEnabled: Bool = true
    ) {
        self.isEnabled = isEnabled
        self.targetWakeTime = targetWakeTime
        self.targetBedtime = targetBedtime
        self.bedtimeReminderMinutes = min(max(bedtimeReminderMinutes, 5), 60)
        self.isReminderEnabled = isReminderEnabled
        self.isDNDGuideEnabled = isDNDGuideEnabled
        self.repeatDays = repeatDays
        self.isRepeatingAlarm = isRepeatingAlarm
        self.isSnoozeEnabled = isSnoozeEnabled
        self.snoozeDurationMinutes = min(max(snoozeDurationMinutes, 1), 30)
        self.selectedRingtoneID = selectedRingtoneID
        self.selectedSoundFileName = selectedSoundFileName
        self.selectedRingtoneTitle = selectedRingtoneTitle
        self.isGentleFadeInEnabled = isGentleFadeInEnabled
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.isEnabled = try container.decodeIfPresent(Bool.self, forKey: .isEnabled) ?? true
        self.targetWakeTime = try container.decodeIfPresent(Date.self, forKey: .targetWakeTime) ?? Date()
        self.targetBedtime = try container.decodeIfPresent(Date.self, forKey: .targetBedtime) ?? Date()
        let rawReminder = try container.decodeIfPresent(Int.self, forKey: .bedtimeReminderMinutes) ?? 30
        self.bedtimeReminderMinutes = min(max(rawReminder, 5), 60)
        self.isReminderEnabled = try container.decodeIfPresent(Bool.self, forKey: .isReminderEnabled) ?? true
        self.isDNDGuideEnabled = try container.decodeIfPresent(Bool.self, forKey: .isDNDGuideEnabled) ?? true
        self.repeatDays = try container.decodeIfPresent(Set<Int>.self, forKey: .repeatDays) ?? [2, 3, 4, 5, 6]
        self.isRepeatingAlarm = try container.decodeIfPresent(Bool.self, forKey: .isRepeatingAlarm) ?? false
        self.isSnoozeEnabled = try container.decodeIfPresent(Bool.self, forKey: .isSnoozeEnabled) ?? true
        let rawSnooze = try container.decodeIfPresent(Int.self, forKey: .snoozeDurationMinutes) ?? 5
        self.snoozeDurationMinutes = min(max(rawSnooze, 1), 30)
        self.selectedRingtoneID = try container.decodeIfPresent(String.self, forKey: .selectedRingtoneID) ?? BuiltInRingtone.morningChime.id
        self.selectedSoundFileName = try container.decodeIfPresent(String.self, forKey: .selectedSoundFileName) ?? BuiltInRingtone.morningChime.fileName
        self.selectedRingtoneTitle = try container.decodeIfPresent(String.self, forKey: .selectedRingtoneTitle) ?? BuiltInRingtone.morningChime.title
        self.isGentleFadeInEnabled = try container.decodeIfPresent(Bool.self, forKey: .isGentleFadeInEnabled) ?? true
    }
    
    static var `default`: AlarmSetting {
        let calendar = Calendar.current
        var bedComponents = DateComponents()
        bedComponents.hour = 23
        bedComponents.minute = 30
        let bedDate = calendar.date(from: bedComponents) ?? Date()
        
        var wakeComponents = DateComponents()
        wakeComponents.hour = 7
        wakeComponents.minute = 30
        let wakeDate = calendar.date(from: wakeComponents) ?? Date()
        
        return AlarmSetting(
            isEnabled: true,
            targetWakeTime: wakeDate,
            targetBedtime: bedDate,
            bedtimeReminderMinutes: 30,
            isReminderEnabled: true,
            isDNDGuideEnabled: true,
            repeatDays: [2, 3, 4, 5, 6],
            isRepeatingAlarm: false,
            isSnoozeEnabled: true,
            snoozeDurationMinutes: 5
        )
    }
}

