import SwiftUI
import UniformTypeIdentifiers

/// 智慧鬧鐘與睡眠排程設定視圖 (支援三項自適應時間推算與 AlarmKit 系統級鬧鐘)
struct AlarmView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject private var soundManager = SoundManager.shared
    @ObservedObject private var ringtoneLibrary = RingtoneLibraryManager.shared
    
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
    @State private var showingTestAlert: Bool = false
    @State private var showingFileImporter: Bool = false
    @State private var importErrorMessage: String? = nil
    @State private var showingImportErrorAlert: Bool = false
    
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
                        // 鬧鐘排程總開關
                        masterToggleCard
                        
                        // 區塊 1：三合一自適應作息區塊（預計睡眠時長、目標就寢時間、目標喚醒時間）
                        unifiedScheduleSection
                        
                        // 區塊 2：鬧鐘進階設定（循環鬧鐘、稍後提醒、設定鬧鈴）
                        alarmOptionsSection
                        
                        // 區塊 3：入睡前提醒設定
                        reminderSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .onChange(of: setting) { newSetting in
                if store.alarmSetting != newSetting {
                    store.saveAlarmSetting(newSetting)
                }
            }
            .onChange(of: store.alarmSetting) { updatedSetting in
                if setting != updatedSetting {
                    setting = updatedSetting
                }
            }
            .sheet(isPresented: $showingDurationSheet) {
                durationPickerSheet
            }
            .sheet(isPresented: $showingRingtoneSheet, onDismiss: {
                soundManager.stopRingtonePreview()
            }) {
                ringtoneSettingSheet
            }
            .alert("已排程 5 秒後模擬響鈴", isPresented: $showingTestAlert) {
                Button("了解", role: .cancel) { }
            } message: {
                Text("鬧鐘已使用「\(setting.selectedRingtoneTitle)」排程於 5 秒後發出！\n您可現在將 App 退至背景或鎖定螢幕，測試系統級鎖屏循環響鈴效果。")
            }
        }
    }
    
    // MARK: - 鬧鐘排程總開關卡片
    private var masterToggleCard: some View {
        HStack {
            Text("鬧鐘排程總開關")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(SleepTheme.textPrimary)
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
    
    // MARK: - 區塊 2：鬧鐘選項區塊（循環鬧鐘、稍後提醒、設定鬧鈴）
    private var alarmOptionsSection: some View {
        VStack(spacing: 0) {
            // 1. 循環鬧鐘開關
            Toggle(isOn: $setting.isRepeatingAlarm) {
                Text("循環鬧鐘")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(SleepTheme.textPrimary)
            }
            .tint(SleepTheme.accent)
            .padding(16)
            
            Divider()
                .background(SleepTheme.border)
                .padding(.horizontal, 16)
            
            // 2. 稍後提醒開關與快速時間設定 (1~30 分鐘滑桿)
            VStack(alignment: .leading, spacing: 12) {
                Toggle(isOn: $setting.isSnoozeEnabled) {
                    Text("稍後提醒")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(SleepTheme.textPrimary)
                }
                .tint(SleepTheme.accent)
                
                if setting.isSnoozeEnabled {
                    Divider().background(SleepTheme.border)
                    
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("間隔時間")
                                .font(.system(size: 14))
                                .foregroundColor(SleepTheme.textSecondary)
                            Spacer()
                            Text("\(setting.snoozeDurationMinutes) 分鐘")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(SleepTheme.accent)
                        }
                        
                        // 快速拖曳滑桿 (1 ~ 30 分鐘)
                        Slider(
                            value: Binding(
                                get: { Double(setting.snoozeDurationMinutes) },
                                set: { newVal in
                                    let rounded = Int(newVal.rounded())
                                    if setting.snoozeDurationMinutes != rounded {
                                        setting.snoozeDurationMinutes = rounded
                                    }
                                }
                            ),
                            in: 1...30,
                            step: 1
                        )
                        .tint(SleepTheme.accent)
                    }
                }
            }
            .padding(16)
            
            Divider()
                .background(SleepTheme.border)
                .padding(.horizontal, 16)
            
            // 3. 設定鬧鈴按鈕
            Button {
                showingRingtoneSheet = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "music.note")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(SleepTheme.accent)
                        .frame(width: 22)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("設定鬧鈴")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(SleepTheme.textPrimary)
                        if setting.isGentleFadeInEnabled {
                            Text("15 秒漸進喚醒 • 無縫重複播放")
                                .font(.system(size: 11))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 6) {
                        Text(setting.selectedRingtoneTitle)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(SleepTheme.accent)
                            .lineLimit(1)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(SleepTheme.textTertiary)
                    }
                }
                .padding(16)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    // MARK: - 區塊 3：入睡前提醒
    private var reminderSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $setting.isReminderEnabled) {
                Text("入睡前提醒")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(SleepTheme.textPrimary)
            }
            .tint(SleepTheme.accent)
            
            if setting.isReminderEnabled {
                Divider().background(SleepTheme.border)
                
                Stepper(value: $setting.bedtimeReminderMinutes, in: 5...60, step: 5) {
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
    
    // MARK: - 設定鬧鈴彈窗（內建 5 款無縫循環 .caf 鈴聲 + 自訂音樂匯入轉檔 + 15 秒漸進喚醒）
    private var ringtoneSettingSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // 1. 漸進式溫和喚醒與重複循環說明卡片
                    VStack(alignment: .leading, spacing: 12) {
                        Toggle(isOn: $setting.isGentleFadeInEnabled) {
                            HStack(spacing: 10) {
                                Image(systemName: "speaker.wave.2.bubble.fill")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(SleepTheme.accent)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("漸進式溫和喚醒 (Fade-in)")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundColor(SleepTheme.textPrimary)
                                    Text("15 秒內音量由 8% 平滑爬升至 100%，並持續重複循環播放")
                                        .font(.system(size: 11))
                                        .foregroundColor(SleepTheme.textSecondary)
                                }
                            }
                        }
                        .tint(SleepTheme.accent)
                    }
                    .padding(16)
                    .background(SleepTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(SleepTheme.border.opacity(0.6), lineWidth: 1)
                    )
                    
                    // 2. 官方內建舒緩喚醒鈴聲（5 款無縫循環 .caf）
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Label("內建舒緩喚醒鈴聲", systemImage: "music.quarternote.3")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(SleepTheme.textSecondary)
                            Spacer()
                            Text("Apple 原生 .caf 無縫循環")
                                .font(.system(size: 11))
                                .foregroundColor(SleepTheme.calmTeal)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(SleepTheme.calmTeal.opacity(0.12))
                                .clipShape(Capsule())
                        }
                        
                        VStack(spacing: 8) {
                            ForEach(BuiltInRingtone.allCases) { item in
                                let isSelected = (setting.selectedRingtoneID == item.id)
                                let isPreviewing = (soundManager.previewingRingtoneID == item.id)
                                
                                HStack(spacing: 12) {
                                    // 左側選取區域
                                    Button {
                                        selectBuiltInRingtone(item)
                                    } label: {
                                        HStack(spacing: 12) {
                                            ZStack {
                                                Circle()
                                                    .fill(isSelected ? SleepTheme.accent.opacity(0.18) : SleepTheme.surfaceSecondary)
                                                    .frame(width: 38, height: 38)
                                                Image(systemName: item.icon)
                                                    .font(.system(size: 15, weight: .semibold))
                                                    .foregroundColor(isSelected ? SleepTheme.accent : SleepTheme.textSecondary)
                                            }
                                            
                                            VStack(alignment: .leading, spacing: 3) {
                                                HStack(spacing: 6) {
                                                    Text(item.title)
                                                        .font(.system(size: 15, weight: .semibold))
                                                        .foregroundColor(isSelected ? SleepTheme.accent : SleepTheme.textPrimary)
                                                    if isSelected {
                                                        Image(systemName: "checkmark.circle.fill")
                                                            .font(.system(size: 13))
                                                            .foregroundColor(SleepTheme.accent)
                                                    }
                                                }
                                                Text(item.subtitle)
                                                    .font(.system(size: 11))
                                                    .foregroundColor(SleepTheme.textTertiary)
                                                    .lineLimit(1)
                                            }
                                            Spacer()
                                        }
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    
                                    // 右側獨立試聽/停止按鈕
                                    Button {
                                        selectBuiltInRingtone(item, togglePreview: false)
                                        soundManager.toggleRingtonePreview(
                                            id: item.id,
                                            fileName: item.fileName,
                                            gentleFadeIn: setting.isGentleFadeInEnabled
                                        )
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: isPreviewing ? "stop.fill" : "play.fill")
                                                .font(.system(size: 11, weight: .bold))
                                            Text(isPreviewing ? "停止" : "試聽")
                                                .font(.system(size: 12, weight: .semibold))
                                        }
                                        .foregroundColor(isPreviewing ? Color(hex: "0B0E14") : SleepTheme.accent)
                                        .padding(.horizontal, 11)
                                        .padding(.vertical, 7)
                                        .background(isPreviewing ? SleepTheme.accent : SleepTheme.accent.opacity(0.14))
                                        .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(12)
                                .background(isSelected ? SleepTheme.accent.opacity(0.08) : SleepTheme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(isSelected ? SleepTheme.accent.opacity(0.45) : SleepTheme.border.opacity(0.5), lineWidth: 1)
                                )
                            }
                        }
                    }
                    
                    // 3. 使用者自訂匯入音樂區塊
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Label("我的自訂音樂", systemImage: "folder.fill.badge.plus")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(SleepTheme.textSecondary)
                            Spacer()
                            Text("支援 MP3 / M4A / WAV / CAF")
                                .font(.system(size: 11))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                        
                        // 匯入音樂按鈕
                        Button {
                            soundManager.stopRingtonePreview()
                            showingFileImporter = true
                        } label: {
                            HStack(spacing: 8) {
                                if ringtoneLibrary.isImporting {
                                    ProgressView()
                                        .tint(Color(hex: "0B0E14"))
                                    Text("正在轉檔為無縫循環 .caf 格式...")
                                } else {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 16, weight: .bold))
                                    Text("從「檔案 / iCloud」匯入自訂音樂")
                                }
                            }
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(Color(hex: "0B0E14"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(
                                LinearGradient(
                                    colors: [SleepTheme.moonGlow, SleepTheme.accent],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(ringtoneLibrary.isImporting)
                        
                        // 已匯入的自訂音樂清單
                        if ringtoneLibrary.customRingtones.isEmpty {
                            HStack(spacing: 10) {
                                Image(systemName: "waveform.badge.plus")
                                    .font(.system(size: 18))
                                    .foregroundColor(SleepTheme.textTertiary)
                                Text("尚未加入自訂音樂。您可將喜歡的輕音樂、環境音或「語音備忘錄」存至手機「檔案」App，一鍵匯入即可作為鎖屏循環鬧鈴。")
                                    .font(.system(size: 12))
                                    .foregroundColor(SleepTheme.textSecondary)
                                    .lineSpacing(3)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(SleepTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        } else {
                            VStack(spacing: 8) {
                                ForEach(ringtoneLibrary.customRingtones) { customItem in
                                    let isSelected = (setting.selectedRingtoneID == customItem.id)
                                    let isPreviewing = (soundManager.previewingRingtoneID == customItem.id)
                                    
                                    HStack(spacing: 12) {
                                        Button {
                                            selectCustomRingtone(customItem)
                                        } label: {
                                            HStack(spacing: 12) {
                                                ZStack {
                                                    Circle()
                                                        .fill(isSelected ? SleepTheme.calmTeal.opacity(0.20) : SleepTheme.surfaceSecondary)
                                                        .frame(width: 38, height: 38)
                                                    Image(systemName: "music.note")
                                                        .font(.system(size: 15, weight: .semibold))
                                                        .foregroundColor(isSelected ? SleepTheme.calmTeal : SleepTheme.textSecondary)
                                                }
                                                
                                                VStack(alignment: .leading, spacing: 3) {
                                                    HStack(spacing: 6) {
                                                        Text(customItem.displayName)
                                                            .font(.system(size: 14, weight: .semibold))
                                                            .foregroundColor(isSelected ? SleepTheme.accent : SleepTheme.textPrimary)
                                                            .lineLimit(1)
                                                        if isSelected {
                                                            Image(systemName: "checkmark.circle.fill")
                                                                .font(.system(size: 13))
                                                                .foregroundColor(SleepTheme.accent)
                                                        }
                                                    }
                                                    Text("自訂 .caf 循環音軌 • \(Int(customItem.durationSeconds.rounded())) 秒片段")
                                                        .font(.system(size: 11))
                                                        .foregroundColor(SleepTheme.textTertiary)
                                                }
                                                Spacer()
                                            }
                                            .contentShape(Rectangle())
                                        }
                                        .buttonStyle(.plain)
                                        
                                        // 試聽按鈕
                                        Button {
                                            selectCustomRingtone(customItem, togglePreview: false)
                                            soundManager.toggleRingtonePreview(
                                                id: customItem.id,
                                                fileName: customItem.fileName,
                                                gentleFadeIn: setting.isGentleFadeInEnabled
                                            )
                                        } label: {
                                            HStack(spacing: 4) {
                                                Image(systemName: isPreviewing ? "stop.fill" : "play.fill")
                                                    .font(.system(size: 11, weight: .bold))
                                                Text(isPreviewing ? "停止" : "試聽")
                                                    .font(.system(size: 12, weight: .semibold))
                                            }
                                            .foregroundColor(isPreviewing ? Color(hex: "0B0E14") : SleepTheme.accent)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 7)
                                            .background(isPreviewing ? SleepTheme.accent : SleepTheme.accent.opacity(0.14))
                                            .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                        
                                        // 刪除按鈕
                                        Button {
                                            deleteCustomRingtone(customItem)
                                        } label: {
                                            Image(systemName: "trash")
                                                .font(.system(size: 13, weight: .medium))
                                                .foregroundColor(SleepTheme.warning)
                                                .frame(width: 30, height: 30)
                                                .background(SleepTheme.warning.opacity(0.12))
                                                .clipShape(Circle())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .padding(12)
                                    .background(isSelected ? SleepTheme.accent.opacity(0.08) : SleepTheme.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .stroke(isSelected ? SleepTheme.accent.opacity(0.45) : SleepTheme.border.opacity(0.5), lineWidth: 1)
                                    )
                                }
                            }
                        }
                    }
                    
                    // 4. 5 秒後模擬響鈴按鈕（測試系統鎖屏與當前選定鈴聲）
                    VStack(alignment: .leading, spacing: 8) {
                        Button {
                            soundManager.stopRingtonePreview()
                            NotificationManager.shared.scheduleTestAlarmIn5Seconds(setting: setting)
                            showingTestAlert = true
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "timer")
                                Text("5 秒後模擬響鈴（測試「\(setting.selectedRingtoneTitle)」鎖屏提醒）")
                                    .lineLimit(1)
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(SleepTheme.calmTeal)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(SleepTheme.surfaceSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(SleepTheme.calmTeal.opacity(0.3), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        
                        Text("💡 所有內建與匯入音樂皆自動轉為 Apple Core Audio (.caf) 無縫循環格式並儲存於系統鬧鈴沙盒，即使鎖定螢幕或開啟靜音模式都能重複播放。")
                            .font(.system(size: 11))
                            .foregroundColor(SleepTheme.textTertiary)
                            .lineSpacing(2)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(20)
            }
            .background(SleepTheme.background.ignoresSafeArea())
            .navigationTitle("設定鬧鈴與自訂音樂")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        soundManager.stopRingtonePreview()
                        showingRingtoneSheet = false
                    }
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(SleepTheme.accent)
                }
            }
            .fileImporter(
                isPresented: $showingFileImporter,
                allowedContentTypes: [.audio, .mp3, .mpeg4Audio, .wav, .aiff],
                allowsMultipleSelection: false
            ) { result in
                handleFileImportResult(result)
            }
            .alert("匯入音樂失敗", isPresented: $showingImportErrorAlert) {
                Button("確定", role: .cancel) { }
            } message: {
                Text(importErrorMessage ?? "無法處理所選的音訊檔案。")
            }
        }
    }
    
    // MARK: - 鈴聲選取、匯入與刪除輔助方法
    
    private func selectBuiltInRingtone(_ item: BuiltInRingtone, togglePreview: Bool = true) {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        setting.selectedRingtoneID = item.id
        setting.selectedSoundFileName = item.fileName
        setting.selectedRingtoneTitle = item.title
        if togglePreview {
            soundManager.toggleRingtonePreview(
                id: item.id,
                fileName: item.fileName,
                gentleFadeIn: setting.isGentleFadeInEnabled
            )
        }
    }
    
    private func selectCustomRingtone(_ item: CustomRingtoneItem, togglePreview: Bool = true) {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        setting.selectedRingtoneID = item.id
        setting.selectedSoundFileName = item.fileName
        setting.selectedRingtoneTitle = item.displayName
        if togglePreview {
            soundManager.toggleRingtonePreview(
                id: item.id,
                fileName: item.fileName,
                gentleFadeIn: setting.isGentleFadeInEnabled
            )
        }
    }
    
    private func deleteCustomRingtone(_ item: CustomRingtoneItem) {
        if soundManager.previewingRingtoneID == item.id {
            soundManager.stopRingtonePreview()
        }
        ringtoneLibrary.deleteCustomRingtone(item)
        // 若刪除的剛好是當前選用的鈴聲，自動切回預設「晨間清脆鐘琴」
        if setting.selectedRingtoneID == item.id {
            let fallback = BuiltInRingtone.morningChime
            setting.selectedRingtoneID = fallback.id
            setting.selectedSoundFileName = fallback.fileName
            setting.selectedRingtoneTitle = fallback.title
        }
    }
    
    private func handleFileImportResult(_ result: Result<[URL], any Error>) {
        switch result {
        case .success(let urls):
            guard let firstURL = urls.first else { return }
            Task { @MainActor in
                do {
                    let importedItem = try await ringtoneLibrary.importCustomAudio(from: firstURL)
                    selectCustomRingtone(importedItem, togglePreview: true)
                } catch {
                    importErrorMessage = error.localizedDescription
                    showingImportErrorAlert = true
                }
            }
        case .failure(let error):
            importErrorMessage = error.localizedDescription
            showingImportErrorAlert = true
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
