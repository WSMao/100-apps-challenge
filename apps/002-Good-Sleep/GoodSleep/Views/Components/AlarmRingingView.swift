import SwiftUI

/// 全螢幕晨間鬧鐘響鈴與喚醒互動視窗
/// - 第一階段（響鈴中）：頂部呈現「貓頭鷹睡醒伸懶腰」動畫 (`WakingOwlView`)、當前時間、稍後提醒與底部「滑動來停止」滑軌
/// - 第二階段（滑動來停止後）：呈現「貓頭鷹睡醒伸懶腰」動畫，並提供【起床打卡】（開啟「編輯睡眠記錄」視窗）與【略過】兩個按鈕
struct AlarmRingingView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject var soundManager = SoundManager.shared
    @Environment(\.dismiss) private var dismiss
    
    // 滑動來停止軌道拖曳偏移量
    @State private var slideOffset: CGFloat = 0
    @State private var isDraggingSlider: Bool = false
    
    // 控制開啟「編輯睡眠記錄」Sheet
    @State private var showingEditSleepLogSheet: Bool = false
    
    var body: some View {
        ZStack {
            // 深色晨曦漸層背景
            LinearGradient(
                colors: [
                    Color(hex: "0B0E14"),
                    Color(hex: "182235"),
                    Color(hex: "253752")
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 24) {
                Spacer(minLength: 16)
                
                // 頂部主視覺：用「貓頭鷹睡醒伸懶腰」動畫取代原本的「好好睡覺」標題與靜態圖示
                WakingOwlView(isRinging: !soundManager.isShowingWakeUpPrompt)
                
                if soundManager.isShowingWakeUpPrompt {
                    // MARK: - 第二階段：「滑動來停止」之後的畫面（【起床打卡】與【略過】）
                    postStopWakeUpContent
                        .transition(.asymmetric(
                            insertion: .move(edge: .bottom).combined(with: .opacity),
                            removal: .opacity
                        ))
                } else {
                    // MARK: - 第一階段：鬧鐘響鈴中畫面（含「滑動來停止」滑軌）
                    ringingContent
                        .transition(.opacity)
                }
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.82), value: soundManager.isShowingWakeUpPrompt)
        }
        .sheet(isPresented: $showingEditSleepLogSheet) {
            EditSleepLogSheet(
                store: store,
                morningCheckInAt: Date(),
                onSaved: {
                    NotificationManager.shared.clearDeliveredWakeNotifications()
                    soundManager.stopAlarmMelody()
                    dismiss()
                }
            )
        }
    }
    
    // MARK: - 第一階段：鬧鐘響鈴中內容
    
    private var ringingContent: some View {
        VStack(spacing: 24) {
            // 當前時間與喚醒提示
            VStack(spacing: 8) {
                Text(currentTimeString)
                    .font(.system(size: 62, weight: .bold, design: .rounded))
                    .foregroundColor(SleepTheme.moonGlow)
                    .shadow(color: SleepTheme.accent.opacity(0.25), radius: 10, x: 0, y: 4)
                
                Text("☀️ 早安！美好的一天開始了")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(SleepTheme.accent)
                
                Text("跟著貓頭鷹深呼吸伸個懶腰，溫柔喚醒身體...")
                    .font(.system(size: 14))
                    .foregroundColor(SleepTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            
            Spacer(minLength: 10)
            
            // 底部控制區：稍後提醒 + 「滑動來停止」軌道
            VStack(spacing: 16) {
                // 稍後提醒按鈕（僅在有開啟稍後提醒設定時顯示）
                if store.alarmSetting.isSnoozeEnabled {
                    Button {
                        soundManager.stopAlarmMelody()
                        NotificationManager.shared.scheduleSnoozeAlarm(
                            minutes: store.alarmSetting.snoozeDurationMinutes,
                            isSnoozeEnabled: store.alarmSetting.isSnoozeEnabled
                        )
                        dismiss()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "zzz")
                                .font(.system(size: 15, weight: .semibold))
                            Text("稍後提醒 (\(store.alarmSetting.snoozeDurationMinutes) 分鐘)")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .foregroundColor(SleepTheme.textPrimary)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 13)
                        .background(SleepTheme.surfaceSecondary.opacity(0.9))
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .stroke(SleepTheme.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
                
                // 「滑動來停止」互動滑軌
                slideToStopTrack
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 38)
        }
    }
    
    /// 「滑動來停止」膠囊滑軌組件
    private var slideToStopTrack: some View {
        GeometryReader { geo in
            let trackHeight: CGFloat = 62
            let thumbSize: CGFloat = 52
            let padding: CGFloat = 5
            let maxDragDistance = max(1, geo.size.width - thumbSize - padding * 2)
            let progress = min(1.0, max(0.0, slideOffset / maxDragDistance))
            
            ZStack(alignment: .leading) {
                // 滑軌底槽
                Capsule()
                    .fill(SleepTheme.surface.opacity(0.92))
                    .overlay(
                        Capsule()
                            .stroke(SleepTheme.accent.opacity(0.35), lineWidth: 1.2)
                    )
                
                // 已滑動區域漸層背景
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [SleepTheme.accent.opacity(0.35), SleepTheme.moonGlow.opacity(0.55)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: thumbSize + padding * 2 + slideOffset)
                
                // 中央提示文字：「滑動來停止」
                HStack(spacing: 6) {
                    Spacer()
                    Text("滑動來停止")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(SleepTheme.moonGlow.opacity(Double(1.0 - progress * 0.85)))
                    Image(systemName: "chevron.right.2")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(SleepTheme.accent.opacity(Double(1.0 - progress * 0.85)))
                    Spacer()
                }
                .padding(.leading, thumbSize * 0.6)
                
                // 可拖曳金色滑塊
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [SleepTheme.moonGlow, SleepTheme.accent],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: thumbSize, height: thumbSize)
                        .shadow(color: SleepTheme.accent.opacity(0.45), radius: 8, x: 0, y: 3)
                    
                    Image(systemName: "bell.slash.fill")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(Color(hex: "0B0E14"))
                }
                .padding(.leading, padding + slideOffset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if !isDraggingSlider {
                                isDraggingSlider = true
                                #if canImport(UIKit)
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                #endif
                            }
                            let clamped = min(maxDragDistance, max(0, value.translation.width))
                            slideOffset = clamped
                        }
                        .onEnded { _ in
                            isDraggingSlider = false
                            if slideOffset >= maxDragDistance * 0.78 {
                                // 完成「滑動來停止」
                                slideOffset = maxDragDistance
                                completeSlideToStop()
                            } else {
                                // 未滑到底，平滑彈回原位
                                withAnimation(.spring(response: 0.32, dampingFraction: 0.75)) {
                                    slideOffset = 0
                                }
                            }
                        }
                )
            }
            .frame(height: trackHeight)
        }
        .frame(height: 62)
    }
    
    private func completeSlideToStop() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
        NotificationManager.shared.stopAlertingAlarm()
        withAnimation(.spring(response: 0.38, dampingFraction: 0.8)) {
            soundManager.transitionToWakeUpPrompt()
        }
    }
    
    // MARK: - 第二階段：「滑動來停止」之後的畫面（包含【起床打卡】與【略過】 2 個按鈕）
    
    private var postStopWakeUpContent: some View {
        VStack(spacing: 22) {
            VStack(spacing: 10) {
                Text("☀️ 早安！伸個懶腰迎接今天")
                    .font(.system(size: 23, weight: .bold))
                    .foregroundColor(SleepTheme.moonGlow)
                
                Text("鬧鐘已停止。現在要打開「編輯睡眠記錄」完成起床打卡嗎？")
                    .font(.system(size: 14))
                    .foregroundColor(SleepTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
                    .lineSpacing(3)
                
                if let bedtime = store.ongoingBedtime {
                    HStack(spacing: 6) {
                        Image(systemName: "moon.zzz.fill")
                            .font(.system(size: 12))
                            .foregroundColor(SleepTheme.calmTeal)
                        Text("昨晚入睡時間：\(timeFormatter.string(from: bedtime))")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(SleepTheme.calmTeal)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(SleepTheme.calmTeal.opacity(0.14))
                    .clipShape(Capsule())
                    .padding(.top, 4)
                }
            }
            
            Spacer(minLength: 10)
            
            // 【起床打卡】與【略過】兩個按鈕
            VStack(spacing: 14) {
                // 按鈕 1：【起床打卡】 -> 打開「編輯睡眠記錄」畫面
                Button {
                    #if canImport(UIKit)
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    #endif
                    showingEditSleepLogSheet = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 18, weight: .bold))
                        Text("起床打卡")
                            .font(.system(size: 17, weight: .bold))
                    }
                    .foregroundColor(Color(hex: "0B0E14"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [SleepTheme.moonGlow, SleepTheme.accent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .shadow(color: SleepTheme.accent.opacity(0.32), radius: 10, x: 0, y: 4)
                }
                .buttonStyle(.plain)
                
                // 按鈕 2：【略過】 -> 關閉此畫面（結束睡眠待機狀態，返回主畫面）
                Button {
                    #if canImport(UIKit)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    #endif
                    NotificationManager.shared.clearDeliveredWakeNotifications()
                    store.clearSleepingState()
                    soundManager.stopAlarmMelody()
                    dismiss()
                } label: {
                    Text("略過")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(SleepTheme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(SleepTheme.surfaceSecondary.opacity(0.85))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(SleepTheme.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 26)
            .padding(.bottom, 38)
        }
    }
    
    private var currentTimeString: String {
        timeFormatter.string(from: Date())
    }
    
    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }
}

// MARK: - 純原生 SwiftUI 幾何插畫「貓頭鷹睡醒伸懶腰」動畫組件

/// 純原生 SwiftUI 幾何插畫「貓頭鷹睡醒伸懶腰」動畫組件
/// - 週期性展現「高舉雙翅伸懶腰 + 開心瞇眼打哈欠」與「圓亮金瞳眨眼甦醒」的晨間動態
/// - 搭配柔和晨曦暖陽光暈與閃爍晨星
struct WakingOwlView: View {
    var isRinging: Bool = true
    
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let now = timeline.date.timeIntervalSinceReferenceDate
            // 4.4 秒一個完整甦醒伸懶腰循環：
            // 0.0 ~ 2.0s：高舉雙翅伸懶腰 (Stretch Phase)
            // 2.0 ~ 4.4s：放下翅膀、圓亮大眼清醒眨眼 (Awake & Blink Phase)
            let cycleDuration = 4.4
            let t = now.truncatingRemainder(dividingBy: cycleDuration)
            
            // stretchProgress: 0.0 (放鬆) -> 1.0 (伸懶腰最高點)
            let stretchProgress: CGFloat = {
                if t < 2.0 {
                    // 0 ~ 2.0 秒平滑正弦拱形伸展
                    return CGFloat(sin((t / 2.0) * .pi))
                } else {
                    return 0.0
                }
            }()
            
            // 清醒階段的快速眨眼 (在 t = 3.1 ~ 3.35 秒之間眨眼一次)
            let isBlinking: Bool = (t > 3.1 && t < 3.32)
            // 伸懶腰到高點時呈現開心彎彎瞇眼 (^ ^)
            let isHappySquinting: Bool = (stretchProgress > 0.45)
            
            ZStack {
                // 1. 晨曦暖陽放射光暈
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                SleepTheme.accent.opacity(0.28 + 0.12 * Double(stretchProgress)),
                                SleepTheme.moonGlow.opacity(0.10 + 0.06 * Double(stretchProgress)),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 16,
                            endRadius: 125
                        )
                    )
                    .frame(width: 240, height: 240)
                    .scaleEffect(0.92 + 0.16 * stretchProgress)
                
                // 2. 晨光微粒與伸懶腰活力線條
                morningSparklesLayer(time: now, stretchProgress: stretchProgress)
                
                // 3. 棲木底座
                Capsule(style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                SleepTheme.accent.opacity(0.75),
                                Color(hex: "8C6D46").opacity(0.85)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 150, height: 12)
                    .offset(y: 66)
                    .shadow(color: Color.black.opacity(0.3), radius: 6, x: 0, y: 3)
                
                // 4. 睡醒伸懶腰貓頭鷹本體
                stretchingOwlBody(
                    stretchProgress: stretchProgress,
                    isHappySquinting: isHappySquinting,
                    isBlinking: isBlinking,
                    time: now
                )
            }
            .frame(width: 240, height: 210)
        }
    }
    
    // MARK: - 貓頭鷹睡醒伸懶腰幾何本體
    
    private func stretchingOwlBody(
        stretchProgress: CGFloat,
        isHappySquinting: Bool,
        isBlinking: Bool,
        time: TimeInterval
    ) -> some View {
        // 伸懶腰時身體拉長、往上挺起，放鬆時微微輕晃
        let bodyScaleY = 1.0 + 0.11 * stretchProgress
        let bodyScaleX = 1.0 - 0.04 * stretchProgress
        let bodyOffsetY = -10.0 * stretchProgress
        // 雙翅從收攏 (0°) 高舉展開至 115° 伸懶腰，並在最高點微微顫動
        let wingTremble = stretchProgress > 0.7 ? CGFloat(sin(time * 22.0)) * 4.0 : 0.0
        let wingRaiseDegrees = Double(stretchProgress * 112.0 + wingTremble)
        let earPerkDegrees = Double(stretchProgress * 12.0)
        
        return ZStack {
            // 1. 左右高舉伸懶腰的翅膀 (置於身體側後方，往上展開)
            WakingOwlWingShape(isLeft: true)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "3D4E73"), Color(hex: "222D45")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 34, height: 74)
                .rotationEffect(.degrees(wingRaiseDegrees), anchor: .topTrailing)
                .offset(x: -44, y: 6 + bodyOffsetY)
            
            WakingOwlWingShape(isLeft: false)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "3D4E73"), Color(hex: "222D45")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 34, height: 74)
                .rotationEffect(.degrees(-wingRaiseDegrees), anchor: .topLeading)
                .offset(x: 44, y: 6 + bodyOffsetY)
            
            // 2. 精神豎起的左右耳羽簇
            WakingEarTuftShape(isLeft: true)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "43547A"), Color(hex: "283450")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 28, height: 36)
                .rotationEffect(.degrees(earPerkDegrees), anchor: .bottomTrailing)
                .offset(x: -36, y: -54 + bodyOffsetY * 1.15)
            
            WakingEarTuftShape(isLeft: false)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "43547A"), Color(hex: "283450")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 28, height: 36)
                .rotationEffect(.degrees(-earPerkDegrees), anchor: .bottomLeading)
                .offset(x: 36, y: -54 + bodyOffsetY * 1.15)
            
            // 3. 圓潤主身軀（隨伸懶腰向上伸展）
            Capsule(style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: "3A4A6E"),
                            Color(hex: "212B42")
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 108, height: 120)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(SleepTheme.moonGlow.opacity(0.24), lineWidth: 1.3)
                )
                .scaleEffect(x: bodyScaleX, y: bodyScaleY, anchor: .bottom)
                .offset(y: bodyOffsetY * 0.4)
            
            // 4. 暖金色蓬鬆胸腹羽毛
            Ellipse()
                .fill(
                    LinearGradient(
                        colors: [
                            SleepTheme.moonGlow.opacity(0.95),
                            Color(hex: "DECBA4").opacity(0.88)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 72, height: 68)
                .scaleEffect(x: bodyScaleX, y: bodyScaleY * 1.02, anchor: .bottom)
                .offset(y: 20 + bodyOffsetY * 0.5)
            
            // 胸口羽毛紋理
            VStack(spacing: 7) {
                HStack(spacing: 8) {
                    WakingFeatherArc().stroke(Color(hex: "5E5343").opacity(0.45), lineWidth: 1.6).frame(width: 12, height: 6)
                    WakingFeatherArc().stroke(Color(hex: "5E5343").opacity(0.45), lineWidth: 1.6).frame(width: 12, height: 6)
                    WakingFeatherArc().stroke(Color(hex: "5E5343").opacity(0.45), lineWidth: 1.6).frame(width: 12, height: 6)
                }
                HStack(spacing: 10) {
                    WakingFeatherArc().stroke(Color(hex: "5E5343").opacity(0.40), lineWidth: 1.6).frame(width: 12, height: 6)
                    WakingFeatherArc().stroke(Color(hex: "5E5343").opacity(0.40), lineWidth: 1.6).frame(width: 12, height: 6)
                }
            }
            .offset(y: 18 + bodyOffsetY * 0.8)
            
            // 5. 雙眼臉盤 (Facial Disc)
            HStack(spacing: -8) {
                Circle()
                    .fill(Color(hex: "F3EAD6"))
                    .frame(width: 50, height: 50)
                Circle()
                    .fill(Color(hex: "F3EAD6"))
                    .frame(width: 50, height: 50)
            }
            .shadow(color: Color.black.opacity(0.18), radius: 3, x: 0, y: 2)
            .offset(y: -20 + bodyOffsetY)
            
            // 6. 眼睛狀態：伸懶腰時開心彎彎眼 (^ ^)，清醒時圓亮琥珀大眼 + 眨眼
            HStack(spacing: 16) {
                owlEye(isHappySquinting: isHappySquinting, isBlinking: isBlinking)
                owlEye(isHappySquinting: isHappySquinting, isBlinking: isBlinking)
            }
            .offset(y: -20 + bodyOffsetY)
            
            // 7. 朝氣雙頰紅暈
            HStack(spacing: 46) {
                Ellipse()
                    .fill(SleepTheme.warning.opacity(0.42))
                    .frame(width: 13, height: 7.5)
                Ellipse()
                    .fill(SleepTheme.warning.opacity(0.42))
                    .frame(width: 13, height: 7.5)
            }
            .offset(y: -10 + bodyOffsetY)
            
            // 8. 鳥喙與伸懶腰小哈欠/微笑嘴型
            ZStack {
                if stretchProgress > 0.35 {
                    // 伸懶腰時微張的小嘴 (哈欠/早安呼喚)
                    Ellipse()
                        .fill(Color(hex: "C95B63"))
                        .frame(width: 10, height: 11 * stretchProgress)
                        .offset(y: 4)
                }
                
                WakingBeakShape()
                    .fill(SleepTheme.accent)
                    .frame(width: 14, height: 13)
            }
            .offset(y: -11 + bodyOffsetY)
            
            // 9. 站在棲木上的小腳爪
            HStack(spacing: 26) {
                owlFoot
                owlFoot
            }
            .offset(y: 59)
        }
    }
    
    @ViewBuilder
    private func owlEye(isHappySquinting: Bool, isBlinking: Bool) -> some View {
        if isHappySquinting {
            // 伸懶腰時開心的上彎弧線眼 (^ ^)
            HappySquintEyeShape()
                .stroke(Color(hex: "232B3E"), style: StrokeStyle(lineWidth: 2.8, lineCap: .round))
                .frame(width: 20, height: 10)
        } else if isBlinking {
            // 眨眼瞬間
            Capsule()
                .fill(Color(hex: "232B3E"))
                .frame(width: 20, height: 3)
        } else {
            // 睡醒時精神奕奕的圓亮琥珀金大眼
            ZStack {
                Circle()
                    .fill(SleepTheme.accent)
                    .frame(width: 24, height: 24)
                
                Circle()
                    .fill(Color(hex: "161C2B"))
                    .frame(width: 15, height: 15)
                
                // 眼神高光亮點
                Circle()
                    .fill(Color.white)
                    .frame(width: 5.5, height: 5.5)
                    .offset(x: -3.5, y: -3.5)
                
                Circle()
                    .fill(Color.white.opacity(0.75))
                    .frame(width: 2.5, height: 2.5)
                    .offset(x: 3.5, y: 3.5)
            }
        }
    }
    
    private var owlFoot: some View {
        HStack(spacing: 2.5) {
            ForEach(0..<3, id: \.self) { _ in
                Capsule()
                    .fill(SleepTheme.accent)
                    .frame(width: 4.5, height: 9)
            }
        }
    }
    
    // MARK: - 晨光星芒與伸懶腰活力特效
    
    private func morningSparklesLayer(time: TimeInterval, stretchProgress: CGFloat) -> some View {
        ZStack {
            // 頭頂伸懶腰時浮現的晨間小太陽/閃耀星芒
            ForEach(0..<3, id: \.self) { i in
                let angle = Double(i - 1) * 32.0
                let radius: CGFloat = 78 + stretchProgress * 16
                let rad = (angle - 90) * .pi / 180.0
                
                Image(systemName: i == 1 ? "sun.max.fill" : "sparkle")
                    .font(.system(size: i == 1 ? 18 : 13, weight: .bold))
                    .foregroundColor(i == 1 ? SleepTheme.accent : SleepTheme.moonGlow)
                    .scaleEffect(0.75 + 0.45 * stretchProgress)
                    .opacity(0.35 + 0.65 * Double(stretchProgress))
                    .offset(
                        x: CGFloat(cos(rad)) * radius,
                        y: CGFloat(sin(rad)) * radius - 12
                    )
            }
        }
    }
}

// MARK: - 自訂幾何形狀

private struct HappySquintEyeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY - 2))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.maxY - 2),
            control: CGPoint(x: rect.midX, y: rect.minY - 3)
        )
        return path
    }
}

private struct WakingFeatherArc: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY),
            control: CGPoint(x: rect.midX, y: rect.maxY)
        )
        return path
    }
}

private struct WakingBeakShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY * 0.85))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.midY * 0.85))
        path.closeSubpath()
        return path
    }
}

private struct WakingEarTuftShape: Shape {
    let isLeft: Bool
    
    func path(in rect: CGRect) -> Path {
        var path = Path()
        if isLeft {
            path.move(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addQuadCurve(
                to: CGPoint(x: rect.minX, y: rect.minY),
                control: CGPoint(x: rect.minX + rect.width * 0.1, y: rect.maxY * 0.65)
            )
            path.addQuadCurve(
                to: CGPoint(x: rect.maxX, y: rect.maxY * 0.45),
                control: CGPoint(x: rect.midX + 4, y: rect.minY + 4)
            )
            path.closeSubpath()
        } else {
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.addQuadCurve(
                to: CGPoint(x: rect.maxX, y: rect.minY),
                control: CGPoint(x: rect.maxX - rect.width * 0.1, y: rect.maxY * 0.65)
            )
            path.addQuadCurve(
                to: CGPoint(x: rect.minX, y: rect.maxY * 0.45),
                control: CGPoint(x: rect.midX - 4, y: rect.minY + 4)
            )
            path.closeSubpath()
        }
        return path
    }
}

private struct WakingOwlWingShape: Shape {
    let isLeft: Bool
    
    func path(in rect: CGRect) -> Path {
        var path = Path()
        if isLeft {
            path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addQuadCurve(
                to: CGPoint(x: rect.minX + 4, y: rect.maxY - 6),
                control: CGPoint(x: rect.minX - 6, y: rect.midY)
            )
            path.addQuadCurve(
                to: CGPoint(x: rect.maxX, y: rect.maxY * 0.75),
                control: CGPoint(x: rect.midX + 4, y: rect.maxY)
            )
            path.closeSubpath()
        } else {
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.0))
            path.addQuadCurve(
                to: CGPoint(x: rect.maxX - 4, y: rect.maxY - 6),
                control: CGPoint(x: rect.maxX + 6, y: rect.midY)
            )
            path.addQuadCurve(
                to: CGPoint(x: rect.minX, y: rect.maxY * 0.75),
                control: CGPoint(x: rect.midX - 4, y: rect.maxY)
            )
            path.closeSubpath()
        }
        return path
    }
}
