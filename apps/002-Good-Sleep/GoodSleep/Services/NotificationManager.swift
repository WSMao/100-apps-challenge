import Foundation
import UserNotifications

/// 本機推播與排程通知管理器
@MainActor
final class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()
    
    @Published var isAuthorized: Bool = false
    
    override init() {
        super.init()
        checkAuthorization()
    }
    
    func checkAuthorization() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let isAuth = (settings.authorizationStatus == .authorized)
            Task { @MainActor in
                self.isAuthorized = isAuth
            }
        }
    }
    
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            Task { @MainActor in
                self.isAuthorized = granted
            }
        }
    }
    
    /// 排程就寢前提醒
    func scheduleBedtimeReminder(setting: AlarmSetting) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["bedtime_reminder"])
        
        guard setting.isReminderEnabled else { return }
        
        let calendar = Calendar.current
        let bedComponents = calendar.dateComponents([.hour, .minute], from: setting.targetBedtime)
        
        guard let bedHour = bedComponents.hour, let bedMinute = bedComponents.minute else { return }
        
        // 往前推算 reminderMinutes
        var reminderTotalMinutes = (bedHour * 60 + bedMinute) - setting.bedtimeReminderMinutes
        if reminderTotalMinutes < 0 {
            reminderTotalMinutes += 24 * 60
        }
        
        let reminderHour = reminderTotalMinutes / 60
        let reminderMinute = reminderTotalMinutes % 60
        
        let content = UNMutableNotificationContent()
        content.title = "🌙 就寢時間快到囉"
        content.body = "離預定就寢時間還有 \(setting.bedtimeReminderMinutes) 分鐘，建議調暗光線、開啟勿擾模式，準備好眠。"
        content.sound = .default
        
        var dateComponents = DateComponents()
        dateComponents.hour = reminderHour
        dateComponents.minute = reminderMinute
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(identifier: "bedtime_reminder", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("排程就寢提醒失敗: \(error.localizedDescription)")
            }
        }
    }
    
    /// 排程晨間喚醒鬧鐘通知
    func scheduleWakeAlarm(setting: AlarmSetting) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm"])
        
        guard setting.isEnabled else { return }
        
        let calendar = Calendar.current
        let wakeComponents = calendar.dateComponents([.hour, .minute], from: setting.targetWakeTime)
        
        let content = UNMutableNotificationContent()
        content.title = "☀️ 早安！美好的一天開始了"
        content.body = "該起床伸展囉！點擊完成晨間打卡，記錄今日睡眠品質。"
        // 使用客製化晨間清脆鐘琴鈴聲
        content.sound = UNNotificationSound(named: UNNotificationSoundName("alarm_melody.caf"))
        content.interruptionLevel = .timeSensitive
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: wakeComponents, repeats: true)
        let request = UNNotificationRequest(identifier: "wake_alarm", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("排程鬧鐘失敗: \(error.localizedDescription)")
            }
        }
    }
    
    /// 5 秒後測試鬧鐘通知 (供使用者測試背景/鎖屏推播與客製化鈴聲)
    func scheduleTestAlarmIn5Seconds() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm_test"])
        
        let content = UNMutableNotificationContent()
        content.title = "☀️ [測試] 鬧鐘響起！"
        content.body = "這是一條 5 秒測試喚醒鬧鐘！請點擊進入完成晨間打卡。"
        content.sound = UNNotificationSound(named: UNNotificationSoundName("alarm_melody.caf"))
        content.interruptionLevel = .timeSensitive
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        let request = UNNotificationRequest(identifier: "wake_alarm_test", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("測試鬧鐘排程失敗: \(error.localizedDescription)")
            }
        }
    }
    
    /// 排程賴床 5 分鐘後再次響起
    func scheduleSnoozeAlarm(minutes: Int = 5) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm_snooze"])
        
        let content = UNMutableNotificationContent()
        content.title = "⏰ 賴床時間到囉！"
        content.body = "已經多賴了 \(minutes) 分鐘，深呼吸準備迎接今天吧！"
        content.sound = UNNotificationSound(named: UNNotificationSoundName("alarm_melody.caf"))
        content.interruptionLevel = .timeSensitive
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(minutes * 60), repeats: false)
        let request = UNNotificationRequest(identifier: "wake_alarm_snooze", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("賴床鬧鐘排程失敗: \(error.localizedDescription)")
            }
        }
    }
}

