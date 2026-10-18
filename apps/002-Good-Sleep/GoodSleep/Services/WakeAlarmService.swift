import Foundation
import SwiftUI
import UserNotifications
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
#endif

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct GoodSleepAlarmMetadata: AlarmMetadata {
    var title: String = "好好睡覺"
}
#endif

/// 系統級喚醒鬧鐘服務（iOS 26+ 採用 Apple 原生 AlarmKit 突破鎖屏與靜音模式；舊版自動降級為 Time-Sensitive 本地通知）
@MainActor
final class WakeAlarmService: ObservableObject {
    static let shared = WakeAlarmService()
    
    @Published private(set) var isAlarmKitAuthorized: Bool = false
    @Published private(set) var isUsingAlarmKit: Bool = false
    
    /// 固定鬧鐘識別碼，便於更新與取消
    private let wakeAlarmID = UUID(uuidString: "A11A22B3-C4D5-4E6F-8001-000000000001")!
    private let testAlarmID = UUID(uuidString: "A11A22B3-C4D5-4E6F-8001-000000000002")!
    private let snoozeAlarmID = UUID(uuidString: "A11A22B3-C4D5-4E6F-8001-000000000003")!
    
    private init() {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            isUsingAlarmKit = true
            refreshAuthorizationStatus()
            observeAlarmUpdates()
        }
        #endif
    }
    
    // MARK: - 權限檢查與請求
    
    func refreshAuthorizationStatus() {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let state = AlarmManager.shared.authorizationState
            isAlarmKitAuthorized = (state == .authorized)
        }
        #endif
    }
    
    @discardableResult
    func requestAuthorizationIfNeeded() async -> Bool {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let currentState = AlarmManager.shared.authorizationState
            switch currentState {
            case .authorized:
                isAlarmKitAuthorized = true
                return true
            case .notDetermined:
                do {
                    let newState = try await AlarmManager.shared.requestAuthorization()
                    let granted = (newState == .authorized)
                    isAlarmKitAuthorized = granted
                    return granted
                } catch {
                    print("AlarmKit 權限請求失敗: \(error.localizedDescription)")
                    isAlarmKitAuthorized = false
                    return false
                }
            case .denied:
                isAlarmKitAuthorized = false
                return false
            @unknown default:
                return false
            }
        }
        #endif
        return false
    }
    
    // MARK: - 排程晨間喚醒鬧鐘
    
    func scheduleWakeAlarm(setting: AlarmSetting) async {
        // 確保內建合成鈴聲已寫入 Library/Sounds/ 供 AlarmKit 與系統通知讀取
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        
        // 先清除舊的主鬧鐘，避免重複排程
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            try? AlarmManager.shared.cancel(id: wakeAlarmID)
        }
        #endif
        NotificationManager.shared.cancelFallbackWakeNotifications()
        
        guard setting.isEnabled else { return }
        
        let snoozeSeconds = TimeInterval(max(1, min(30, setting.snoozeDurationMinutes)) * 60)
        let soundFileName = setting.selectedSoundFileName
        
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let granted = await requestAuthorizationIfNeeded()
            if granted {
                let calendar = Calendar.current
                let components = calendar.dateComponents([.hour, .minute], from: setting.targetWakeTime)
                guard let hour = components.hour, let minute = components.minute else { return }
                
                do {
                    let attributes = makeAlarmAttributes(
                        alertTitle: "☀️ 早安！美好的一天開始了",
                        countdownTitle: "💤 稍後提醒倒數中 (\(setting.snoozeDurationMinutes) 分鐘)...",
                        isSnoozeEnabled: setting.isSnoozeEnabled
                    )
                    let recurrence: Alarm.Schedule.Relative.Recurrence = setting.isRepeatingAlarm
                        ? .weekly([.sunday, .monday, .tuesday, .wednesday, .thursday, .friday, .saturday])
                        : .never
                    let relativeSchedule = Alarm.Schedule.Relative(
                        time: Alarm.Schedule.Relative.Time(hour: hour, minute: minute),
                        repeats: recurrence
                    )
                    let countdownDuration: Alarm.CountdownDuration? = setting.isSnoozeEnabled
                        ? Alarm.CountdownDuration(preAlert: nil, postAlert: snoozeSeconds)
                        : nil
                    let configuration = AlarmManager.AlarmConfiguration<GoodSleepAlarmMetadata>(
                        countdownDuration: countdownDuration,
                        schedule: .relative(relativeSchedule),
                        attributes: attributes,
                        sound: .named(soundFileName)
                    )
                    _ = try await AlarmManager.shared.schedule(id: wakeAlarmID, configuration: configuration)
                    // 同步排程鎖屏伴隨起床通知，讓使用者在鎖屏滑動停止 AlarmKit 鬧鐘後，可直接點選通知進入 App 打卡
                    NotificationManager.shared.scheduleFallbackWakeNotification(
                        setting: setting,
                        isCompanionToAlarmKit: true
                    )
                    return
                } catch {
                    print("AlarmKit 排程喚醒鬧鐘失敗，改用本地通知備援: \(error.localizedDescription)")
                }
            }
        }
        #endif
        
        // 若不支援 iOS 26 AlarmKit 或使用者拒絕權限，退回 Time-Sensitive 本地通知
        NotificationManager.shared.scheduleFallbackWakeNotification(setting: setting, isCompanionToAlarmKit: false)
    }
    
    // MARK: - 5 秒後模擬響鈴測試 (鎖屏與靜音突破測試)
    
    func scheduleTestAlarmIn5Seconds(
        isSnoozeEnabled: Bool = true,
        snoozeMinutes: Int = 5,
        soundFileName: String = BuiltInRingtone.morningChime.fileName,
        isGentleFadeInEnabled: Bool = true
    ) async {
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        let clampedSnooze = max(1, min(30, snoozeMinutes))
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            try? AlarmManager.shared.stop(id: testAlarmID)
            try? AlarmManager.shared.cancel(id: testAlarmID)
            let granted = await requestAuthorizationIfNeeded()
            if granted {
                do {
                    let attributes = makeAlarmAttributes(
                        alertTitle: "☀️ [測試] 好好睡覺鬧鐘響起！",
                        countdownTitle: "💤 稍後提醒倒數中 (\(clampedSnooze) 分鐘)...",
                        isSnoozeEnabled: isSnoozeEnabled
                    )
                    let countdownDuration = Alarm.CountdownDuration(
                        preAlert: 5,
                        postAlert: isSnoozeEnabled ? TimeInterval(clampedSnooze * 60) : nil
                    )
                    let configuration = AlarmManager.AlarmConfiguration<GoodSleepAlarmMetadata>(
                        countdownDuration: countdownDuration,
                        schedule: nil,
                        attributes: attributes,
                        sound: .named(soundFileName)
                    )
                    _ = try await AlarmManager.shared.schedule(id: testAlarmID, configuration: configuration)
                    // 同步排程鎖屏伴隨起床通知，讓使用者在鎖屏停止測試鬧鐘後，可點選通知進入 App 打卡
                    NotificationManager.shared.scheduleFallbackTestNotificationIn5Seconds(
                        isSnoozeEnabled: isSnoozeEnabled,
                        snoozeMinutes: clampedSnooze,
                        soundFileName: soundFileName,
                        isGentleFadeInEnabled: isGentleFadeInEnabled,
                        isCompanionToAlarmKit: true
                    )
                    return
                } catch {
                    print("AlarmKit 測試鬧鐘排程失敗，改用本地通知備援: \(error.localizedDescription)")
                }
            }
        }
        #endif
        
        NotificationManager.shared.scheduleFallbackTestNotificationIn5Seconds(
            isSnoozeEnabled: isSnoozeEnabled,
            snoozeMinutes: clampedSnooze,
            soundFileName: soundFileName,
            isGentleFadeInEnabled: isGentleFadeInEnabled,
            isCompanionToAlarmKit: false
        )
    }
    
    // MARK: - 排程稍後提醒鬧鐘 (支援原生 AlarmKit countdown 與獨立倒數計時器雙重保障)
    
    func scheduleSnoozeAlarm(
        minutes: Int = 5,
        isSnoozeEnabled: Bool = true,
        soundFileName: String = BuiltInRingtone.morningChime.fileName,
        isGentleFadeInEnabled: Bool = true
    ) async {
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        let clampedMinutes = max(1, min(30, minutes))
        
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            // 1. 若目前已有正在響鈴 (.alerting) 的 AlarmKit 鬧鐘，優先呼叫系統原生 countdown(id:) 進入稍後提醒倒數（同時保留循環鬧鐘設定）
            if let existingAlarms = try? AlarmManager.shared.alarms {
                for alarm in existingAlarms where alarm.state == .alerting {
                    if (try? AlarmManager.shared.countdown(id: alarm.id)) != nil {
                        NotificationManager.shared.scheduleFallbackSnoozeNotification(
                            minutes: clampedMinutes,
                            isSnoozeEnabled: isSnoozeEnabled,
                            soundFileName: soundFileName,
                            isGentleFadeInEnabled: isGentleFadeInEnabled,
                            isCompanionToAlarmKit: true
                        )
                        return
                    }
                    // 若該鬧鐘未帶 postAlert，則僅停止當次響鈴 (stop 會自動保留循環鬧鐘的明日排程)
                    try? AlarmManager.shared.stop(id: alarm.id)
                }
            }
            
            // 2. 排程一個新的稍後提醒倒數鬧鐘 (snoozeAlarmID)，確保百分之百會在指定分鐘後再次響起
            try? AlarmManager.shared.stop(id: snoozeAlarmID)
            try? AlarmManager.shared.cancel(id: snoozeAlarmID)
            
            let granted = await requestAuthorizationIfNeeded()
            if granted {
                do {
                    let attributes = makeAlarmAttributes(
                        alertTitle: "⏰ 稍後提醒時間到囉！準備迎接今天吧",
                        countdownTitle: "💤 稍後提醒倒數中 (\(clampedMinutes) 分鐘)...",
                        isSnoozeEnabled: isSnoozeEnabled
                    )
                    let durationSeconds = TimeInterval(clampedMinutes * 60)
                    let countdownDuration = Alarm.CountdownDuration(
                        preAlert: durationSeconds,
                        postAlert: isSnoozeEnabled ? durationSeconds : nil
                    )
                    let configuration = AlarmManager.AlarmConfiguration<GoodSleepAlarmMetadata>(
                        countdownDuration: countdownDuration,
                        schedule: nil,
                        attributes: attributes,
                        sound: .named(soundFileName)
                    )
                    _ = try await AlarmManager.shared.schedule(id: snoozeAlarmID, configuration: configuration)
                    NotificationManager.shared.scheduleFallbackSnoozeNotification(
                        minutes: clampedMinutes,
                        isSnoozeEnabled: isSnoozeEnabled,
                        soundFileName: soundFileName,
                        isGentleFadeInEnabled: isGentleFadeInEnabled,
                        isCompanionToAlarmKit: true
                    )
                    return
                } catch {
                    print("AlarmKit 稍後提醒鬧鐘排程失敗，改用本地通知備援: \(error.localizedDescription)")
                }
            }
        }
        #endif
        
        NotificationManager.shared.scheduleFallbackSnoozeNotification(
            minutes: clampedMinutes,
            isSnoozeEnabled: isSnoozeEnabled,
            soundFileName: soundFileName,
            isGentleFadeInEnabled: isGentleFadeInEnabled,
            isCompanionToAlarmKit: false
        )
    }
    
    // MARK: - 停止當次響鈴 (保留每日循環鬧鐘) vs 完全取消鬧鐘排程
    
    /// 關閉當次正在響鈴的鬧鐘（若為循環鬧鐘，AlarmKit 的 stop(id:) 會自動保留明日排程）
    func stopAlertingAlarm() {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            try? AlarmManager.shared.stop(id: testAlarmID)
            try? AlarmManager.shared.cancel(id: testAlarmID)
            try? AlarmManager.shared.stop(id: snoozeAlarmID)
            try? AlarmManager.shared.cancel(id: snoozeAlarmID)
            if let existingAlarms = try? AlarmManager.shared.alarms {
                for alarm in existingAlarms where alarm.state == .alerting || alarm.state == .countdown {
                    try? AlarmManager.shared.stop(id: alarm.id)
                }
            }
        }
        #endif
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["wake_alarm_test", "wake_alarm_snooze"]
        )
    }
    
    /// 完全取消所有鬧鐘排程（當使用者關閉鬧鐘總開關時呼叫）
    func cancelWakeAlarm() {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            for id in [wakeAlarmID, testAlarmID, snoozeAlarmID] {
                try? AlarmManager.shared.stop(id: id)
                try? AlarmManager.shared.cancel(id: id)
            }
            if let existingAlarms = try? AlarmManager.shared.alarms {
                for alarm in existingAlarms {
                    try? AlarmManager.shared.stop(id: alarm.id)
                    try? AlarmManager.shared.cancel(id: alarm.id)
                }
            }
        }
        #endif
        
        NotificationManager.shared.cancelFallbackWakeNotifications()
    }
    
    var isCurrentlyAlerting: Bool {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            if let existingAlarms = try? AlarmManager.shared.alarms {
                return existingAlarms.contains { $0.state == .alerting }
            }
        }
        #endif
        return false
    }
    
    // MARK: - 建立 AlarmKit 外觀與鎖屏互動配置
    
    #if canImport(AlarmKit)
    @available(iOS 26.0, *)
    private func makeAlarmAttributes(
        alertTitle: LocalizedStringResource,
        countdownTitle: LocalizedStringResource,
        isSnoozeEnabled: Bool
    ) -> AlarmAttributes<GoodSleepAlarmMetadata> {
        let accentGold = Color(red: 0.90, green: 0.75, blue: 0.48)
        
        let stopButton = AlarmButton(
            text: "起床打卡",
            textColor: accentGold,
            systemImageName: "sun.max.fill"
        )
        
        let snoozeButton: AlarmButton? = isSnoozeEnabled ? AlarmButton(
            text: "稍後提醒",
            textColor: .white,
            systemImageName: "zzz"
        ) : nil
        
        let alert = AlarmPresentation.Alert(
            title: alertTitle,
            stopButton: stopButton,
            secondaryButton: snoozeButton,
            secondaryButtonBehavior: isSnoozeEnabled ? .countdown : nil
        )
        
        let countdown: AlarmPresentation.Countdown? = isSnoozeEnabled ? AlarmPresentation.Countdown(
            title: countdownTitle,
            pauseButton: nil
        ) : nil
        
        let presentation = AlarmPresentation(
            alert: alert,
            countdown: countdown
        )
        
        return AlarmAttributes<GoodSleepAlarmMetadata>(
            presentation: presentation,
            metadata: GoodSleepAlarmMetadata(),
            tintColor: accentGold
        )
    }
    
    @available(iOS 26.0, *)
    private func observeAlarmUpdates() {
        Task {
            var wasAlerting = false
            for await alarms in AlarmManager.shared.alarmUpdates {
                let isAnyAlerting = alarms.contains { $0.state == .alerting }
                let isAnyCountdown = alarms.contains { $0.state == .countdown }
                
                if isAnyAlerting {
                    wasAlerting = true
                    if UIApplication.shared.applicationState == .active && !SoundManager.shared.isAlarmRinging {
                        SoundManager.shared.isShowingWakeUpPrompt = false
                        SoundManager.shared.isAlarmRinging = true
                    }
                } else if wasAlerting {
                    wasAlerting = false
                    if isAnyCountdown {
                        // 使用者點選了「稍後提醒」進入倒數，先關閉響鈴視窗
                        if SoundManager.shared.isAlarmRinging {
                            SoundManager.shared.stopAlarmMelody()
                        }
                    } else {
                        // 使用者完成了「滑動來停止」，切換顯示【起床打卡】與【略過】畫面
                        SoundManager.shared.transitionToWakeUpPrompt()
                        if UIApplication.shared.applicationState != .active {
                            NotificationManager.shared.postImmediateWakeCheckInNotification()
                        }
                    }
                }
            }
        }
    }
    #endif
}
