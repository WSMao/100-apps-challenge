import Foundation
import Combine

/// 全域睡眠資料儲存與狀態管理中心 (Local-First 持久化)
@MainActor
final class SleepStore: ObservableObject {
    @Published var checklist: [ChecklistItem] = []
    @Published var alarmSetting: AlarmSetting = .default
    @Published var sleepHistory: [SleepLog] = []
    @Published var isShowingMorningSheet: Bool = false
    
    private let checklistKey = "goodsleep.checklist.v1"
    private let alarmKey = "goodsleep.alarm.v1"
    private let historyKey = "goodsleep.history.v1"
    private let lastChecklistDateKey = "goodsleep.checklist.date"
    
    init() {
        loadData()
        checkAndResetDailyChecklist()
    }
    
    // MARK: - 資料載入與儲存
    func loadData() {
        // 載入鬧鐘設定
        if let data = UserDefaults.standard.data(forKey: alarmKey),
           let setting = try? JSONDecoder().decode(AlarmSetting.self, from: data) {
            self.alarmSetting = setting
        } else {
            self.alarmSetting = .default
        }
        
        // 載入檢核清單
        if let data = UserDefaults.standard.data(forKey: checklistKey),
           let items = try? JSONDecoder().decode([ChecklistItem].self, from: data) {
            self.checklist = items
        } else {
            self.checklist = ChecklistItem.defaultItems
        }
        
        // 載入睡眠歷史
        if let data = UserDefaults.standard.data(forKey: historyKey),
           let history = try? JSONDecoder().decode([SleepLog].self, from: data) {
            self.sleepHistory = history
        } else {
            self.sleepHistory = SleepLog.mockHistory
        }
    }
    
    private func saveChecklist() {
        if let data = try? JSONEncoder().encode(checklist) {
            UserDefaults.standard.set(data, forKey: checklistKey)
        }
    }
    
    func saveAlarmSetting(_ setting: AlarmSetting) {
        self.alarmSetting = setting
        if let data = try? JSONEncoder().encode(setting) {
            UserDefaults.standard.set(data, forKey: alarmKey)
        }
        // 排程通知
        NotificationManager.shared.scheduleBedtimeReminder(setting: setting)
        NotificationManager.shared.scheduleWakeAlarm(setting: setting)
    }
    
    private func saveHistory() {
        if let data = try? JSONEncoder().encode(sleepHistory) {
            UserDefaults.standard.set(data, forKey: historyKey)
        }
    }
    
    // MARK: - 每日檢核清單重置
    private func checkAndResetDailyChecklist() {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        
        if let lastDate = UserDefaults.standard.object(forKey: lastChecklistDateKey) as? Date {
            let lastDay = calendar.startOfDay(for: lastDate)
            if today > lastDay {
                // 新的一天，重置避坑檢核
                self.checklist = self.checklist.map {
                    var item = $0
                    item.isCompleted = false
                    return item
                }
                saveChecklist()
                UserDefaults.standard.set(today, forKey: lastChecklistDateKey)
            }
        } else {
            UserDefaults.standard.set(today, forKey: lastChecklistDateKey)
        }
    }
    
    // MARK: - 檢核項目操作
    func toggleChecklistItem(id: String) {
        if let index = checklist.firstIndex(where: { $0.id == id }) {
            checklist[index].isCompleted.toggle()
            saveChecklist()
        }
    }
    
    var completedChecklistCount: Int {
        checklist.filter { $0.isCompleted }.count
    }
    
    // MARK: - 晨間起床打卡與報告記錄
    var todayLog: SleepLog? {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return sleepHistory.first { calendar.startOfDay(for: $0.date) == today }
    }
    
    func recordMorningWakeUp(
        bedtime: Date,
        wakeTime: Date,
        rating: SleepRating,
        isSnoozed: Bool,
        snoozeMinutes: Int,
        note: String
    ) {
        let newLog = SleepLog(
            date: Date(),
            bedtime: bedtime,
            wakeTime: wakeTime,
            scheduledWakeTime: alarmSetting.targetWakeTime,
            rating: rating,
            isSnoozed: isSnoozed,
            snoozeMinutes: snoozeMinutes,
            note: note,
            completedChecklistCount: completedChecklistCount
        )
        
        // 避免同日重複，若已存在則更新
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        if let index = sleepHistory.firstIndex(where: { calendar.startOfDay(for: $0.date) == today }) {
            sleepHistory[index] = newLog
        } else {
            sleepHistory.insert(newLog, at: 0)
        }
        
        saveHistory()
    }
    
    // MARK: - 睡眠統計指標
    var averageSleepHours: Double {
        guard !sleepHistory.isEmpty else { return 0 }
        let total = sleepHistory.reduce(0.0) { $0 + $1.durationHours }
        return total / Double(sleepHistory.count)
    }
    
    var averageScore: Int {
        guard !sleepHistory.isEmpty else { return 0 }
        let total = sleepHistory.reduce(0) { $0 + $1.calculatedScore }
        return total / sleepHistory.count
    }
    
    var snoozeRate: Double {
        guard !sleepHistory.isEmpty else { return 0 }
        let count = sleepHistory.filter { $0.isSnoozed }.count
        return (Double(count) / Double(sleepHistory.count)) * 100
    }
}

