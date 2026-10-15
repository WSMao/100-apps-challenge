import Foundation

/// 單次睡眠紀錄模型
struct SleepLog: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var date: Date                   // 記錄所屬日期 (起床當天)
    var bedtime: Date                // 昨晚入睡時間
    var wakeTime: Date               // 晨間醒來時間
    var scheduledWakeTime: Date      // 預設鬧鐘時間
    var rating: SleepRating          // 起床自評狀態貼圖
    var isSnoozed: Bool              // 是否賴床
    var snoozeMinutes: Int           // 賴床時長 (分鐘)
    var note: String                 // 晨間微筆記 (做夢或醒來感受)
    var completedChecklistCount: Int // 睡前完成的避坑項目數
    
    // 實際睡眠總時長 (小時)
    var durationHours: Double {
        let diffSeconds = wakeTime.timeIntervalSince(bedtime)
        return max(0, diffSeconds / 3600.0)
    }
    
    // 格式化睡眠時長 (例：7 小時 30 分)
    var durationFormatted: String {
        let hours = Int(durationHours)
        let minutes = Int((durationHours - Double(hours)) * 60)
        return "\(hours) 小時 \(minutes) 分"
    }
    
    // 綜合睡眠品質健康分 (滿分 100)
    var calculatedScore: Int {
        var baseScore = rating.score
        
        // 睡眠時長修正：理想 7-9 小時
        if durationHours >= 7.0 && durationHours <= 9.0 {
            baseScore += 10
        } else if durationHours < 6.0 {
            baseScore -= 15
        }
        
        // 賴床扣分
        if isSnoozed {
            baseScore -= min(20, snoozeMinutes * 2)
        }
        
        // 睡前儀式加分
        baseScore += min(10, completedChecklistCount * 2)
        
        return max(10, min(100, baseScore))
    }
    
    static var mockHistory: [SleepLog] {
        let calendar = Calendar.current
        let today = Date()
        
        return (1...5).compactMap { dayOffset -> SleepLog? in
            guard let logDate = calendar.date(byAdding: .day, value: -dayOffset, to: today),
                  let bed = calendar.date(byAdding: .hour, value: -8, to: logDate) else {
                return nil
            }
            
            let ratings: [SleepRating] = [.refreshed, .good, .tired, .good, .refreshed]
            let rating = ratings[dayOffset % ratings.count]
            let isSnooze = dayOffset % 2 == 1
            
            return SleepLog(
                date: logDate,
                bedtime: bed,
                wakeTime: logDate,
                scheduledWakeTime: logDate,
                rating: rating,
                isSnoozed: isSnooze,
                snoozeMinutes: isSnooze ? 15 : 0,
                note: isSnooze ? "鬧鐘響了按掉一次，有點累" : "自然醒，精神很好！",
                completedChecklistCount: 4
            )
        }
    }
}

