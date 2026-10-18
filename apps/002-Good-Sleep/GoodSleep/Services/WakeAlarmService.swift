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
        // 先清除舊鬧鐘，避免重複排程
        cancelWakeAlarm()
        
        guard setting.isEnabled && setting.useInternalAlarm else { return }
        
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
                        countdownTitle: "💤 賴床倒數中..."
                    )
                    let relativeSchedule = Alarm.Schedule.Relative(
                        time: Alarm.Schedule.Relative.Time(hour: hour, minute: minute),
                        repeats: .never
                    )
                    let configuration = AlarmManager.AlarmConfiguration<GoodSleepAlarmMetadata>(
                        countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: 5 * 60),
                        schedule: .relative(relativeSchedule),
                        attributes: attributes,
                        sound: .named("alarm_melody.caf")
                    )
                    _ = try await AlarmManager.shared.schedule(id: wakeAlarmID, configuration: configuration)
                    return
                } catch {
                    print("AlarmKit 排程喚醒鬧鐘失敗，改用本地通知備援: \(error.localizedDescription)")
                }
            }
        }
        #endif
        
        // 若不支援 iOS 26 AlarmKit 或使用者拒絕權限，退回 Time-Sensitive 本地通知
        NotificationManager.shared.scheduleFallbackWakeNotification(setting: setting)
    }
    
    // MARK: - 5 秒後模擬響鈴測試 (鎖屏與靜音突破測試)
    
    func scheduleTestAlarmIn5Seconds() async {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            try? AlarmManager.shared.cancel(id: testAlarmID)
            let granted = await requestAuthorizationIfNeeded()
            if granted {
                do {
                    let attributes = makeAlarmAttributes(
                        alertTitle: "☀️ [測試] 好好睡覺鬧鐘響起！",
                        countdownTitle: "⏰ 測試鬧鐘倒數中..."
                    )
                    let configuration = AlarmManager.AlarmConfiguration<GoodSleepAlarmMetadata>.timer(
                        duration: 5,
                        attributes: attributes,
                        sound: .named("alarm_melody.caf")
                    )
                    _ = try await AlarmManager.shared.schedule(id: testAlarmID, configuration: configuration)
                    return
                } catch {
                    print("AlarmKit 測試鬧鐘排程失敗，改用本地通知備援: \(error.localizedDescription)")
                }
            }
        }
        #endif
        
        NotificationManager.shared.scheduleFallbackTestNotificationIn5Seconds()
    }
    
    // MARK: - 排程賴床鬧鐘
    
    func scheduleSnoozeAlarm(minutes: Int = 5) async {
        cancelWakeAlarm()
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let granted = await requestAuthorizationIfNeeded()
            if granted {
                do {
                    let attributes = makeAlarmAttributes(
                        alertTitle: "⏰ 賴床時間到囉！準備迎接今天吧",
                        countdownTitle: "💤 賴床倒數中..."
                    )
                    let configuration = AlarmManager.AlarmConfiguration<GoodSleepAlarmMetadata>.timer(
                        duration: TimeInterval(minutes * 60),
                        attributes: attributes,
                        sound: .named("alarm_melody.caf")
                    )
                    _ = try await AlarmManager.shared.schedule(id: snoozeAlarmID, configuration: configuration)
                    return
                } catch {
                    print("AlarmKit 賴床鬧鐘排程失敗，改用本地通知備援: \(error.localizedDescription)")
                }
            }
        }
        #endif
        
        NotificationManager.shared.scheduleFallbackSnoozeNotification(minutes: minutes)
    }
    
    // MARK: - 取消與停止鬧鐘
    
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
    
    // MARK: - 建立 AlarmKit 外觀與鎖屏互動配置
    
    #if canImport(AlarmKit)
    @available(iOS 26.0, *)
    private func makeAlarmAttributes(
        alertTitle: LocalizedStringResource,
        countdownTitle: LocalizedStringResource
    ) -> AlarmAttributes<GoodSleepAlarmMetadata> {
        let accentGold = Color(red: 0.90, green: 0.75, blue: 0.48)
        
        let stopButton = AlarmButton(
            text: "起床打卡",
            textColor: accentGold,
            systemImageName: "sun.max.fill"
        )
        
        let snoozeButton = AlarmButton(
            text: "賴床 5 分鐘",
            textColor: .white,
            systemImageName: "zzz"
        )
        
        let alert = AlarmPresentation.Alert(
            title: alertTitle,
            stopButton: stopButton,
            secondaryButton: snoozeButton,
            secondaryButtonBehavior: .countdown
        )
        
        let countdown = AlarmPresentation.Countdown(
            title: countdownTitle,
            pauseButton: nil
        )
        
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
            for await alarms in AlarmManager.shared.alarmUpdates {
                let isAnyAlerting = alarms.contains { $0.state == .alerting }
                if isAnyAlerting && UIApplication.shared.applicationState == .active {
                    if !SoundManager.shared.isAlarmRinging {
                        SoundManager.shared.isAlarmRinging = true
                    }
                }
            }
        }
    }
    #endif
}
