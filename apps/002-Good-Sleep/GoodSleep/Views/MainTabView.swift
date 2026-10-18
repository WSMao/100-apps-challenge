import SwiftUI

/// 主分頁視圖 (OLED 暗夜導航)
struct MainTabView: View {
    @StateObject private var store = SleepStore()
    @ObservedObject private var soundManager = SoundManager.shared
    @State private var selectedTab: Int = 0
    @State private var isShowingSleepStandby: Bool = false
    
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
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                TodayView(
                    store: store,
                    onNavigateToAlarm: {
                        selectedTab = 2
                    },
                    onOpenSleepStandby: {
                        withAnimation(.easeInOut(duration: 0.35)) {
                            isShowingSleepStandby = true
                        }
                    }
                )
                    .tabItem {
                        Image(systemName: "moon.fill")
                            .accessibilityLabel("今日")
                    }
                    .tag(0)
                
                ChecklistView(store: store)
                    .tabItem {
                        Image(systemName: "sparkles")
                            .accessibilityLabel("睡眠引導與避坑")
                    }
                    .tag(1)
                
                AlarmView(store: store)
                    .tabItem {
                        Image(systemName: "alarm.fill")
                            .accessibilityLabel("智慧鬧鐘")
                    }
                    .tag(2)
                
                HistoryView(store: store)
                    .tabItem {
                        Image(systemName: "chart.bar.xaxis")
                            .accessibilityLabel("睡眠趨勢")
                    }
                    .tag(3)
            }
            
            // 全域助眠聲景迷你播放器 (白噪音播放中常駐顯示於 TabBar 上方，停止時自動隱藏)
            if soundManager.currentSound != nil && !(isShowingSleepStandby && store.isSleeping) {
                MiniPlayerBar(soundManager: soundManager)
                    .padding(.horizontal, 14)
                    .padding(.bottom, 54)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            
            // 全螢幕「睡覺貓頭鷹」睡眠待機畫面
            if isShowingSleepStandby && store.isSleeping {
                SleepStandbyView(
                    store: store,
                    onMinimize: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            isShowingSleepStandby = false
                        }
                    },
                    onNavigateToGuidanceTab: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            isShowingSleepStandby = false
                            selectedTab = 1
                        }
                    }
                )
                .transition(.opacity)
                .zIndex(60)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: soundManager.currentSound != nil)
        .onAppear {
            if store.isSleeping {
                isShowingSleepStandby = true
            }
        }
        .onChange(of: store.isSleeping) { _, newValue in
            withAnimation(.easeInOut(duration: 0.35)) {
                isShowingSleepStandby = newValue
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(isPresented: $soundManager.isAlarmRinging) {
            AlarmRingingView(store: store)
        }
    }
}
