import Foundation
import UserNotifications

/// 本機推播與排程通知管理器
@MainActor
final class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()
    
    static let categoryWithSnooze = "WAKE_ALARM_WITH_SNOOZE"
    static let categoryNoSnooze = "WAKE_ALARM_NO_SNOOZE"
    static let actionSnooze = "SNOOZE_ACTION"
    static let actionStop = "STOP_ACTION"
    
    @Published var isAuthorized: Bool = false
    
    override init() {
        super.init()
        registerNotificationCategories()
        checkAuthorization()
    }
    
    private func registerNotificationCategories() {
        let snoozeAction = UNNotificationAction(
            identifier: Self.actionSnooze,
            title: "稍後提醒",
            options: []
        )
        let stopAction = UNNotificationAction(
            identifier: Self.actionStop,
            title: "起床打卡",
            options: [.foreground]
        )
        
        let withSnoozeCategory = UNNotificationCategory(
            identifier: Self.categoryWithSnooze,
            actions: [snoozeAction, stopAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        let noSnoozeCategory = UNNotificationCategory(
            identifier: Self.categoryNoSnooze,
            actions: [stopAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([
            withSnoozeCategory,
            noSnoozeCategory
        ])
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
        Task { @MainActor in
            _ = await WakeAlarmService.shared.requestAuthorizationIfNeeded()
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
    
    /// 排程晨間喚醒鬧鐘（優先使用 iOS 26+ AlarmKit 系統級鬧鐘，舊版降級為本地通知）
    func scheduleWakeAlarm(setting: AlarmSetting) {
        Task { @MainActor in
            await WakeAlarmService.shared.scheduleWakeAlarm(setting: setting)
        }
    }
    
    /// 停止當次正在響鈴的鬧鐘（保留每日循環鬧鐘排程）
    func stopAlertingAlarm() {
        WakeAlarmService.shared.stopAlertingAlarm()
    }
    
    /// 取消所有晨間喚醒鬧鐘
    func cancelWakeAlarm() {
        WakeAlarmService.shared.cancelWakeAlarm()
    }
    
    /// 5 秒後測試鬧鐘（iOS 26+ 直接觸發 AlarmKit 系統鎖屏全螢幕鬧鐘）
    func scheduleTestAlarmIn5Seconds(setting: AlarmSetting? = nil) {
        Task { @MainActor in
            await WakeAlarmService.shared.scheduleTestAlarmIn5Seconds(
                isSnoozeEnabled: setting?.isSnoozeEnabled ?? true,
                snoozeMinutes: setting?.snoozeDurationMinutes ?? 5,
                soundFileName: setting?.selectedSoundFileName ?? BuiltInRingtone.morningChime.fileName,
                isGentleFadeInEnabled: setting?.isGentleFadeInEnabled ?? true
            )
        }
    }
    
    /// 排程稍後提醒鬧鐘
    func scheduleSnoozeAlarm(
        minutes: Int = 5,
        isSnoozeEnabled: Bool = true,
        soundFileName: String? = nil,
        isGentleFadeInEnabled: Bool? = nil
    ) {
        let storedSetting = Self.loadStoredAlarmSetting()
        let resolvedSound = soundFileName ?? storedSetting.selectedSoundFileName
        let resolvedFadeIn = isGentleFadeInEnabled ?? storedSetting.isGentleFadeInEnabled
        
        Task { @MainActor in
            await WakeAlarmService.shared.scheduleSnoozeAlarm(
                minutes: minutes,
                isSnoozeEnabled: isSnoozeEnabled,
                soundFileName: resolvedSound,
                isGentleFadeInEnabled: resolvedFadeIn
            )
        }
    }
    
    // MARK: - 鎖屏起床通知與本地通知備援方法 (同時支援 AlarmKit 鎖屏伴隨通知，讓使用者停止鬧鐘後可點選通知進入 App 打卡)
    
    func scheduleFallbackWakeNotification(setting: AlarmSetting, isCompanionToAlarmKit: Bool = false) {
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm"])
        
        guard setting.isEnabled else { return }
        
        let calendar = Calendar.current
        let wakeComponents = calendar.dateComponents([.hour, .minute], from: setting.targetWakeTime)
        
        let content = UNMutableNotificationContent()
        content.title = "☀️ 早安！美好的一天開始了"
        content.body = "停止鬧鐘後，點擊此通知即可進入「好好睡覺」完成起床打卡與睡眠記錄。"
        // 若搭配 AlarmKit 系統鬧鐘，由 AlarmKit 負責播放大聲鬧鈴；若為備援模式則由通知播放鈴聲
        content.sound = isCompanionToAlarmKit ? nil : UNNotificationSound(named: UNNotificationSoundName(setting.selectedSoundFileName))
        content.interruptionLevel = .timeSensitive
        content.categoryIdentifier = setting.isSnoozeEnabled ? Self.categoryWithSnooze : Self.categoryNoSnooze
        content.userInfo = [
            "snoozeMinutes": setting.snoozeDurationMinutes,
            "isSnoozeEnabled": setting.isSnoozeEnabled,
            "soundFileName": setting.selectedSoundFileName,
            "isGentleFadeInEnabled": setting.isGentleFadeInEnabled,
            "isCompanionToAlarmKit": isCompanionToAlarmKit
        ]
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: wakeComponents, repeats: setting.isRepeatingAlarm)
        let request = UNNotificationRequest(identifier: "wake_alarm", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("排程鬧鐘失敗: \(error.localizedDescription)")
            }
        }
    }
    
    func cancelFallbackWakeNotifications() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm", "wake_alarm_test", "wake_alarm_snooze", "wake_alarm_checkin"])
    }
    
    func clearDeliveredWakeNotifications() {
        let center = UNUserNotificationCenter.current()
        center.removeDeliveredNotifications(withIdentifiers: ["wake_alarm", "wake_alarm_test", "wake_alarm_snooze", "wake_alarm_checkin"])
    }
    
    /// 當使用者在鎖屏透過 iOS AlarmKit 滑動停止鬧鐘後，確保鎖屏上立即有一則可點擊的「起床打卡」通知
    func postImmediateWakeCheckInNotification() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm_checkin"])
        
        let content = UNMutableNotificationContent()
        content.title = "☀️ 早安！準備好記錄昨晚的睡眠了嗎？"
        content.body = "點選此通知進入「好好睡覺」，進行起床打卡並編輯睡眠記錄。"
        content.sound = nil
        content.interruptionLevel = .timeSensitive
        content.categoryIdentifier = Self.categoryNoSnooze
        content.userInfo = [
            "isCheckInPrompt": true,
            "isCompanionToAlarmKit": true
        ]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.2, repeats: false)
        let request = UNNotificationRequest(identifier: "wake_alarm_checkin", content: content, trigger: trigger)
        center.add(request) { error in
            if let error = error {
                print("發送鎖屏起床打卡通知失敗: \(error.localizedDescription)")
            }
        }
    }
    
    func scheduleFallbackTestNotificationIn5Seconds(
        isSnoozeEnabled: Bool = true,
        snoozeMinutes: Int = 5,
        soundFileName: String = BuiltInRingtone.morningChime.fileName,
        isGentleFadeInEnabled: Bool = true,
        isCompanionToAlarmKit: Bool = false
    ) {
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm_test"])
        
        let content = UNMutableNotificationContent()
        content.title = "☀️ [測試] 早安起床打卡通知"
        content.body = "停止鬧鐘後，點擊此通知即可進入完成起床打卡並編輯睡眠記錄。"
        content.sound = isCompanionToAlarmKit ? nil : UNNotificationSound(named: UNNotificationSoundName(soundFileName))
        content.interruptionLevel = .timeSensitive
        content.categoryIdentifier = isSnoozeEnabled ? Self.categoryWithSnooze : Self.categoryNoSnooze
        content.userInfo = [
            "snoozeMinutes": snoozeMinutes,
            "isSnoozeEnabled": isSnoozeEnabled,
            "soundFileName": soundFileName,
            "isGentleFadeInEnabled": isGentleFadeInEnabled,
            "isCompanionToAlarmKit": isCompanionToAlarmKit
        ]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        let request = UNNotificationRequest(identifier: "wake_alarm_test", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("測試鬧鐘排程失敗: \(error.localizedDescription)")
            }
        }
    }
    
    func scheduleFallbackSnoozeNotification(
        minutes: Int = 5,
        isSnoozeEnabled: Bool = true,
        soundFileName: String = BuiltInRingtone.morningChime.fileName,
        isGentleFadeInEnabled: Bool = true,
        isCompanionToAlarmKit: Bool = false
    ) {
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["wake_alarm_snooze"])
        
        let content = UNMutableNotificationContent()
        content.title = "⏰ 稍後提醒時間到囉！"
        content.body = "已經多休息了 \(minutes) 分鐘，點擊此通知進入完成起床打卡吧！"
        content.sound = isCompanionToAlarmKit ? nil : UNNotificationSound(named: UNNotificationSoundName(soundFileName))
        content.interruptionLevel = .timeSensitive
        content.categoryIdentifier = isSnoozeEnabled ? Self.categoryWithSnooze : Self.categoryNoSnooze
        content.userInfo = [
            "snoozeMinutes": minutes,
            "isSnoozeEnabled": isSnoozeEnabled,
            "soundFileName": soundFileName,
            "isGentleFadeInEnabled": isGentleFadeInEnabled,
            "isCompanionToAlarmKit": isCompanionToAlarmKit
        ]
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(minutes * 60), repeats: false)
        let request = UNNotificationRequest(identifier: "wake_alarm_snooze", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("稍後提醒鬧鐘排程失敗: \(error.localizedDescription)")
            }
        }
    }
    
    private static func loadStoredAlarmSetting() -> AlarmSetting {
        if let data = UserDefaults.standard.data(forKey: "goodsleep.alarm.v1"),
           let setting = try? JSONDecoder().decode(AlarmSetting.self, from: data) {
            return setting
        }
        return .default
    }
}
