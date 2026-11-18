import Foundation

/// 單次睡眠紀錄模型
struct SleepLog: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var date: Date                   // 記錄所屬日期 (起床當天)
    var bedtime: Date                // 昨晚入睡時間
    var wakeTime: Date               // 晨間醒來時間
    var scheduledWakeTime: Date      // 預設鬧鐘時間
    var scheduledBedtime: Date?      // 預設就寢目標時間 (比對熬夜晚睡用)
    var rating: SleepRating          // 起床自評狀態貼圖
    var isSnoozed: Bool              // 是否賴床
    var snoozeMinutes: Int           // 賴床時長 (分鐘)
    var note: String                 // 晨間微筆記 (做夢或醒來感受)
    var bedtimeNote: String          // 睡前筆記 (睡前狀態、雜念或感恩)
    var completedChecklistCount: Int // 睡前完成的避坑項目數
    
    init(
        id: UUID = UUID(),
        date: Date,
        bedtime: Date,
        wakeTime: Date,
        scheduledWakeTime: Date,
        scheduledBedtime: Date? = nil,
        rating: SleepRating,
        isSnoozed: Bool,
        snoozeMinutes: Int = 0,
        note: String,
        bedtimeNote: String = "",
        completedChecklistCount: Int
    ) {
        self.id = id
        self.date = date
        self.bedtime = bedtime
        self.wakeTime = wakeTime
        self.scheduledWakeTime = scheduledWakeTime
        self.scheduledBedtime = scheduledBedtime
        self.rating = rating
        self.isSnoozed = isSnoozed
        self.snoozeMinutes = snoozeMinutes
        self.note = note
        self.bedtimeNote = bedtimeNote
        self.completedChecklistCount = completedChecklistCount
    }
    
    enum CodingKeys: String, CodingKey {
        case id, date, bedtime, wakeTime, scheduledWakeTime, scheduledBedtime, rating, isSnoozed, snoozeMinutes, note, bedtimeNote, completedChecklistCount
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        date = try container.decode(Date.self, forKey: .date)
        bedtime = try container.decode(Date.self, forKey: .bedtime)
        wakeTime = try container.decode(Date.self, forKey: .wakeTime)
        scheduledWakeTime = try container.decodeIfPresent(Date.self, forKey: .scheduledWakeTime) ?? wakeTime
        scheduledBedtime = try container.decodeIfPresent(Date.self, forKey: .scheduledBedtime)
        rating = try container.decode(SleepRating.self, forKey: .rating)
        isSnoozed = try container.decodeIfPresent(Bool.self, forKey: .isSnoozed) ?? false
        snoozeMinutes = try container.decodeIfPresent(Int.self, forKey: .snoozeMinutes) ?? 0
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        bedtimeNote = try container.decodeIfPresent(String.self, forKey: .bedtimeNote) ?? ""
        completedChecklistCount = try container.decodeIfPresent(Int.self, forKey: .completedChecklistCount) ?? 0
    }
    
    // 實際睡眠總分鐘數（以分鐘為解析度抹平秒數，完美對齊介面顯示之「HH:mm」時間，徹底消弭浮點截斷誤差）
    var durationMinutes: Int {
        let cal = Calendar.current
        let startComponents = cal.dateComponents([.year, .month, .day, .hour, .minute], from: bedtime)
        let endComponents = cal.dateComponents([.year, .month, .day, .hour, .minute], from: wakeTime)
        
        if let cleanStart = cal.date(from: startComponents),
           let cleanEnd = cal.date(from: endComponents) {
            let diff = cal.dateComponents([.minute], from: cleanStart, to: cleanEnd).minute ?? 0
            return max(0, diff)
        }
        
        let diffSeconds = wakeTime.timeIntervalSince(bedtime)
        return max(0, Int((diffSeconds / 60.0).rounded()))
    }
    
    // 實際睡眠總時長 (小時)
    var durationHours: Double {
        return Double(durationMinutes) / 60.0
    }
    
    // 格式化睡眠時長 (例：8 小時 3 分)
    var durationFormatted: String {
        let hours = durationMinutes / 60
        let minutes = durationMinutes % 60
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
    
    /// 取得該睡眠夜對應的「就寢目標」完整時間
    func effectiveScheduledBedtime(fallbackTarget: Date? = nil) -> Date {
        if let scheduled = scheduledBedtime {
            return scheduled
        }
        let cal = Calendar.current
        let night = cal.startOfDay(for: date)
        
        let targetTime = fallbackTarget ?? (cal.date(bySettingHour: 23, minute: 0, second: 0, of: night) ?? night)
        let targetHour = cal.component(.hour, from: targetTime)
        let targetMinute = cal.component(.minute, from: targetTime)
        
        if targetHour >= 12 {
            return cal.date(bySettingHour: targetHour, minute: targetMinute, second: 0, of: night) ?? night
        } else {
            // 就寢目標為跨午夜（例：凌晨 00:30）
            let nextDay = cal.date(byAdding: .day, value: 1, to: night) ?? night
            return cal.date(bySettingHour: targetHour, minute: targetMinute, second: 0, of: nextDay) ?? nextDay
        }
    }
    
    /// 是否比「就寢目標」晚 30 分鐘以上 (判定為熬夜晚睡)
    func isLateNight(fallbackTarget: Date? = nil) -> Bool {
        let target = effectiveScheduledBedtime(fallbackTarget: fallbackTarget)
        // 晚於就寢目標 30 分鐘 (1800 秒)
        return bedtime.timeIntervalSince(target) > 30 * 60
    }
    
    /// 是否為跨午夜或超過就寢目標 30 分鐘的熬夜晚睡
    var isLateNightBedtime: Bool {
        isLateNight()
    }
    
    /// 跨日日期範圍顯示 (例：10/16 晚 ～ 10/17 晨 或 10/16 晚 (熬夜) ～ 10/17 晨)
    var displayRangeTitle: String {
        let f = DateFormatter()
        f.dateFormat = "M/d"
        let logicalNightStr = f.string(from: date)
        let wakeDayStr = f.string(from: wakeTime)
        
        if isLateNightBedtime {
            return "\(logicalNightStr) 晚 (熬夜) ～ \(wakeDayStr) 晨"
        } else if logicalNightStr != wakeDayStr {
            return "\(logicalNightStr) 晚 ～ \(wakeDayStr) 晨"
        } else {
            return "\(logicalNightStr) 晚 ～ 晨"
        }
    }
    
    static var mockHistory: [SleepLog] {
        let calendar = Calendar.current
        let today = Date()
        
        return (1...5).compactMap { dayOffset -> SleepLog? in
            // 邏輯睡眠夜：過去幾天的夜晚 (例：dayOffset = 1 代表昨晚)
            guard let logicalNight = calendar.date(byAdding: .day, value: -dayOffset, to: today) else {
                return nil
            }
            let nightStart = calendar.startOfDay(for: logicalNight)
            
            // 就寢目標：設為當晚 23:00
            let scheduledBed = calendar.date(bySettingHour: 23, minute: 0, second: 0, of: nightStart) ?? nightStart
            
            // 入睡時間：設在當晚 23:15 (其中一天設為熬夜 01:15 測試)
            let isLateNightSample = (dayOffset == 2)
            let bed: Date
            if isLateNightSample {
                // 熬夜：隔日凌晨 01:15 (比 23:00 晚超過 30 分鐘)
                let nextMorning = calendar.date(byAdding: .day, value: 1, to: nightStart) ?? nightStart
                bed = calendar.date(bySettingHour: 1, minute: 15, second: 0, of: nextMorning) ?? nextMorning
            } else {
                // 正常入睡：23:15 (比 23:00 晚 15 分鐘，小於 30 分鐘不判定熬夜)
                bed = calendar.date(bySettingHour: 23, minute: 15, second: 0, of: nightStart) ?? nightStart
            }
            
            // 起床時間：隔日早晨 07:15
            let wakeDay = calendar.date(byAdding: .day, value: 1, to: nightStart) ?? nightStart
            let wake = calendar.date(bySettingHour: 7, minute: 15, second: 0, of: wakeDay) ?? wakeDay
            
            let ratings: [SleepRating] = [.refreshed, .good, .tired, .good, .refreshed]
            let rating = ratings[dayOffset % ratings.count]
            let isSnooze = dayOffset % 2 == 1
            let sampleBedNotes = [
                "今天讀了 15 分鐘書，心情平靜放鬆。",
                "睡前泡了個熱水澡，身體微微發熱很想睡。",
                "趕專案熬夜了一會兒，提醒自己明天一定要早點休息。",
                "做了 4-7-8 呼吸 3 輪，呼吸順暢多了。",
                "今天工作告一段落，沒有懸念，安心晚安。"
            ]
            
            return SleepLog(
                date: nightStart,
                bedtime: bed,
                wakeTime: wake,
                scheduledWakeTime: wake,
                scheduledBedtime: scheduledBed,
                rating: rating,
                isSnoozed: isSnooze,
                snoozeMinutes: isSnooze ? 15 : 0,
                note: isSnooze ? "鬧鐘響了按掉一次，有點累" : "自然醒，精神很好！",
                bedtimeNote: sampleBedNotes[dayOffset % sampleBedNotes.count],
                completedChecklistCount: 4
            )
        }
    }
}
