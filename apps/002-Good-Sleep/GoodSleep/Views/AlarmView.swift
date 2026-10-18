import SwiftUI

/// 智慧鬧鐘與睡眠排程設定視圖 (支援三項自適應時間推算與雙軌並行鬧鐘架構)
struct AlarmView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject private var soundManager = SoundManager.shared
    
    @State private var setting: AlarmSetting
    @State private var durationMinutes: Int
    @State private var lastModified: [TimeField] = [.bedtime, .wakeTime]
    
    // 內嵌編輯時間狀態 (目標就寢時間、目標喚醒時間)
    enum InlineEditingField: Equatable {
        case bedtime
        case wakeTime
    }
    @State private var activeEditingField: InlineEditingField? = nil
    @State private var tempEditingDate: Date = Date()
    
    // 預計睡眠時長暫存狀態
    @State private var tempDurationMinutes: Int = 480
    
    // 彈窗狀態
    @State private var showingDurationSheet: Bool = false
    @State private var showingRingtoneSheet: Bool = false
    @State private var showingInternalAlarmInfo: Bool = false
    @State private var showingSystemAlarmInfo: Bool = false
    @State private var showingTestAlert: Bool = false
    
    private let shortcutICloudURL = URL(string: "https://www.icloud.com/shortcuts/d6142096f8c44c07820f9b0cac2b34a9")!
    
    enum TimeField: Equatable {
        case duration
        case bedtime
        case wakeTime
    }
    
    init(store: SleepStore) {
        self.store = store
        let currentSetting = store.alarmSetting
        _setting = State(initialValue: currentSetting)
        _durationMinutes = State(initialValue: currentSetting.plannedSleepMinutes)
        _tempDurationMinutes = State(initialValue: currentSetting.plannedSleepMinutes)
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // 鬧鐘主開關
                        masterToggleCard
                        
                        // 區塊 1：三合一自適應作息區塊（預計睡眠時長、目標就寢時間、目標喚醒時間）
                        unifiedScheduleSection
                        
                        // 區塊 2：雙軌鬧鐘模式（可複選：內建鬧鐘、系統鬧鐘）
                        dualTrackAlarmSection
                        
                        // 區塊 3：入睡推播提醒設定
                        reminderSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .onChange(of: setting) { newSetting in
                store.saveAlarmSetting(newSetting)
            }
            .sheet(isPresented: $showingDurationSheet) {
                durationPickerSheet
            }
            .sheet(isPresented: $showingRingtoneSheet) {
                ringtoneSettingSheet
            }
            .sheet(isPresented: $showingInternalAlarmInfo) {
                alarmInfoSheet(
                    title: "【內建鬧鐘】運作說明",
                    icon: "app.badge.checkmark",
                    badgeColor: SleepTheme.accent,
                    features: [
                        ("Apple 原生 AlarmKit 系統級喚醒", "於 iOS 26+ 採用 Apple 最新 AlarmKit 鬧鐘框架，由 iOS 系統底層守護排程，就算將 App 從背景滑掉或鎖定螢幕，依然準時在鎖屏全螢幕響起。"),
                        ("突破靜音模式與專注勿擾", "具備系統鬧鐘同等級權限，即使手機切至靜音模式或開啟睡眠/勿擾模式，仍可強制發出「晨間清脆鐘琴」喚醒鈴聲。"),
                        ("零跳轉沉浸體驗", "100% 留在 GoodSleep App 內完成設定，支援鎖屏直接點擊「起床打卡」或「賴床 5 分鐘」倒數。")
                    ]
                )
            }
            .sheet(isPresented: $showingSystemAlarmInfo) {
                alarmInfoSheet(
                    title: "【系統鬧鐘】運作說明",
                    icon: "clock.badge.checkmark.fill",
                    badgeColor: SleepTheme.calmTeal,
                    features: [
                        ("100% 絕對響鈴", "透過 Apple 官方「捷徑」將目標時間同步至 iOS 原生「時鐘」App，享有最高系統硬體級響鈴優先權。"),
                        ("穿透靜音開關與勿擾", "即使手機撥至實體靜音開關、開啟睡眠專注模式或螢幕鎖定休眠，依然保證以全音量準時響鈴。"),
                        ("零額外耗電與自動秒回", "依賴 iOS 晶片定時唤醒機制，完全不消耗手機多餘電量。且透過官方預設捷徑，設定時於 0.5 秒內全自動跳回「好好睡覺」！")
                    ]
                )
            }
            .alert("已排程 5 秒後模擬響鈴", isPresented: $showingTestAlert) {
                Button("了解", role: .cancel) { }
            } message: {
                Text("鬧鐘已透過 AlarmKit 排程於 5 秒後發出！\n您可現在將 App 退至背景、滑掉或鎖定螢幕，測試系統級鎖屏全螢幕響鈴效果。")
            }
        }
    }
    
    // MARK: - 總開關卡片
    private var masterToggleCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("鬧鐘與睡眠排程總開關")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                Text(setting.isEnabled ? "排程啟用中，將於設定時間守護作息" : "排程已關閉")
                    .font(.system(size: 12))
                    .foregroundColor(setting.isEnabled ? SleepTheme.accent : SleepTheme.textTertiary)
            }
            Spacer()
            Toggle("", isOn: $setting.isEnabled)
                .tint(SleepTheme.accent)
                .labelsHidden()
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    // MARK: - 區塊 1：三合一自適應作息區塊
    private var unifiedScheduleSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("睡眠作息與目標時長")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.textSecondary)
                Spacer()
                Text("三者自適應連動")
                    .font(.system(size: 11))
                    .foregroundColor(SleepTheme.calmTeal)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(SleepTheme.calmTeal.opacity(0.12))
                    .clipShape(Capsule())
            }
            
            VStack(spacing: 0) {
                // 1. 預計睡眠時長 (點選可調整幾小時、幾分鐘)
                Button {
                    tempDurationMinutes = durationMinutes
                    showingDurationSheet = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "hourglass")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(SleepTheme.accent)
                            .frame(width: 24)
                        
                        VStack(alignment: .leading, spacing: 3) {
                            Text("預計睡眠時長")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(SleepTheme.textPrimary)
                            Text("約 \(String(format: "%.1f", Double(durationMinutes)/90.0)) 個 90 分鐘生理週期")
                                .font(.system(size: 11))
                                .foregroundColor(SleepTheme.textSecondary)
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 6) {
                            Text(formatDuration(durationMinutes))
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(SleepTheme.accent)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                    }
                    .padding(16)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                
                Divider()
                    .background(SleepTheme.border)
                    .padding(.horizontal, 16)
                
                // 2. 目標就寢時間 (點選展開滾輪選擇框，含確定/取消按鈕)
                VStack(spacing: 0) {
                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            if activeEditingField == .bedtime {
                                activeEditingField = nil
                            } else {
                                tempEditingDate = setting.targetBedtime
                                activeEditingField = .bedtime
                            }
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "moon.stars.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(SleepTheme.lavender)
                                .frame(width: 24)
                            
                            Text("目標就寢時間")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(SleepTheme.textPrimary)
                            
                            Spacer()
                            
                            Text(timeFormatter.string(from: setting.targetBedtime))
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(activeEditingField == .bedtime ? SleepTheme.accent : SleepTheme.textPrimary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .fill(activeEditingField == .bedtime ? SleepTheme.accent.opacity(0.18) : SleepTheme.surfaceSecondary)
                                )
                        }
                        .padding(16)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    
                    if activeEditingField == .bedtime {
                        VStack(spacing: 12) {
                            DatePicker(
                                "",
                                selection: $tempEditingDate,
                                displayedComponents: .hourAndMinute
                            )
                            .datePickerStyle(.wheel)
                            .labelsHidden()
                            .frame(height: 135)
                            
                            // 【確定】與【取消】按鈕 (按確定保存，按取消恢復先前設定並跳出)
                            HStack(spacing: 12) {
                                Button {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        activeEditingField = nil
                                    }
                                } label: {
                                    Text("取消")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(SleepTheme.textSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(SleepTheme.surfaceSecondary)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                
                                Button {
                                    setting.targetBedtime = tempEditingDate
                                    userDidModify(.bedtime)
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        activeEditingField = nil
                                    }
                                } label: {
                                    Text("確定")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(hex: "0B0E14"))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(SleepTheme.accent)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                
                Divider()
                    .background(SleepTheme.border)
                    .padding(.horizontal, 16)
                
                // 3. 目標喚醒時間 (點選展開滾輪選擇框，含確定/取消按鈕)
                VStack(spacing: 0) {
                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            if activeEditingField == .wakeTime {
                                activeEditingField = nil
                            } else {
                                tempEditingDate = setting.targetWakeTime
                                activeEditingField = .wakeTime
                            }
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(SleepTheme.calmTeal)
                                .frame(width: 24)
                            
                            Text("目標喚醒時間")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(SleepTheme.textPrimary)
                            
                            Spacer()
                            
                            Text(timeFormatter.string(from: setting.targetWakeTime))
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(activeEditingField == .wakeTime ? SleepTheme.calmTeal : SleepTheme.textPrimary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .fill(activeEditingField == .wakeTime ? SleepTheme.calmTeal.opacity(0.18) : SleepTheme.surfaceSecondary)
                                )
                        }
                        .padding(16)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    
                    if activeEditingField == .wakeTime {
                        VStack(spacing: 12) {
                            DatePicker(
                                "",
                                selection: $tempEditingDate,
                                displayedComponents: .hourAndMinute
                            )
                            .datePickerStyle(.wheel)
                            .labelsHidden()
                            .frame(height: 135)
                            
                            // 【確定】與【取消】按鈕 (按確定保存，按取消恢復先前設定並跳出)
                            HStack(spacing: 12) {
                                Button {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        activeEditingField = nil
                                    }
                                } label: {
                                    Text("取消")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(SleepTheme.textSecondary)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(SleepTheme.surfaceSecondary)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                
                                Button {
                                    setting.targetWakeTime = tempEditingDate
                                    userDidModify(.wakeTime)
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        activeEditingField = nil
                                    }
                                } label: {
                                    Text("確定")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(Color(hex: "0B0E14"))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 9)
                                        .background(SleepTheme.accent)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
            }
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            
            Text("💡 調整任兩項數值，系統將自動推算並動態校正第三項內容。")
                .font(.system(size: 11))
                .foregroundColor(SleepTheme.textTertiary)
                .padding(.horizontal, 4)
        }
    }
    
    // MARK: - 區塊 2：雙軌鬧鐘模式區塊 (可複選)
    private var dualTrackAlarmSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("鬧鐘喚醒模式 (可複選)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.textSecondary)
                Spacer()
                Text("雙軌並行")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(SleepTheme.accent)
            }
            
            VStack(spacing: 0) {
                // 選項 1：內建鬧鐘
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Button {
                            setting.useInternalAlarm.toggle()
                        } label: {
                            Image(systemName: setting.useInternalAlarm ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 20))
                                .foregroundColor(setting.useInternalAlarm ? SleepTheme.accent : SleepTheme.textTertiary)
                        }
                        .buttonStyle(.plain)
                        
                        Text("內建鬧鐘")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(SleepTheme.textPrimary)
                        
                        Spacer()
                        
                        // 說明按鈕 i
                        Button {
                            showingInternalAlarmInfo = true
                        } label: {
                            Image(systemName: "info.circle")
                                .font(.system(size: 17))
                                .foregroundColor(SleepTheme.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                    
                    // 底下小字：設定鬧鈴（調整前後間距）
                    Button {
                        showingRingtoneSheet = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "music.note")
                                .font(.system(size: 11))
                            Text("設定鬧鈴：晨間清脆鐘琴 ▾")
                                .font(.system(size: 12, weight: .medium))
                        }
                        .foregroundColor(SleepTheme.accent)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)
                    .padding(.bottom, 2)
                    .padding(.leading, 32)
                }
                .padding(16)
                
                Divider()
                    .background(SleepTheme.border)
                    .padding(.horizontal, 16)
                
                // 選項 2：系統鬧鐘
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        Button {
                            setting.useSystemAlarm.toggle()
                        } label: {
                            Image(systemName: setting.useSystemAlarm ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 20))
                                .foregroundColor(setting.useSystemAlarm ? SleepTheme.calmTeal : SleepTheme.textTertiary)
                        }
                        .buttonStyle(.plain)
                        
                        Text("系統鬧鐘")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(SleepTheme.textPrimary)
                        
                        Spacer()
                        
                        // 說明按鈕 i
                        Button {
                            showingSystemAlarmInfo = true
                        } label: {
                            Image(systemName: "info.circle")
                                .font(.system(size: 17))
                                .foregroundColor(SleepTheme.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                    
                    // 當勾選系統鬧鐘時，顯示官方捷徑安裝連結
                    if setting.useSystemAlarm {
                        Button {
                            UIApplication.shared.open(shortcutICloudURL)
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 11))
                                Text("尚未安裝「GoodSleep 鬧鐘捷徑」？點此獲取")
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .foregroundColor(SleepTheme.calmTeal)
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 2)
                        .padding(.leading, 32)
                    }
                }
                .padding(16)
            }
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
    
    // MARK: - 區塊 3：入睡推播提醒
    private var reminderSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $setting.isReminderEnabled) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("入睡就寢提醒")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(SleepTheme.textPrimary)
                    Text("提前推播通知，預留放鬆洗漱與遠離藍光時間")
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
    
    // MARK: - 預計睡眠時長調整彈窗 (以 1 分鐘為單位)
    private var durationPickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // 頂部時長預覽
                VStack(spacing: 6) {
                    Text(formatDuration(tempDurationMinutes))
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundColor(SleepTheme.accent)
                    
                    Text("約相當於 \(String(format: "%.1f", Double(tempDurationMinutes)/90.0)) 個 90 分鐘睡眠週期")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                .padding(.top, 20)
                
                // 滾輪選擇器 (小時與以 1 分鐘為基礎單位之分鐘)
                HStack(spacing: 20) {
                    // 小時滾輪
                    HStack {
                        Picker("小時", selection: Binding(
                            get: { tempDurationMinutes / 60 },
                            set: { newH in
                                let m = tempDurationMinutes % 60
                                tempDurationMinutes = newH * 60 + m
                            }
                        )) {
                            ForEach(3...14, id: \.self) { h in
                                Text("\(h)").tag(h)
                                    .foregroundColor(SleepTheme.textPrimary)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(width: 80)
                        
                        Text("小時")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(SleepTheme.textSecondary)
                    }
                    
                    // 分鐘滾輪 (以 1 分鐘為單位：0...59)
                    HStack {
                        Picker("分鐘", selection: Binding(
                            get: { tempDurationMinutes % 60 },
                            set: { newM in
                                let h = tempDurationMinutes / 60
                                tempDurationMinutes = h * 60 + newM
                            }
                        )) {
                            ForEach(0...59, id: \.self) { m in
                                Text(String(format: "%02d", m)).tag(m)
                                    .foregroundColor(SleepTheme.textPrimary)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(width: 80)
                        
                        Text("分鐘")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(SleepTheme.textSecondary)
                    }
                }
                .padding(.horizontal, 20)
                .background(SleepTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                
                // 快捷週期建議推薦
                VStack(alignment: .leading, spacing: 10) {
                    Text("科學推薦睡眠週期：")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(SleepTheme.textSecondary)
                    
                    HStack(spacing: 10) {
                        durationChip(label: "6 小時 (4 週期)", minutes: 360)
                        durationChip(label: "7.5 小時 (5 週期)", minutes: 450, isRecommended: true)
                        durationChip(label: "9 小時 (6 週期)", minutes: 540)
                    }
                }
                .padding(.horizontal, 20)
                
                Spacer()
            }
            .padding(20)
            .background(SleepTheme.background.ignoresSafeArea())
            .navigationTitle("設定預計睡眠時長")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("取消") {
                        showingDurationSheet = false
                    }
                    .foregroundColor(SleepTheme.textSecondary)
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Button("確定") {
                        durationMinutes = tempDurationMinutes
                        userDidModify(.duration)
                        showingDurationSheet = false
                    }
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(SleepTheme.accent)
                }
            }
        }
    }
    
    private func durationChip(label: String, minutes: Int, isRecommended: Bool = false) -> some View {
        Button {
            tempDurationMinutes = minutes
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            Text(label)
                .font(.system(size: 12, weight: tempDurationMinutes == minutes ? .bold : .medium))
                .foregroundColor(tempDurationMinutes == minutes ? Color(hex: "0B0E14") : (isRecommended ? SleepTheme.accent : SleepTheme.textPrimary))
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    tempDurationMinutes == minutes ? SleepTheme.accent : (isRecommended ? SleepTheme.accent.opacity(0.15) : SleepTheme.surfaceSecondary)
                )
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isRecommended && tempDurationMinutes != minutes ? SleepTheme.accent.opacity(0.4) : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - 設定鬧鈴彈窗
    private var ringtoneSettingSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "music.note.list")
                            .font(.system(size: 16))
                            .foregroundColor(SleepTheme.accent)
                        Text("喚醒鬧鈴")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(SleepTheme.textPrimary)
                    }
                    
                    Text("以低刺激、溫柔純淨的鐘琴頻率由弱至強漸進響起，保護清晨甦醒時的脆弱神經，避免被刺耳急促的傳統警報聲驚嚇。")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.textSecondary)
                        .lineSpacing(3)
                }
                .padding(16)
                .background(SleepTheme.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                
                // 鈴聲選項
                VStack(spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("晨間清脆鐘琴")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.textPrimary)
                            Text("官方舒緩音訊 • 專為自然喚醒設計")
                                .font(.system(size: 11))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(SleepTheme.accent)
                    }
                    .padding(16)
                    .background(SleepTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    
                    // 試聽按鈕
                    Button {
                        if soundManager.isAlarmRinging {
                            soundManager.stopAlarmMelody()
                        } else {
                            soundManager.startAlarmMelody(loop: false)
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: soundManager.isAlarmRinging ? "stop.fill" : "play.fill")
                            Text(soundManager.isAlarmRinging ? "停止試聽" : "試聽喚醒鈴聲")
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: "0B0E14"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(SleepTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    
                    // 5 秒後模擬響鈴按鈕
                    Button {
                        NotificationManager.shared.scheduleTestAlarmIn5Seconds()
                        showingTestAlert = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "timer")
                            Text("5 秒後模擬響鈴 (測試推播與鎖屏提醒)")
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.calmTeal)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                
                Spacer()
            }
            .padding(20)
            .background(SleepTheme.background.ignoresSafeArea())
            .navigationTitle("內建鬧鈴設定")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        if soundManager.isAlarmRinging {
                            soundManager.stopAlarmMelody()
                        }
                        showingRingtoneSheet = false
                    }
                    .foregroundColor(SleepTheme.accent)
                }
            }
        }
    }
    
    // MARK: - 鬧鐘說明通用彈窗
    private func alarmInfoSheet(title: String, icon: String, badgeColor: Color, features: [(String, String)]) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 10) {
                        Image(systemName: icon)
                            .font(.system(size: 22))
                            .foregroundColor(badgeColor)
                        Text(title)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(SleepTheme.textPrimary)
                    }
                    .padding(.top, 10)
                    
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(features, id: \.0) { item in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(badgeColor)
                                        .frame(width: 6, height: 6)
                                    Text(item.0)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundColor(SleepTheme.textPrimary)
                                }
                                Text(item.1)
                                    .font(.system(size: 13))
                                    .foregroundColor(SleepTheme.textSecondary)
                                    .lineSpacing(3)
                                    .padding(.leading, 12)
                            }
                            if item.0 != features.last?.0 {
                                Divider().background(SleepTheme.border)
                            }
                        }
                    }
                    .padding(16)
                    .background(SleepTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    
                    Spacer()
                }
                .padding(20)
            }
            .background(SleepTheme.background.ignoresSafeArea())
            .navigationTitle("鬧鐘機制說明")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("了解") {
                        showingInternalAlarmInfo = false
                        showingSystemAlarmInfo = false
                    }
                    .foregroundColor(SleepTheme.accent)
                }
            }
        }
    }
    
    // MARK: - 自適應連動邏輯
    private func userDidModify(_ field: TimeField) {
        // 1. 維持最後被手動調整的 2 個欄位
        if lastModified.last != field {
            if lastModified.contains(field) {
                lastModified.removeAll { $0 == field }
            } else if lastModified.count >= 2 {
                lastModified.removeFirst()
            }
            lastModified.append(field)
        }
        
        // 2. 找出未被修改的第 3 個欄位並動態更新
        let allFields: [TimeField] = [.duration, .bedtime, .wakeTime]
        guard let targetField = allFields.first(where: { !lastModified.contains($0) }) else { return }
        
        switch targetField {
        case .duration:
            durationMinutes = AlarmSetting.calculateDurationMinutes(bedtime: setting.targetBedtime, wakeTime: setting.targetWakeTime)
        case .bedtime:
            setting.targetBedtime = AlarmSetting.calculateBedtime(wakeTime: setting.targetWakeTime, durationMinutes: durationMinutes)
        case .wakeTime:
            setting.targetWakeTime = AlarmSetting.calculateWakeTime(bedtime: setting.targetBedtime, durationMinutes: durationMinutes)
        }
    }
    
    // MARK: - 呼叫系統捷徑
    private func triggerSystemAlarmShortcut() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        
        // 檢查捷徑 App
        if let checkUrl = URL(string: "shortcuts://"), !UIApplication.shared.canOpenURL(checkUrl) {
            UIApplication.shared.open(shortcutICloudURL)
            return
        }
        
        let timeString = timeFormatter.string(from: setting.targetWakeTime)
        let shortcutName = "GoodSleep鬧鐘"
        guard let encodedName = shortcutName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let encodedTime = timeString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return
        }
        
        let urlString = "shortcuts://run-shortcut?name=\(encodedName)&input=text&text=\(encodedTime)"
        if let url = URL(string: urlString) {
            UIApplication.shared.open(url) { success in
                if !success {
                    UIApplication.shared.open(shortcutICloudURL)
                }
            }
        }
    }
    
    private func formatDuration(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if m == 0 {
            return "\(h) 小時"
        } else {
            return "\(h) 小時 \(m) 分"
        }
    }
    
    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }
}
