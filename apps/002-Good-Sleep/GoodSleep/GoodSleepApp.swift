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
        if identifier.contains("wake_alarm") {
            // 前台收到喚醒鬧鐘通知時，觸發循環鈴聲播放與全螢幕視窗
            SoundManager.shared.startAlarmMelody()
        }
        completionHandler([.banner, .sound, .badge, .list])
    }
    
    // 當使用者點擊鬧鐘通知進入 App
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        if identifier.contains("wake_alarm") {
            SoundManager.shared.startAlarmMelody()
        }
        completionHandler()
    }
}

