import SwiftUI

/// 全螢幕「睡覺貓頭鷹」睡眠待機畫面
/// - 顯示較大字樣的鬧鐘響起時間，與較小字樣的「倒數 XX:XX」預計起床倒計時
/// - 中央呈現純 SwiftUI 睡覺貓頭鷹動畫，點擊貓頭鷹可展開/收合四合一功能選單：
///   「引導睡眠」、「即時紀錄」、「早起打卡」、「長按取消」
struct SleepStandbyView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject private var soundManager = SoundManager.shared
    
    var onMinimize: (() -> Void)? = nil
    var onNavigateToGuidanceTab: (() -> Void)? = nil
    
    // 點擊貓頭鷹切換展開的四合一選單狀態
    @State private var isMenuExpanded: Bool = false
    
    // 子功能彈窗狀態
    @State private var showingQuickGuidanceSheet: Bool = false
    @State private var showingInstantNoteModal: Bool = false
    @State private var showingMorningCheckInSheet: Bool = false
    
    // 即時紀錄輸入框狀態
    @State private var noteText: String = ""
    @State private var noteSavedToast: Bool = false
    
    // 長按取消進度狀態 (0.0 ~ 1.0)
    @State private var cancelHoldProgress: CGFloat = 0.0
    @State private var isPressingCancel: Bool = false
    @State private var cancelHoldTask: Task<Void, Never>? = nil
    
    // 5 分鐘 (300 秒) 無觸控自動調至最暗計時狀態
    private let autoDimTimeoutSeconds: Int = 300
    @State private var remainingDimSeconds: Int = 300
    @State private var isScreenDimmed: Bool = false
    @State private var savedBrightness: CGFloat = 0.5
    @State private var autoDimTask: Task<Void, Never>? = nil
    
    var body: some View {
        ZStack {
            // 1. 深邃暗夜 OLED 漸層背景
            SleepTheme.bedtimeGradient
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 2. 頂部輕量狀態列（入睡時間標記 + 最小化按鈕）
                topStatusBar
                    .padding(.horizontal, 22)
                    .padding(.top, 12)
                
                Spacer(minLength: 16)
                
                // 3. 鬧鐘響起時間（稍大字樣）與預計起床倒數計時（較小字樣「倒數 XX:XX」）
                TimelineView(.periodic(from: .now, by: 1.0)) { context in
                    alarmAndCountdownHeader(now: context.date)
                }
                .padding(.horizontal, 24)
                
                Spacer(minLength: 10)
                
                // 4. 中央熟睡貓頭鷹動畫（點擊觸發微互動並展開/收合四合一選單）
                VStack(spacing: 8) {
                    SleepingOwlView(isMenuExpanded: isMenuExpanded) {
                        withAnimation(.spring(response: 0.38, dampingFraction: 0.78)) {
                            isMenuExpanded.toggle()
                        }
                    }
                    
                    // 輕觸提示文字
                    Button {
                        withAnimation(.spring(response: 0.38, dampingFraction: 0.78)) {
                            isMenuExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: isMenuExpanded ? "chevron.down.circle" : "hand.tap")
                                .font(.system(size: 12))
                            Text(isMenuExpanded ? "輕觸貓頭鷹收起選單" : "輕觸貓頭鷹開啟睡眠選單")
                                .font(.system(size: 12, weight: .medium))
                        }
                        .foregroundColor(SleepTheme.textTertiary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                    }
                    .buttonStyle(.plain)
                }
                
                Spacer(minLength: 12)
                
                // 5. 點選貓頭鷹展開的「四合一功能選單」
                if isMenuExpanded {
                    owlActionMenu
                        .padding(.horizontal, 22)
                        .padding(.bottom, 26)
                        .transition(
                            .asymmetric(
                                insertion: .scale(scale: 0.92, anchor: .top).combined(with: .opacity),
                                removal: .scale(scale: 0.95, anchor: .top).combined(with: .opacity)
                            )
                        )
                } else {
                    // 未展開時保留底部空間與極簡祝眠語
                    Text("放下手機，跟隨貓頭鷹的 4-4 呼吸節奏安穩入眠")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textTertiary.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .padding(.bottom, 36)
                        .transition(.opacity)
                }
            }
            
            // 6. 「即時紀錄」浮動彈窗 (Instant Bedtime Note Modal)
            if showingInstantNoteModal {
                instantNoteModalOverlay
                    .zIndex(50)
            }
            
            // 7. 5 分鐘無觸控後的「極暗護眼遮罩」：點擊觸控螢幕時立即恢復原本亮度
            if isScreenDimmed {
                dimmedScreenOverlay
                    .zIndex(100)
                    .transition(.opacity)
            }
        }
        // 偵測畫面上的任何觸控操作：若未進入最暗狀態，任何觸控皆重置 5 分鐘倒數計時
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isScreenDimmed {
                        remainingDimSeconds = autoDimTimeoutSeconds
                    }
                }
        )
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showingQuickGuidanceSheet) {
            quickGuidanceSheet
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingMorningCheckInSheet) {
            EditSleepLogSheet(store: store, morningCheckInAt: Date())
        }
        .onAppear {
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = true
            if let screen = currentScreen {
                savedBrightness = max(0.15, screen.brightness)
            }
            #endif
            startAutoDimCountdown()
        }
        .onDisappear {
            stopCancelHoldTimer()
            stopAutoDimCountdown()
            restoreScreenBrightness(resetCountdown: false)
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
        .onChange(of: soundManager.isAlarmRinging) { _, isRinging in
            if isRinging {
                restoreScreenBrightness(resetCountdown: true)
            }
        }
    }
    
    // MARK: - 頂部狀態列
    
    private var topStatusBar: some View {
        HStack {
            // 入睡時間標記
            HStack(spacing: 6) {
                Circle()
                    .fill(SleepTheme.calmTeal)
                    .frame(width: 7, height: 7)
                if let bedtime = store.ongoingBedtime {
                    Text("已於 \(timeFormatter.string(from: bedtime)) 開始睡眠")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(SleepTheme.textSecondary)
                } else {
                    Text("睡眠守護進行中")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(SleepTheme.textSecondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(SleepTheme.surface.opacity(0.75))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(SleepTheme.border.opacity(0.6), lineWidth: 1)
            )
            
            Spacer()
            
            // 若白噪音播放中，顯示微音訊指示器
            if let currentSound = soundManager.currentSound, soundManager.isPlaying {
                Button {
                    showingQuickGuidanceSheet = true
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "waveform")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(SleepTheme.success)
                        Text(currentSound.rawValue)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(SleepTheme.textSecondary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(SleepTheme.surface.opacity(0.75))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            
            // 暫時收合回主畫面按鈕
            if let onMinimize {
                Button {
                    onMinimize()
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(SleepTheme.textTertiary)
                        .frame(width: 32, height: 32)
                        .background(SleepTheme.surface.opacity(0.65))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("暫時收合待機畫面")
            }
        }
    }
    
    // MARK: - 鬧鐘響起時間（大字）與倒數計時（小字「倒數 XX:XX」）
    
    private func alarmAndCountdownHeader(now: Date) -> some View {
        let alarmTimeStr = timeFormatter.string(from: store.alarmSetting.targetWakeTime)
        let countdownStr = countdownString(from: now, toWakeTime: store.alarmSetting.targetWakeTime)
        
        return VStack(spacing: 8) {
            // 鬧鐘小標籤
            HStack(spacing: 5) {
                Image(systemName: store.alarmSetting.isEnabled ? "bell.fill" : "bell.slash")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SleepTheme.accent)
                Text("預計鬧鐘響起")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(SleepTheme.textSecondary)
            }
            
            // 稍大字樣：顯示鬧鐘響起時間
            Text(alarmTimeStr)
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundColor(SleepTheme.moonGlow)
                .tracking(1.5)
                .shadow(color: SleepTheme.accent.opacity(0.22), radius: 10, x: 0, y: 4)
            
            // 較小字樣：顯示「倒數 XX:XX」距離預計起床時間的倒計時
            HStack(spacing: 6) {
                Image(systemName: "hourglass")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SleepTheme.calmTeal)
                Text("倒數 \(countdownStr)")
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundColor(SleepTheme.calmTeal)
                    .monospacedDigit()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(SleepTheme.calmTeal.opacity(0.12))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(SleepTheme.calmTeal.opacity(0.28), lineWidth: 1)
            )
            
            // 5 分鐘無觸控自動調至最暗計時顯示
            HStack(spacing: 5) {
                Image(systemName: "sun.min.fill")
                    .font(.system(size: 11))
                Text("無觸控自動最暗 \(dimCountdownFormatted)")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .monospacedDigit()
            }
            .foregroundColor(SleepTheme.textTertiary)
            .padding(.top, 2)
        }
    }
    
    /// 計算距離下一個預計起床時間的 `HH:mm` 倒數計時字串
    private func countdownString(from now: Date, toWakeTime targetWakeTime: Date) -> String {
        let calendar = Calendar.current
        let wakeComponents = calendar.dateComponents([.hour, .minute], from: targetWakeTime)
        let hour = wakeComponents.hour ?? 7
        let minute = wakeComponents.minute ?? 0
        
        // 先取今天同一時間，若已過則取明天
        var nextWakeDate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: now) ?? now
        if nextWakeDate <= now {
            nextWakeDate = calendar.date(byAdding: .day, value: 1, to: nextWakeDate) ?? nextWakeDate
        }
        
        let diffSeconds = max(0, Int(nextWakeDate.timeIntervalSince(now)))
        let totalMinutes = (diffSeconds + 59) / 60 // 向上取整至分鐘，避免顯示 00:00 還有數十秒
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        return String(format: "%02d:%02d", hours, minutes)
    }
    
    // MARK: - 點選貓頭鷹展開的「四合一功能選單」
    
    private var owlActionMenu: some View {
        VStack(spacing: 12) {
            // 上排：「引導睡眠」、「即時紀錄」、「早起打卡」
            HStack(spacing: 10) {
                // 1. 引導睡眠
                menuActionButton(
                    title: "引導睡眠",
                    subtitle: "白噪音與調息",
                    icon: "sparkles",
                    tint: SleepTheme.lavender
                ) {
                    showingQuickGuidanceSheet = true
                }
                
                // 2. 即時紀錄
                menuActionButton(
                    title: "即時紀錄",
                    subtitle: store.pendingBedtimeNote.isEmpty ? "卸下腦中思緒" : "已記睡前筆記",
                    icon: "square.and.pencil",
                    tint: SleepTheme.accent
                ) {
                    noteText = store.pendingBedtimeNote.isEmpty ? (store.todayLog?.bedtimeNote ?? "") : store.pendingBedtimeNote
                    noteSavedToast = false
                    withAnimation(.easeInOut(duration: 0.22)) {
                        showingInstantNoteModal = true
                    }
                }
                
                // 3. 早起打卡
                menuActionButton(
                    title: "早起打卡",
                    subtitle: "醒來完成復盤",
                    icon: "sun.Waze.fill",
                    fallbackIcon: "sun.max.fill",
                    tint: SleepTheme.calmTeal
                ) {
                    showingMorningCheckInSheet = true
                }
            }
            
            // 下排：4. 「長按取消」（防誤觸按住 1.2 秒進度填滿後取消睡眠）
            longPressCancelButton
        }
        .padding(14)
        .background(SleepTheme.surface.opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(SleepTheme.border.opacity(0.8), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.45), radius: 18, x: 0, y: 8)
    }
    
    private func menuActionButton(
        title: String,
        subtitle: String,
        icon: String,
        fallbackIcon: String? = nil,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                ZStack {
                    Circle()
                        .fill(tint.opacity(0.16))
                        .frame(width: 40, height: 40)
                    
                    Image(systemName: fallbackIcon ?? icon)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(tint)
                }
                
                VStack(spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SleepTheme.textPrimary)
                    
                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundColor(SleepTheme.textSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .padding(.horizontal, 6)
            .background(SleepTheme.surfaceSecondary.opacity(0.85))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(tint.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
    
    /// 長按取消按鈕（按住 1.2 秒填滿進度條才觸發取消，防止夜間誤觸）
    private var longPressCancelButton: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                // 底層背景
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(SleepTheme.warning.opacity(0.12))
                
                // 長按進度填色層
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(SleepTheme.warning.opacity(0.38))
                    .frame(width: geo.size.width * cancelHoldProgress)
                
                // 按鈕文字與圖示
                HStack(spacing: 8) {
                    Spacer()
                    Image(systemName: isPressingCancel ? "hourglass.bottomhalf.filled" : "xmark.circle.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text(isPressingCancel ? "繼續按住以取消睡眠..." : "長按取消本次睡眠")
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                }
                .foregroundColor(SleepTheme.warning)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(SleepTheme.warning.opacity(isPressingCancel ? 0.65 : 0.28), lineWidth: 1)
            )
            .scaleEffect(isPressingCancel ? 0.98 : 1.0)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressingCancel {
                            startCancelHoldTimer()
                        }
                    }
                    .onEnded { _ in
                        stopCancelHoldTimer()
                    }
            )
        }
        .frame(height: 44)
    }
    
    private func startCancelHoldTimer() {
        isPressingCancel = true
        cancelHoldProgress = 0.0
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        
        let step: CGFloat = 0.03 / 1.2
        cancelHoldTask?.cancel()
        cancelHoldTask = Task { @MainActor in
            while !Task.isCancelled && isPressingCancel {
                try? await Task.sleep(for: .milliseconds(30))
                guard !Task.isCancelled && isPressingCancel else { break }
                cancelHoldProgress = min(1.0, cancelHoldProgress + step)
                if cancelHoldProgress >= 1.0 {
                    isPressingCancel = false
                    #if canImport(UIKit)
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                    #endif
                    store.cancelSleep()
                    break
                }
            }
        }
    }
    
    private func stopCancelHoldTimer() {
        cancelHoldTask?.cancel()
        cancelHoldTask = nil
        isPressingCancel = false
        withAnimation(.easeOut(duration: 0.2)) {
            cancelHoldProgress = 0.0
        }
    }
    
    // MARK: - 「即時紀錄」睡前筆記彈窗
    
    private var instantNoteModalOverlay: some View {
        ZStack {
            Color.black.opacity(0.68)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showingInstantNoteModal = false
                    }
                }
            
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(SleepTheme.accent)
                        Text("睡前即時紀錄")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(SleepTheme.textPrimary)
                    }
                    
                    Spacer()
                    
                    if noteSavedToast {
                        Text("✓ 已儲存")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SleepTheme.success)
                    }
                    
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showingInstantNoteModal = false
                        }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SleepTheme.textSecondary)
                            .frame(width: 28, height: 28)
                            .background(SleepTheme.surfaceSecondary)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                
                Text("把突然想到的待辦事項或思緒寫下來，讓大腦安心關機入睡。")
                    .font(.system(size: 12))
                    .foregroundColor(SleepTheme.textSecondary)
                
                ZStack(alignment: .topLeading) {
                    if noteText.isEmpty {
                        Text("寫下今晚的想法、靈感或感謝的事...")
                            .font(.system(size: 14))
                            .foregroundColor(SleepTheme.textTertiary)
                            .padding(.top, 12)
                            .padding(.leading, 12)
                    }
                    
                    TextEditor(text: $noteText)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(height: 110)
                        .font(.system(size: 14))
                        .foregroundColor(SleepTheme.textPrimary)
                        .background(SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                
                Button {
                    let trimmed = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
                    store.saveBedtimeNote(trimmed)
                    #if canImport(UIKit)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    #endif
                    withAnimation {
                        noteSavedToast = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showingInstantNoteModal = false
                        }
                    }
                } label: {
                    Text("儲存並繼續入眠")
                        .font(.system(size: 15, weight: .bold))
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
            }
            .padding(20)
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(SleepTheme.border, lineWidth: 1)
            )
            .padding(.horizontal, 24)
            .transition(.scale(scale: 0.94).combined(with: .opacity))
        }
    }
    
    // MARK: - 「引導睡眠」快速面板 Sheet
    
    private var quickGuidanceSheet: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // 1. 助眠白噪音快速選擇
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Label("助眠微音效（低頻白噪音）", systemImage: "waveform")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(SleepTheme.textPrimary)
                                
                                Spacer()
                                
                                if soundManager.isPlaying {
                                    Button("停止播放") {
                                        soundManager.stop()
                                    }
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(SleepTheme.warning)
                                }
                            }
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(SoundManager.SoundType.allCases) { sound in
                                    let isCurrent = (soundManager.currentSound == sound && soundManager.isPlaying)
                                    Button {
                                        soundManager.toggleSound(sound)
                                    } label: {
                                        HStack(spacing: 10) {
                                            Image(systemName: sound.icon)
                                                .font(.system(size: 16))
                                                .foregroundColor(isCurrent ? SleepTheme.accent : SleepTheme.textSecondary)
                                            
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(sound.rawValue)
                                                    .font(.system(size: 13, weight: .semibold))
                                                    .foregroundColor(isCurrent ? SleepTheme.accent : SleepTheme.textPrimary)
                                                Text(isCurrent ? "播放中..." : "點擊播放")
                                                    .font(.system(size: 10))
                                                    .foregroundColor(isCurrent ? SleepTheme.success : SleepTheme.textTertiary)
                                            }
                                            Spacer()
                                        }
                                        .padding(12)
                                        .background(isCurrent ? SleepTheme.accent.opacity(0.14) : SleepTheme.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                .stroke(isCurrent ? SleepTheme.accent.opacity(0.45) : SleepTheme.border.opacity(0.5), lineWidth: 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        
                        // 2. 睡前身心放鬆引導提示
                        VStack(alignment: .leading, spacing: 10) {
                            Label("漸進式肌肉放鬆與調息", systemImage: "figure.mind.and.body")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(SleepTheme.textPrimary)
                            
                            Text("1. 放鬆眉心與下顎，舌尖輕抵上顎。\n2. 雙肩自然下沉，想像全身重量深深陷入床墊。\n3. 跟隨待機畫面上貓頭鷹的「吸氣 4 秒、吐氣 4 秒」節律平緩呼吸。")
                                .font(.system(size: 13))
                                .foregroundColor(SleepTheme.textSecondary)
                                .lineSpacing(5)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(SleepTheme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        
                        // 3. 前往完整睡前引導與避坑頁面按鈕
                        if let onNavigateToGuidanceTab {
                            Button {
                                showingQuickGuidanceSheet = false
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                    onNavigateToGuidanceTab()
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "sparkles")
                                    Text("查看完整「睡眠引導與好睡清單」專區")
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 12, weight: .semibold))
                                }
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                                .padding(14)
                                .background(SleepTheme.accent.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("引導睡眠")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("返回待機") {
                        showingQuickGuidanceSheet = false
                    }
                    .foregroundColor(SleepTheme.accent)
                }
            }
        }
    }
    
    // MARK: - 5 分鐘無觸控自動調至最暗 & 觸控恢復亮度
    
    private var dimCountdownFormatted: String {
        let minutes = max(0, remainingDimSeconds) / 60
        let seconds = max(0, remainingDimSeconds) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    /// 5 分鐘無觸控後的極暗護眼遮罩（搭配硬體背光調至 0.0，點擊螢幕任意處立即恢復亮度）
    private var dimmedScreenOverlay: some View {
        ZStack {
            Color.black.opacity(0.92)
                .ignoresSafeArea()
            
            VStack {
                Spacer()
                HStack(spacing: 6) {
                    Image(systemName: "hand.tap")
                        .font(.system(size: 11))
                    Text("螢幕已調至最暗 • 點擊觸控螢幕恢復亮度")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundColor(SleepTheme.textTertiary.opacity(0.35))
                .padding(.bottom, 42)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            #if canImport(UIKit)
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            #endif
            restoreScreenBrightness(resetCountdown: true)
        }
        .gesture(
            DragGesture(minimumDistance: 0)
                .onEnded { _ in
                    #if canImport(UIKit)
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    #endif
                    restoreScreenBrightness(resetCountdown: true)
                }
        )
    }
    
    private func startAutoDimCountdown() {
        stopAutoDimCountdown()
        remainingDimSeconds = autoDimTimeoutSeconds
        autoDimTask = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { break }
                
                // 若正在操作子彈窗（引導睡眠、即時紀錄、早起打卡），暫停倒數並維持 5 分鐘
                if showingQuickGuidanceSheet || showingInstantNoteModal || showingMorningCheckInSheet {
                    remainingDimSeconds = autoDimTimeoutSeconds
                    continue
                }
                
                if !isScreenDimmed {
                    if remainingDimSeconds > 1 {
                        remainingDimSeconds -= 1
                    } else {
                        remainingDimSeconds = 0
                        dimScreenToMinimum()
                    }
                }
            }
        }
    }
    
    private func stopAutoDimCountdown() {
        autoDimTask?.cancel()
        autoDimTask = nil
    }
    
    private func dimScreenToMinimum() {
        guard !isScreenDimmed else { return }
        #if canImport(UIKit)
        if let screen = currentScreen {
            // 記錄調暗前的螢幕亮度，避免記錄到 0
            if screen.brightness > 0.02 {
                savedBrightness = screen.brightness
            }
            // 將系統螢幕硬體背光調到最暗
            screen.brightness = 0.0
        }
        #endif
        withAnimation(.easeInOut(duration: 1.0)) {
            isScreenDimmed = true
            isMenuExpanded = false
        }
    }
    
    private func restoreScreenBrightness(resetCountdown: Bool) {
        #if canImport(UIKit)
        if let screen = currentScreen, isScreenDimmed {
            screen.brightness = savedBrightness
        }
        #endif
        if isScreenDimmed {
            withAnimation(.easeOut(duration: 0.3)) {
                isScreenDimmed = false
            }
        }
        if resetCountdown {
            remainingDimSeconds = autoDimTimeoutSeconds
        }
    }
    
    #if canImport(UIKit)
    private var currentScreen: UIScreen? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let activeScene = scenes.first(where: { $0.activationState == .foregroundActive }) {
            return activeScene.screen
        }
        return scenes.first?.screen
    }
    #endif
    
    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }
}
