import Foundation

/// 智慧鬧鐘與就寢提醒設定
struct AlarmSetting: Codable, Equatable {
    var isEnabled: Bool
    var targetWakeTime: Date           // 目標喚醒時間 (預設 07:30)
    var targetBedtime: Date            // 目標就寢時間 (預設 23:30)
    var bedtimeReminderMinutes: Int    // 就寢前幾分鐘提醒 (預設 30 分鐘)
    var isReminderEnabled: Bool        // 是否啟用就寢推播提醒
    var isDNDGuideEnabled: Bool        // 是否啟用夜間勿擾引導提示
    var repeatDays: Set<Int>           // 1=週日, 2=週一 ... 7=週六
    
    // 雙軌並行鬧鐘喚醒模式 (可複選)
    var useInternalAlarm: Bool         // 內建鬧鐘 (預設開啟)
    var useSystemAlarm: Bool           // 系統鬧鐘 (透過捷徑同步至 iOS 原生時鐘)
    
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
        case useInternalAlarm, useSystemAlarm
    }
    
    init(
        isEnabled: Bool = true,
        targetWakeTime: Date,
        targetBedtime: Date,
        bedtimeReminderMinutes: Int = 30,
        isReminderEnabled: Bool = true,
        isDNDGuideEnabled: Bool = true,
        repeatDays: Set<Int> = [2, 3, 4, 5, 6],
        useInternalAlarm: Bool = true,
        useSystemAlarm: Bool = false
    ) {
        self.isEnabled = isEnabled
        self.targetWakeTime = targetWakeTime
        self.targetBedtime = targetBedtime
        self.bedtimeReminderMinutes = bedtimeReminderMinutes
        self.isReminderEnabled = isReminderEnabled
        self.isDNDGuideEnabled = isDNDGuideEnabled
        self.repeatDays = repeatDays
        self.useInternalAlarm = useInternalAlarm
        self.useSystemAlarm = useSystemAlarm
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.isEnabled = try container.decodeIfPresent(Bool.self, forKey: .isEnabled) ?? true
        self.targetWakeTime = try container.decodeIfPresent(Date.self, forKey: .targetWakeTime) ?? Date()
        self.targetBedtime = try container.decodeIfPresent(Date.self, forKey: .targetBedtime) ?? Date()
        self.bedtimeReminderMinutes = try container.decodeIfPresent(Int.self, forKey: .bedtimeReminderMinutes) ?? 30
        self.isReminderEnabled = try container.decodeIfPresent(Bool.self, forKey: .isReminderEnabled) ?? true
        self.isDNDGuideEnabled = try container.decodeIfPresent(Bool.self, forKey: .isDNDGuideEnabled) ?? true
        self.repeatDays = try container.decodeIfPresent(Set<Int>.self, forKey: .repeatDays) ?? [2, 3, 4, 5, 6]
        self.useInternalAlarm = try container.decodeIfPresent(Bool.self, forKey: .useInternalAlarm) ?? true
        self.useSystemAlarm = try container.decodeIfPresent(Bool.self, forKey: .useSystemAlarm) ?? false
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
            useInternalAlarm: true,
            useSystemAlarm: false
        )
    }
}

