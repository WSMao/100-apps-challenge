import SwiftUI

/// 全螢幕「睡覺貓頭鷹」睡眠待機畫面
/// - 顯示較大字樣的鬧鐘響起時間，與較小字樣的「倒數 XX:XX」預計起床倒計時
/// - 中央呈現純 SwiftUI 睡覺貓頭鷹動畫，點擊貓頭鷹可展開/收合四合一功能選單：
///   「引導睡眠」、「即時紀錄」、「起床打卡」、「長按取消」
struct SleepStandbyView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject private var soundManager = SoundManager.shared
    @Environment(\.scenePhase) private var scenePhase
    
    var onMinimize: (() -> Void)? = nil
    var onNavigateToGuidanceTab: (() -> Void)? = nil
    
    // 點擊貓頭鷹切換展開的四合一選單狀態
    @State private var isMenuExpanded: Bool = false
    
    // 子功能彈窗狀態
    @State private var showingQuickGuidanceSheet: Bool = false
    @State private var showingInstantNoteModal: Bool = false
    @State private var showingMorningCheckInSheet: Bool = false
    @State private var selectedGuidanceCategory: GuidanceCategory = .whiteNoise
    
    // 即時紀錄輸入框狀態
    @State private var noteText: String = ""
    @State private var noteSavedToast: Bool = false
    
    // 長按取消進度狀態 (0.0 ~ 1.0)
    @State private var cancelHoldProgress: CGFloat = 0.0
    @State private var isPressingCancel: Bool = false
    @State private var cancelHoldTask: Task<Void, Never>? = nil
    
    // 5 分鐘 (300 秒) 無觸控自動鎖屏計時狀態
    private let autoLockTimeoutSeconds: Int = 300
    @State private var remainingLockSeconds: Int = 300
    @State private var autoLockTask: Task<Void, Never>? = nil
    
    // 5 分鐘無觸控溫柔「晚安」彈出與漸暗鎖屏狀態
    @State private var isShowingGoodNightFarewell: Bool = false
    @State private var farewellScale: CGFloat = 0.88
    
    // 螢幕硬體整體亮度控制 (對齊 iOS 控制中心亮度滑桿調至最暗)
    @State private var originalBrightness: CGFloat = 0.5
    @State private var isScreenDimmed: Bool = false
    @State private var dimBrightnessTask: Task<Void, Never>? = nil
    
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
                    Spacer(minLength: 32)
                }
            }
            
            // 6. 「即時紀錄」浮動彈窗 (Instant Bedtime Note Modal)
            if showingInstantNoteModal {
                instantNoteModalOverlay
                    .zIndex(50)
            }
            
            // 7. 5 分鐘無觸控溫柔晚安與漸暗鎖屏遮罩
            goodNightFarewellOverlay
        }
        // 偵測畫面上的任何觸控操作：重置 5 分鐘自動鎖屏倒數計時並保持螢幕常亮
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    resetAutoLockTimer()
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
            recordOriginalBrightnessIfNeeded()
            UIApplication.shared.isIdleTimerDisabled = true
            #endif
            startAutoLockCountdown()
        }
        .onDisappear {
            stopCancelHoldTimer()
            stopAutoLockCountdown()
            isShowingGoodNightFarewell = false
            isScreenDimmed = false
            restoreBrightness(animated: false)
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
        .onChange(of: soundManager.isAlarmRinging) { _, isRinging in
            if isRinging {
                if isShowingGoodNightFarewell || isScreenDimmed {
                    dismissFarewellAndWake()
                } else {
                    restoreBrightness(animated: false)
                    resetAutoLockTimer()
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                // 解鎖螢幕或回到前台時：若處於晚安狀態或螢幕調暗狀態，立即關閉並恢復一般亮度，重啟 5 分鐘計時
                if isShowingGoodNightFarewell || isScreenDimmed {
                    isShowingGoodNightFarewell = false
                    isScreenDimmed = false
                    farewellScale = 0.88
                    restoreBrightness(animated: false)
                }
                resetAutoLockTimer()
            } else if newPhase == .background {
                // 螢幕已鎖定或進入背景時：先復原晚安狀態與硬體螢幕亮度，確保下次螢幕亮起解鎖時畫面已是正常明亮狀態
                isShowingGoodNightFarewell = false
                farewellScale = 0.88
                isScreenDimmed = false
                restoreBrightness(animated: false)
            }
        }
        #if canImport(UIKit)
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            if isShowingGoodNightFarewell || isScreenDimmed {
                isShowingGoodNightFarewell = false
                isScreenDimmed = false
                farewellScale = 0.88
                restoreBrightness(animated: false)
            }
            resetAutoLockTimer()
        }
        #endif
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
                    .foregroundColor(store.alarmSetting.isEnabled ? SleepTheme.accent : .yellow)
                Text(store.alarmSetting.isEnabled ? "預計鬧鐘響起" : "鬧鐘已關閉")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(store.alarmSetting.isEnabled ? SleepTheme.textSecondary : .yellow)
            }
            .padding(.horizontal, store.alarmSetting.isEnabled ? 0 : 14)
            .padding(.vertical, store.alarmSetting.isEnabled ? 0 : 6)
            .background(store.alarmSetting.isEnabled ? Color.clear : Color.yellow.opacity(0.12))
            .clipShape(Capsule())
            
            // 只有在鬧鐘開啟時，才顯示預計起床時間與倒計時膠囊
            if store.alarmSetting.isEnabled {
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
            }
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
            // 上排：「引導睡眠」、「即時紀錄」、「起床打卡」
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
                
                // 3. 起床打卡
                menuActionButton(
                    title: "起床打卡",
                    subtitle: "醒來完成復盤",
                    icon: "sun.Waze.fill",
                    fallbackIcon: "sun.max.fill",
                    tint: SleepTheme.calmTeal
                ) {
                    showingMorningCheckInSheet = true
                }
            }
            
            // 下排：4. 「長按取消」（防誤觸按住 600ms 進度填滿後取消睡眠）
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
    
    /// 長按取消按鈕（按住 600ms 填滿進度條才觸發取消，防止夜間誤觸）
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
        
        let step: CGFloat = 0.03 / 0.6
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
                        Text("即時紀錄")
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
    
    // MARK: - 「睡眠引導」面板 Sheet (可切換白噪音 / 冥想引導)
    
    private var quickGuidanceSheet: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        // 1. 子分類切換器 (白噪音 / 冥想引導)
                        HStack(spacing: 8) {
                            ForEach(GuidanceCategory.allCases) { category in
                                let isSelected = selectedGuidanceCategory == category
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedGuidanceCategory = category
                                    }
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: category.icon)
                                            .font(.system(size: 12))
                                        Text(category.rawValue)
                                            .font(.system(size: 13, weight: .semibold))
                                    }
                                    .foregroundColor(isSelected ? SleepTheme.background : SleepTheme.textSecondary)
                                    .padding(.vertical, 8)
                                    .frame(maxWidth: .infinity)
                                    .background(isSelected ? SleepTheme.accent : SleepTheme.surfaceSecondary)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        
                        // 2. 依選中分類呈現內容 (白噪音 vs 冥想引導)，其餘雜項皆移除
                        if selectedGuidanceCategory == .whiteNoise {
                            whiteNoiseSection
                        } else {
                            meditationSection
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("睡眠引導")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        showingQuickGuidanceSheet = false
                    }
                    .foregroundColor(SleepTheme.accent)
                }
            }
        }
    }
    
    // 白噪音細分子區塊
    private var whiteNoiseSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("🌙 助眠微音效 (低頻白噪音)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.textSecondary)
                
                Spacer()
                
                // 定時按鈕 (5 / 15 / 30 分鐘 / 結束時停止)
                SleepTimerMenu()
                
                if soundManager.isPlaying {
                    Button("停止播放") {
                        soundManager.stop()
                    }
                    .font(.system(size: 11, weight: .semibold))
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
    }
    
    // 冥想引導細分子區塊 (含 4-7-8 呼吸練習器與身體掃描)
    private var meditationSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("🧘 睡前放鬆與身心調息")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.textSecondary)
                
                Spacer()
                
                if soundManager.isPlaying || soundManager.activeTimerOption != .off {
                    SleepTimerMenu()
                }
            }
            
            // 4-7-8 呼吸練習器
            BreathingCard()
            
            // 漸進式身體掃描指南卡片
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundColor(SleepTheme.accent)
                        .font(.system(size: 12))
                    Text("漸進式身體掃描（Body Scan）")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(SleepTheme.textPrimary)
                }
                
                Text("從前額、咬合肌、雙肩到雙腳，隨呼氣將各部位重力完全交託給床墊。思緒浮現時不加評判，像看待夜空微雲般溫和目送它飄過。")
                    .font(.system(size: 12))
                    .foregroundColor(SleepTheme.textSecondary)
                    .lineSpacing(3)
            }
            .padding(14)
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
    
    // MARK: - 5 分鐘無觸控自動鎖屏 (Auto-Lock) 與溫柔晚安道別
    
    @ViewBuilder
    private var goodNightFarewellOverlay: some View {
        if isShowingGoodNightFarewell {
            ZStack {
                // 底層微暗半透明背景
                Color.black.opacity(0.88)
                    .ignoresSafeArea()
                
                // 溫柔晚安卡片內容
                VStack(spacing: 18) {
                    // 月亮與柔和月光微光暈
                    ZStack {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [SleepTheme.accent.opacity(0.35), Color.clear],
                                    center: .center,
                                    startRadius: 8,
                                    endRadius: 58
                                )
                            )
                            .frame(width: 120, height: 120)
                        
                        Image(systemName: "moon.stars.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [SleepTheme.moonGlow, SleepTheme.accent],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .shadow(color: SleepTheme.accent.opacity(0.45), radius: 18, x: 0, y: 0)
                    }
                    
                    VStack(spacing: 8) {
                        Text("晚安")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundColor(SleepTheme.textPrimary)
                            .tracking(3)
                        
                        Text("願你有個安穩香甜的美夢")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(SleepTheme.textSecondary.opacity(0.9))
                    }
                }
                .scaleEffect(farewellScale)
                .transition(.opacity.combined(with: .scale(scale: 0.92)))
            }
            .contentShape(Rectangle())
            .onTapGesture {
                dismissFarewellAndWake()
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onEnded { _ in
                        dismissFarewellAndWake()
                    }
            )
            .transition(.opacity)
            .zIndex(200)
        }
    }
    
    private func triggerGoodNightAndLock() {
        guard !isShowingGoodNightFarewell else { return }
        
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        #endif
        
        // 1. 維持當前亮度，彈出溫柔「晚安」道別畫面
        withAnimation(.easeOut(duration: 0.5)) {
            isShowingGoodNightFarewell = true
            farewellScale = 1.0
        }
        
        // 2. 「晚安」畫面持續 1.5 秒
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(1500))
            guard isShowingGoodNightFarewell else { return }
            
            // 3. 1.5 秒後：「晚安」畫面淡出消失
            withAnimation(.easeInOut(duration: 0.8)) {
                isShowingGoodNightFarewell = false
                farewellScale = 0.88
            }
            isScreenDimmed = true
            
            // 4. 同時將整體螢幕硬體亮度調至最暗（如控制中心最低模式）
            smoothlyDimBrightness(duration: 1.0)
            
            // 5. 解除螢幕常亮控制權，iOS 原生 idle timer 隨即開始接手 30 秒倒數鎖屏
            #if canImport(UIKit)
            UIApplication.shared.isIdleTimerDisabled = false
            #endif
        }
    }
    
    private func dismissFarewellAndWake() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        
        isScreenDimmed = false
        restoreBrightness(animated: true)
        
        withAnimation(.easeOut(duration: 0.25)) {
            isShowingGoodNightFarewell = false
            farewellScale = 0.88
        }
        resetAutoLockTimer()
    }
    
    // MARK: - 螢幕硬體整體亮度控制 (如同控制中心亮度滑桿調至最暗)
    
    private func recordOriginalBrightnessIfNeeded() {
        #if canImport(UIKit)
        let current = UIScreen.main.brightness
        if current > 0.05 {
            originalBrightness = current
        }
        #endif
    }
    
    private func smoothlyDimBrightness(duration: TimeInterval = 1.0) {
        #if canImport(UIKit)
        recordOriginalBrightnessIfNeeded()
        dimBrightnessTask?.cancel()
        
        let startBrightness = UIScreen.main.brightness
        let targetBrightness: CGFloat = 0.0 // 調至控制中心最暗
        let steps = 15
        let interval = duration / Double(steps)
        let delta = targetBrightness - startBrightness
        
        dimBrightnessTask = Task { @MainActor in
            for i in 1...steps {
                try? await Task.sleep(for: .milliseconds(Int(interval * 1000)))
                guard !Task.isCancelled else { break }
                let progress = CGFloat(i) / CGFloat(steps)
                UIScreen.main.brightness = max(0.0, startBrightness + delta * progress)
            }
            if !Task.isCancelled {
                UIScreen.main.brightness = targetBrightness
            }
        }
        #endif
    }
    
    private func restoreBrightness(animated: Bool = true) {
        #if canImport(UIKit)
        dimBrightnessTask?.cancel()
        dimBrightnessTask = nil
        
        let target = max(0.2, originalBrightness)
        if animated {
            let startBrightness = UIScreen.main.brightness
            let steps = 6
            let interval = 0.2 / Double(steps)
            let delta = target - startBrightness
            
            Task { @MainActor in
                for i in 1...steps {
                    try? await Task.sleep(for: .milliseconds(Int(interval * 1000)))
                    let progress = CGFloat(i) / CGFloat(steps)
                    UIScreen.main.brightness = startBrightness + delta * progress
                }
                UIScreen.main.brightness = target
            }
        } else {
            UIScreen.main.brightness = target
        }
        #endif
    }
    
    private func startAutoLockCountdown() {
        stopAutoLockCountdown()
        remainingLockSeconds = autoLockTimeoutSeconds
        #if canImport(UIKit)
        UIApplication.shared.isIdleTimerDisabled = true
        #endif
        
        autoLockTask = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { break }
                
                // 若正在操作子彈窗（引導睡眠、即時紀錄、起床打卡）或已在晚安道別/調暗中，暫停倒數
                if showingQuickGuidanceSheet || showingInstantNoteModal || showingMorningCheckInSheet || isShowingGoodNightFarewell || isScreenDimmed {
                    remainingLockSeconds = autoLockTimeoutSeconds
                    continue
                }
                
                if remainingLockSeconds > 1 {
                    remainingLockSeconds -= 1
                } else {
                    remainingLockSeconds = 0
                    // 5 分鐘時間一到，溫柔彈出「晚安」，1.5 秒後淡出並調暗鎖屏
                    triggerGoodNightAndLock()
                    autoLockTask = nil
                    break
                }
            }
        }
    }
    
    private func resetAutoLockTimer() {
        if isShowingGoodNightFarewell {
            dismissFarewellAndWake()
            return
        }
        if isScreenDimmed {
            isScreenDimmed = false
            restoreBrightness(animated: true)
        }
        startAutoLockCountdown()
    }
    
    private func stopAutoLockCountdown() {
        autoLockTask?.cancel()
        autoLockTask = nil
    }
    
    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }
}
