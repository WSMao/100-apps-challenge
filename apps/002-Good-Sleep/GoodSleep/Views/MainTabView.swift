import SwiftUI

/// 主分頁視圖 (OLED 暗夜導航)
struct MainTabView: View {
    @StateObject private var store = SleepStore()
    @ObservedObject private var soundManager = SoundManager.shared
    @State private var selectedTab: Int = 0
    
    init() {
        #if canImport(UIKit)
        // 設定 iOS 原生 TabBar 外觀為純深色
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(SleepTheme.background)
        
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(SleepTheme.textTertiary)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(SleepTheme.textTertiary)
        ]
        
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(SleepTheme.accent)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(SleepTheme.accent)
        ]
        
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
        #endif
    }
    
    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView(store: store)
                .tabItem {
                    Label("今日", systemImage: "moon.fill")
                }
                .tag(0)
            
            ChecklistView(store: store)
                .tabItem {
                    Label("避坑檢核", systemImage: "checklist")
                }
                .tag(1)
            
            AlarmView(store: store)
                .tabItem {
                    Label("智慧鬧鐘", systemImage: "alarm.fill")
                }
                .tag(2)
            
            HistoryView(store: store)
                .tabItem {
                    Label("睡眠趨勢", systemImage: "chart.bar.xaxis")
                }
                .tag(3)
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(isPresented: $soundManager.isAlarmRinging) {
            AlarmRingingView(store: store)
        }
    }
}
