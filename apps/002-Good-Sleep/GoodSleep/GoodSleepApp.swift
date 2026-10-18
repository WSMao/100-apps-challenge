import SwiftUI

@main
struct GoodSleepApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(.dark)
        }
    }
}

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, @preconcurrency UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // 請求通知權限
        NotificationManager.shared.requestAuthorization()
        return true
    }
    
    // 當 App 在前台時收到通知仍照常顯示 Alert 與聲音
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let identifier = notification.request.identifier
        let userInfo = notification.request.content.userInfo
        let soundFileName = userInfo["soundFileName"] as? String
        let isGentleFadeIn = userInfo["isGentleFadeInEnabled"] as? Bool
        let isCompanionToAlarmKit = (userInfo["isCompanionToAlarmKit"] as? Bool) ?? false
        
        if identifier == "wake_alarm_checkin" {
            completionHandler([.banner, .list])
            return
        }
        
        if identifier.contains("wake_alarm") {
            if isCompanionToAlarmKit {
                // AlarmKit 已負責系統鬧鈴音訊，前景僅確保喚醒畫面已開啟
                if !SoundManager.shared.isAlarmRinging && !SoundManager.shared.isShowingWakeUpPrompt {
                    SoundManager.shared.isAlarmRinging = true
                }
                completionHandler([.banner, .list])
                return
            } else {
                // 備援模式：前台收到喚醒鬧鐘通知時，觸發循環鈴聲播放與全螢幕視窗
                SoundManager.shared.startAlarmMelody(
                    fileName: soundFileName,
                    loop: true,
                    gentleFadeIn: isGentleFadeIn
                )
            }
        }
        completionHandler([.banner, .sound, .badge, .list])
    }
    
    // 當使用者點擊鎖屏鬧鐘通知或操作按鈕進入 App
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        let userInfo = response.notification.request.content.userInfo
        let snoozeMinutes = (userInfo["snoozeMinutes"] as? Int) ?? 5
        let isSnoozeEnabled = (userInfo["isSnoozeEnabled"] as? Bool) ?? true
        let soundFileName = userInfo["soundFileName"] as? String
        let isGentleFadeIn = userInfo["isGentleFadeInEnabled"] as? Bool
        let isCompanionToAlarmKit = (userInfo["isCompanionToAlarmKit"] as? Bool) ?? false
        
        if response.actionIdentifier == NotificationManager.actionSnooze {
            SoundManager.shared.stopAlarmMelody()
            NotificationManager.shared.scheduleSnoozeAlarm(
                minutes: snoozeMinutes,
                isSnoozeEnabled: isSnoozeEnabled,
                soundFileName: soundFileName,
                isGentleFadeInEnabled: isGentleFadeIn
            )
        } else if response.actionIdentifier == NotificationManager.actionStop
                    || identifier == "wake_alarm_checkin"
                    || (identifier.contains("wake_alarm") && (isCompanionToAlarmKit || !WakeAlarmService.shared.isCurrentlyAlerting)) {
            // 使用者在鎖屏互動停止 AlarmKit 鬧鐘後，點選鎖屏上的起床通知進入 App 準備打卡
            NotificationManager.shared.stopAlertingAlarm()
            NotificationManager.shared.clearDeliveredWakeNotifications()
            SoundManager.shared.transitionToWakeUpPrompt()
        } else if identifier.contains("wake_alarm") {
            SoundManager.shared.startAlarmMelody(
                fileName: soundFileName,
                loop: true,
                gentleFadeIn: isGentleFadeIn
            )
        }
        completionHandler()
    }
}

