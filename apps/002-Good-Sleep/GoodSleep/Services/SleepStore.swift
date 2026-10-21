import Foundation
import Combine

/// 全域睡眠資料儲存與狀態管理中心 (Local-First 持久化)
@MainActor
final class SleepStore: ObservableObject {
    @Published var checklist: [ChecklistItem] = []
    @Published var alarmSetting: AlarmSetting = .default
    @Published var sleepHistory: [SleepLog] = []
    @Published var isShowingMorningSheet: Bool = false
    
    // 即時睡眠追蹤與睡前筆記
    @Published var isSleeping: Bool = false
    @Published var ongoingBedtime: Date? = nil
    @Published var pendingBedtimeNote: String = ""
    
    private let checklistKey = "goodsleep.checklist.v1"
    private let alarmKey = "goodsleep.alarm.v1"
    private let historyKey = "goodsleep.history.v1"
    private let lastChecklistDateKey = "goodsleep.checklist.date"
    private let isSleepingKey = "goodsleep.isSleeping.v1"
    private let ongoingBedtimeKey = "goodsleep.ongoingBedtime.v1"
    private let pendingBedtimeNoteKey = "goodsleep.pendingBedtimeNote.v1"
    
    init() {
        loadData()
        checkAndResetDailyChecklist()
        if alarmSetting.isEnabled && (alarmSetting.isRepeatingAlarm || isSleeping) {
            NotificationManager.shared.scheduleWakeAlarm(setting: alarmSetting)
        }
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
            // 防呆防護：排除入睡時間晚於或等於醒來時間的異常記錄
            self.sleepHistory = history.filter { $0.bedtime < $0.wakeTime }
        } else {
            self.sleepHistory = SleepLog.mockHistory
        }
        
        // 載入進行中的睡眠狀態與睡前筆記
        self.isSleeping = UserDefaults.standard.bool(forKey: isSleepingKey)
        self.ongoingBedtime = UserDefaults.standard.object(forKey: ongoingBedtimeKey) as? Date
        self.pendingBedtimeNote = UserDefaults.standard.string(forKey: pendingBedtimeNoteKey) ?? ""
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
        // 排程入睡前提醒
        NotificationManager.shared.scheduleBedtimeReminder(setting: setting)
        // 若總開關開啟，立即根據設定更新鬧鐘（開啟循環鬧鐘則每日重複；未開啟循環鬧鐘則排程下一次單次響鈴，支援稍後提醒設定）
        if setting.isEnabled {
            NotificationManager.shared.scheduleWakeAlarm(setting: setting)
        } else {
            NotificationManager.shared.cancelWakeAlarm()
        }
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
    
    // MARK: - 邏輯睡眠日（Cutoff Threshold 正午 12:00 換日錨點）
    /// - 中午 12:00 ~ 23:59 入睡：屬於當晚就寢日 (Day T)
    /// - 凌晨 00:00 ~ 11:59 入睡：屬於昨夜熬夜晚睡，歸屬前一晚就寢日 (Day T - 1)
    static func logicalSleepDate(for time: Date = Date()) -> Date {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: time)
        if hour < 12 {
            let prevDay = calendar.date(byAdding: .day, value: -1, to: time) ?? time
            return calendar.startOfDay(for: prevDay)
        } else {
            return calendar.startOfDay(for: time)
        }
    }
    
    // MARK: - 昨夜睡眠目標日 (Day T - 1)
    /// 例如今日為 19 號，昨晚入睡日即為 18 號
    var targetLastNightDate: Date {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return calendar.date(byAdding: .day, value: -1, to: today) ?? today
    }
    
    // MARK: - 昨夜晨間報告記錄（以昨晚入睡的睡眠記錄為主，例如今日為 19 號，以 18 號的記錄為準）
    var todayLog: SleepLog? {
        let calendar = Calendar.current
        let yesterday = targetLastNightDate
        
        // 1. 優先尋找昨夜 (例如 18 號) 入睡的記錄
        if let log = sleepHistory.first(where: { calendar.startOfDay(for: $0.date) == yesterday }) {
            return log
        }
        // 2. 次之尋找今晨醒來 (wakeTime 在今日) 的記錄
        if let log = sleepHistory.first(where: { calendar.isDateInToday($0.wakeTime) }) {
            return log
        }
        // 3. 再次比對當前邏輯睡眠日的記錄
        let logicalToday = SleepStore.logicalSleepDate(for: Date())
        if let log = sleepHistory.first(where: { calendar.startOfDay(for: $0.date) == logicalToday }) {
            return log
        }
        return nil
    }
    
    // MARK: - 睡前晚安與即時睡眠追蹤
    func startSleep(at time: Date = Date(), note: String = "") {
        self.isSleeping = true
        self.ongoingBedtime = time
        if !note.isEmpty {
            self.pendingBedtimeNote = note
        }
        UserDefaults.standard.set(true, forKey: isSleepingKey)
        UserDefaults.standard.set(time, forKey: ongoingBedtimeKey)
        UserDefaults.standard.set(self.pendingBedtimeNote, forKey: pendingBedtimeNoteKey)
        // 注意：開始睡眠僅記錄進行中睡眠狀態，絕不寫入或修改 completed sleepHistory，避免未打卡或取消睡眠時殘留異常記錄
    }
    
    func saveBedtimeNote(_ note: String) {
        self.pendingBedtimeNote = note
        UserDefaults.standard.set(note, forKey: pendingBedtimeNoteKey)
        // 睡前筆記儲存於進行中狀態，待晨醒打卡時一併寫入歷史記錄
    }
    
    func clearSleepingState() {
        self.isSleeping = false
        self.ongoingBedtime = nil
        self.pendingBedtimeNote = ""
        UserDefaults.standard.removeObject(forKey: isSleepingKey)
        UserDefaults.standard.removeObject(forKey: ongoingBedtimeKey)
        UserDefaults.standard.removeObject(forKey: pendingBedtimeNoteKey)
    }
    
    /// 取消本次睡眠：清除正在睡眠狀態並取消單次鬧鐘（若開啟循環鬧鐘則維持每日鬧鐘），絕不產生任何睡眠記錄
    func cancelSleep() {
        clearSleepingState()
        if alarmSetting.isEnabled && alarmSetting.isRepeatingAlarm {
            NotificationManager.shared.scheduleWakeAlarm(setting: alarmSetting)
        } else {
            NotificationManager.shared.cancelWakeAlarm()
        }
    }
    
    func recordMorningWakeUp(
        bedtime: Date,
        wakeTime: Date,
        rating: SleepRating,
        isSnoozed: Bool,
        snoozeMinutes: Int,
        note: String,
        bedtimeNote: String = ""
    ) {
        // 防呆防護：入睡時間必須早於醒來時間
        guard wakeTime > bedtime else {
            return
        }
        
        let finalBedtimeNote = !bedtimeNote.isEmpty ? bedtimeNote : pendingBedtimeNote
        let logicalDate = SleepStore.logicalSleepDate(for: bedtime)
        
        let cal = Calendar.current
        let targetBedHour = cal.component(.hour, from: alarmSetting.targetBedtime)
        let targetBedMin = cal.component(.minute, from: alarmSetting.targetBedtime)
        let scheduledBed: Date
        if targetBedHour >= 12 {
            scheduledBed = cal.date(bySettingHour: targetBedHour, minute: targetBedMin, second: 0, of: logicalDate) ?? logicalDate
        } else {
            let nextDay = cal.date(byAdding: .day, value: 1, to: logicalDate) ?? logicalDate
            scheduledBed = cal.date(bySettingHour: targetBedHour, minute: targetBedMin, second: 0, of: nextDay) ?? nextDay
        }
        
        let newLog = SleepLog(
            date: logicalDate,
            bedtime: bedtime,
            wakeTime: wakeTime,
            scheduledWakeTime: alarmSetting.targetWakeTime,
            scheduledBedtime: scheduledBed,
            rating: rating,
            isSnoozed: isSnoozed,
            snoozeMinutes: snoozeMinutes,
            note: note,
            bedtimeNote: finalBedtimeNote,
            completedChecklistCount: completedChecklistCount
        )
        
        // 避免同夜重複，以邏輯睡眠夜為準進行覆寫或插入
        let calendar = Calendar.current
        if let index = sleepHistory.firstIndex(where: { calendar.startOfDay(for: $0.date) == logicalDate }) {
            sleepHistory[index] = newLog
        } else {
            sleepHistory.insert(newLog, at: 0)
        }
        sleepHistory.sort { $0.date > $1.date }
        
        clearSleepingState()
        saveHistory()
    }
    
    // MARK: - 睡眠紀錄新增、更新與刪除
    func addSleepLog(_ log: SleepLog) {
        // 防呆防護：入睡時間必須早於醒來時間
        guard log.wakeTime > log.bedtime else { return }
        
        var adjustedLog = log
        adjustedLog.date = SleepStore.logicalSleepDate(for: log.bedtime)
        let calendar = Calendar.current
        let targetDay = calendar.startOfDay(for: adjustedLog.date)
        if let index = sleepHistory.firstIndex(where: { calendar.startOfDay(for: $0.date) == targetDay }) {
            sleepHistory[index] = adjustedLog
        } else {
            sleepHistory.append(adjustedLog)
        }
        sleepHistory.sort { $0.date > $1.date }
        saveHistory()
    }
    
    func updateSleepLog(_ log: SleepLog) {
        // 防呆防護：入睡時間必須早於醒來時間
        guard log.wakeTime > log.bedtime else { return }
        
        var adjustedLog = log
        adjustedLog.date = SleepStore.logicalSleepDate(for: log.bedtime)
        if let index = sleepHistory.firstIndex(where: { $0.id == log.id }) {
            sleepHistory[index] = adjustedLog
            sleepHistory.sort { $0.date > $1.date }
            saveHistory()
        }
    }
    
    func deleteSleepLog(id: UUID) {
        sleepHistory.removeAll { $0.id == id }
        saveHistory()
    }
    
    func log(for date: Date) -> SleepLog? {
        let calendar = Calendar.current
        let targetDay = calendar.startOfDay(for: date)
        return sleepHistory.first { calendar.startOfDay(for: $0.date) == targetDay }
    }
    
    func hasLog(on date: Date) -> Bool {
        return log(for: date) != nil
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
    
    var snoozeCount: Int {
        sleepHistory.filter { $0.isSnoozed }.count
    }
    
    var snoozeRate: Double {
        guard !sleepHistory.isEmpty else { return 0 }
        return (Double(snoozeCount) / Double(sleepHistory.count)) * 100
    }
    
    var lateNightCount: Int {
        sleepHistory.filter { $0.isLateNight(fallbackTarget: alarmSetting.targetBedtime) }.count
    }
    
    var lateNightRate: Double {
        guard !sleepHistory.isEmpty else { return 0 }
        return (Double(lateNightCount) / Double(sleepHistory.count)) * 100
    }
    
    func ratingCount(for rating: SleepRating) -> Int {
        sleepHistory.filter { $0.rating == rating }.count
    }
    
    func ratingPercentage(for rating: SleepRating) -> Double {
        guard !sleepHistory.isEmpty else { return 0.0 }
        return (Double(ratingCount(for: rating)) / Double(sleepHistory.count)) * 100.0
    }
}

