import SwiftUI

/// 智慧鬧鐘與睡眠排程設定視圖 (含客製化晨間鈴聲試聽與即時模擬測試)
struct AlarmView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject private var soundManager = SoundManager.shared
    @State private var setting: AlarmSetting
    @State private var showingSaveAlert: Bool = false
    @State private var showingTestAlert: Bool = false
    
    init(store: SleepStore) {
        self.store = store
        _setting = State(initialValue: store.alarmSetting)
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // 1. 鬧鐘總開關與週期摘要
                        cycleSummaryCard
                        
                        // 2. 就寢與喚醒時間調整器
                        timeAdjustmentSection
                        
                        // 3. 鬧鐘鈴聲與即時試聽測試
                        alarmSoundAndTestCard
                        
                        // 4. 入睡推播提醒設定
                        reminderSection
                        
                        // 5. iOS 睡眠專注/勿擾模式連動說明
                        dndGuidanceCard
                    }
                    .padding(20)
                }
            }
            .navigationTitle("智慧鬧鐘與排程")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("儲存") {
                        store.saveAlarmSetting(setting)
                        showingSaveAlert = true
                    }
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(SleepTheme.accent)
                }
            }
            .alert("排程已更新", isPresented: $showingSaveAlert) {
                Button("好", role: .cancel) { }
            } message: {
                Text("已同步更新就寢提醒與鬧鐘排程設定。")
            }
            .alert("已設定 5 秒後鬧鐘", isPresented: $showingTestAlert) {
                Button("了解", role: .cancel) { }
            } message: {
                Text("鬧鐘已排程於 5 秒後發出！\n您可現在將 App 退至背景或鎖定螢幕，體驗晨間清脆鐘琴鈴聲與推播效果。")
            }
        }
    }
    
    // MARK: - 週期摘要卡片
    private var cycleSummaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("預計睡眠時長")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.textSecondary)
                    Text("\(String(format: "%.1f", setting.plannedSleepHours)) 小時")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundColor(SleepTheme.accent)
                }
                Spacer()
                
                Toggle("", isOn: $setting.isEnabled)
                    .tint(SleepTheme.accent)
                    .labelsHidden()
            }
            
            Divider().background(SleepTheme.border)
            
            // 90 分鐘週期指示
            let cycles = setting.sleepCycles
            let fullCycles = Int(cycles)
            HStack(spacing: 8) {
                Image(systemName: "circle.circle.fill")
                    .font(.system(size: 14))
                    .foregroundColor(SleepTheme.success)
                
                Text("相當於約 \(fullCycles) 個完整的 90 分鐘睡眠週期")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(SleepTheme.textPrimary)
            }
        }
        .padding(18)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
    
    // MARK: - 時間調整區塊
    private var timeAdjustmentSection: some View {
        VStack(spacing: 12) {
            DatePicker(
                "目標就寢時間",
                selection: $setting.targetBedtime,
                displayedComponents: .hourAndMinute
            )
            .foregroundColor(SleepTheme.textPrimary)
            
            Divider().background(SleepTheme.border)
            
            DatePicker(
                "目標喚醒鬧鐘",
                selection: $setting.targetWakeTime,
                displayedComponents: .hourAndMinute
            )
            .foregroundColor(SleepTheme.textPrimary)
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    // MARK: - 鬧鐘鈴聲與即時測試卡片
    private var alarmSoundAndTestCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("喚醒鬧鐘鈴聲", systemImage: "music.note")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SleepTheme.calmTeal)
                Spacer()
                Text("晨間清脆鐘琴")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(SleepTheme.textSecondary)
            }
            
            Divider().background(SleepTheme.border)
            
            VStack(spacing: 10) {
                // 試聽按鈕
                Button {
                    if soundManager.isAlarmRinging {
                        soundManager.stopAlarmMelody()
                    } else {
                        soundManager.startAlarmMelody(loop: false)
                    }
                } label: {
                    HStack {
                        Image(systemName: soundManager.isAlarmRinging ? "stop.fill" : "play.fill")
                        Text(soundManager.isAlarmRinging ? "停止試聽" : "試聽喚醒鈴聲")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(hex: "0B0E14"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(SleepTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                
                // 5 秒後模擬響鈴按鈕
                Button {
                    NotificationManager.shared.scheduleTestAlarmIn5Seconds()
                    showingTestAlert = true
                } label: {
                    HStack {
                        Image(systemName: "timer")
                        Text("5 秒後模擬響鈴 (測試推播與鎖屏)")
                    }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(SleepTheme.calmTeal)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(SleepTheme.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    // MARK: - 入睡推播提醒
    private var reminderSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $setting.isReminderEnabled) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("入睡就寢提醒")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(SleepTheme.textPrimary)
                    Text("提前推播通知，預留 30 分鐘洗漱與遠離螢幕")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textTertiary)
                }
            }
            .tint(SleepTheme.accent)
            
            if setting.isReminderEnabled {
                Divider().background(SleepTheme.border)
                
                Stepper(value: $setting.bedtimeReminderMinutes, in: 15...60, step: 15) {
                    HStack {
                        Text("提前時間：")
                            .font(.system(size: 14))
                            .foregroundColor(SleepTheme.textSecondary)
                        Text("\(setting.bedtimeReminderMinutes) 分鐘")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SleepTheme.accent)
                    }
                }
            }
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    // MARK: - iOS 勿擾指引卡片
    private var dndGuidanceCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "moon.fill")
                    .font(.system(size: 14))
                    .foregroundColor(SleepTheme.lavender)
                Text("iOS 系統「睡眠專注模式」連動建議")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(SleepTheme.lavender)
            }
            
            Text("受限於 Apple iOS 安全沙盒規範，第三方 App 無法直接同步系統內建「時鐘」App 的私有鬧鐘列表與鈴聲。若您希望使用 Apple 原生鬧鐘（如雷達鈴聲），可一鍵點擊下方快速跳轉。")
                .font(.system(size: 12))
                .foregroundColor(SleepTheme.textSecondary)
                .lineSpacing(3)
            
            Button {
                if let url = URL(string: "clock-alarm://"), UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url)
                }
            } label: {
                HStack {
                    Image(systemName: "alarm")
                    Text("前往 iOS 原生「時鐘」設定鬧鐘")
                    Spacer()
                    Image(systemName: "arrow.up.forward.app")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(SleepTheme.accent)
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .background(SleepTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(16)
        .background(SleepTheme.surfaceSecondary.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
