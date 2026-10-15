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
    
    // 計算預計睡眠時長 (小時)
    var plannedSleepHours: Double {
        let calendar = Calendar.current
        let wakeComponents = calendar.dateComponents([.hour, .minute], from: targetWakeTime)
        let bedComponents = calendar.dateComponents([.hour, .minute], from: targetBedtime)
        
        let wakeMinutes = (wakeComponents.hour ?? 7) * 60 + (wakeComponents.minute ?? 30)
        let bedMinutes = (bedComponents.hour ?? 23) * 60 + (bedComponents.minute ?? 30)
        
        var diff = wakeMinutes - bedMinutes
        if diff <= 0 {
            diff += 24 * 60
        }
        return Double(diff) / 60.0
    }
    
    // 計算完整 90 分鐘睡眠週期個數
    var sleepCycles: Double {
        return plannedSleepHours / 1.5
    }
    
    static var `default`: AlarmSetting {
        let calendar = Calendar.current
        var bedComponents = DateComponents()
        bedComponents.hour = 23
        bedComponents.minute = 30
        let bedDate = calendar.date(from: bedComponents) ?? Date()
        
        var wakeComponents = DateComponents()
        wakeComponents.hour = 7
        wakeComponents.minute = 0
        let wakeDate = calendar.date(from: wakeComponents) ?? Date()
        
        return AlarmSetting(
            isEnabled: true,
            targetWakeTime: wakeDate,
            targetBedtime: bedDate,
            bedtimeReminderMinutes: 30,
            isReminderEnabled: true,
            isDNDGuideEnabled: true,
            repeatDays: [2, 3, 4, 5, 6] // 週一至週五
        )
    }
}

