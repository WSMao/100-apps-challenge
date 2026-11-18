import SwiftUI

/// 純原生 SwiftUI 幾何插畫「睡覺貓頭鷹」動畫組件
/// - 包含 4 秒吸氣、4 秒吐氣（4-4 助眠呼吸節律）的胸口與身體起伏
/// - 頭頂緩緩飄出的 Zzz 符號與夜空微弱閃爍星點
/// - 點擊貓頭鷹時觸發耳朵羽毛晃動、翅膀微振與輕柔觸覺回饋
struct SleepingOwlView: View {
    var isMenuExpanded: Bool = false
    var onTapOwl: () -> Void
    
    @State private var pokeBounce: Bool = false
    @State private var earTwitchAngle: Double = 0
    @State private var wingFlutterOffset: CGFloat = 0
    @State private var showCozyBubble: Bool = false
    
    // 預設夜空星點座標與閃爍相位
    private struct StarData: Identifiable {
        let id: Int
        let xRatio: CGFloat
        let yRatio: CGFloat
        let size: CGFloat
        let speed: Double
        let phase: Double
    }
    
    private let stars: [StarData] = [
        StarData(id: 0, xRatio: 0.14, yRatio: 0.18, size: 3.5, speed: 1.4, phase: 0.2),
        StarData(id: 1, xRatio: 0.84, yRatio: 0.15, size: 4.0, speed: 1.1, phase: 1.5),
        StarData(id: 2, xRatio: 0.22, yRatio: 0.42, size: 2.5, speed: 1.8, phase: 2.7),
        StarData(id: 3, xRatio: 0.88, yRatio: 0.48, size: 3.0, speed: 1.3, phase: 3.8),
        StarData(id: 4, xRatio: 0.10, yRatio: 0.68, size: 3.0, speed: 1.6, phase: 4.5),
        StarData(id: 5, xRatio: 0.78, yRatio: 0.72, size: 2.5, speed: 2.0, phase: 0.9),
        StarData(id: 6, xRatio: 0.48, yRatio: 0.08, size: 3.2, speed: 1.2, phase: 2.1)
    ]
    
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let now = timeline.date.timeIntervalSinceReferenceDate
            // 4-4 呼吸週期（4 秒吸氣、4 秒吐氣，共 8 秒一循環）
            // breathProgress 介於 0.0（吐氣底點）~ 1.0（吸氣頂點）
            let cycleSeconds = 8.0
            let phaseInCycle = now.truncatingRemainder(dividingBy: cycleSeconds) / cycleSeconds
            let breathProgress = CGFloat(0.5 - 0.5 * cos(phaseInCycle * 2.0 * .pi))
            let isInhaling = phaseInCycle < 0.5
            
            ZStack {
                // 1. 夜空閃爍星點
                GeometryReader { geo in
                    ForEach(stars) { star in
                        let twinkle = 0.25 + 0.55 * (0.5 + 0.5 * sin(now * star.speed + star.phase))
                        Circle()
                            .fill(SleepTheme.moonGlow.opacity(twinkle))
                            .frame(width: star.size, height: star.size)
                            .blur(radius: 0.4)
                            .position(
                                x: geo.size.width * star.xRatio,
                                y: geo.size.height * star.yRatio
                            )
                    }
                }
                
                // 2. 4-4 助眠呼吸光暈環（隨呼吸柔和擴張與收斂）
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                SleepTheme.lavender.opacity(0.16 + 0.10 * Double(breathProgress)),
                                SleepTheme.calmTeal.opacity(0.08 + 0.06 * Double(breathProgress)),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 20,
                            endRadius: 135
                        )
                    )
                    .frame(width: 260, height: 260)
                    .scaleEffect(0.88 + 0.18 * breathProgress)
                
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [
                                SleepTheme.moonGlow.opacity(0.22 * Double(breathProgress)),
                                SleepTheme.calmTeal.opacity(0.12 * Double(breathProgress))
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.2
                    )
                    .frame(width: 200, height: 200)
                    .scaleEffect(0.90 + 0.14 * breathProgress)
                
                // 3. 飄浮的 Zzz 睡眠符號
                floatingZzzLayer(time: now)
                    .offset(x: 46, y: -76)
                
                // 4. 彎月與樹枝底座 + 熟睡貓頭鷹主體
                ZStack {
                    // 新月光暈底座
                    CrescentMoonPerchShape()
                        .fill(
                            LinearGradient(
                                colors: [
                                    SleepTheme.moonGlow.opacity(0.85),
                                    SleepTheme.accent.opacity(0.65)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 190, height: 150)
                        .offset(x: -10, y: 28)
                        .shadow(color: SleepTheme.accent.opacity(0.22), radius: 14, x: 0, y: 6)
                    
                    // 貓頭鷹身體與五官（隨 4-4 呼吸起伏）
                    owlCharacter(breathProgress: breathProgress)
                        .offset(y: -4 * breathProgress)
                }
                .scaleEffect(pokeBounce ? 1.05 : 1.0)
                
                // 5. 點擊時的溫馨微回饋氣泡（短暫浮現）
                if showCozyBubble {
                    HStack(spacing: 4) {
                        Image(systemName: "moon.zzz.fill")
                            .font(.system(size: 11))
                        Text("呼嚕...好夢中")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundColor(SleepTheme.moonGlow)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(SleepTheme.surfaceSecondary.opacity(0.92))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(SleepTheme.accent.opacity(0.35), lineWidth: 1)
                    )
                    .offset(y: -118)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
                }
                
                // 6. 底部極簡 4-4 呼吸節律微提示
                VStack(spacing: 4) {
                    Spacer()
                    HStack(spacing: 6) {
                        Circle()
                            .fill(isInhaling ? SleepTheme.calmTeal : SleepTheme.lavender)
                            .frame(width: 5, height: 5)
                            .opacity(0.75)
                        Text(isInhaling ? "緩慢吸氣 4 秒..." : "輕柔吐氣 4 秒...")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(SleepTheme.textTertiary)
                    }
                    .padding(.top, 8)
                }
            }
            .frame(width: 280, height: 270)
            .contentShape(Rectangle())
            .onTapGesture {
                triggerOwlPokeInteraction()
                onTapOwl()
            }
        }
    }
    
    // MARK: - 貓頭鷹幾何插畫主體
    
    private func owlCharacter(breathProgress: CGFloat) -> some View {
        let bodyScaleY = 1.0 + 0.045 * breathProgress
        let bodyScaleX = 1.0 + 0.030 * breathProgress
        
        return ZStack {
            // 1. 左耳羽簇 (Left Ear Tuft)
            OwlEarTuftShape(isLeft: true)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "3B4A6B"), Color(hex: "25304A")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 28, height: 34)
                .rotationEffect(.degrees(-earTwitchAngle), anchor: .bottomTrailing)
                .offset(x: -36, y: -54)
            
            // 2. 右耳羽簇 (Right Ear Tuft)
            OwlEarTuftShape(isLeft: false)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "3B4A6B"), Color(hex: "25304A")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 28, height: 34)
                .rotationEffect(.degrees(earTwitchAngle), anchor: .bottomLeading)
                .offset(x: 36, y: -54)
            
            // 3. 圓潤主身軀 (Owl Body)
            Capsule(style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: "344263"),
                            Color(hex: "1E273D")
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 108, height: 122)
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(SleepTheme.moonGlow.opacity(0.18), lineWidth: 1.2)
                )
                .scaleEffect(x: bodyScaleX, y: bodyScaleY, anchor: .bottom)
            
            // 4. 蓬鬆胸腹羽毛與呼吸起伏 (Chest Plumage)
            Ellipse()
                .fill(
                    LinearGradient(
                        colors: [
                            SleepTheme.moonGlow.opacity(0.90),
                            Color(hex: "D2C49E").opacity(0.82)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 72, height: 68)
                .scaleEffect(1.0 + 0.055 * breathProgress)
                .offset(y: 19)
            
            // 胸口羽毛鱗紋 (Feather Scallops)
            VStack(spacing: 7) {
                HStack(spacing: 8) {
                    FeatherArcShape().stroke(Color(hex: "5E5343").opacity(0.45), lineWidth: 1.6).frame(width: 12, height: 6)
                    FeatherArcShape().stroke(Color(hex: "5E5343").opacity(0.45), lineWidth: 1.6).frame(width: 12, height: 6)
                    FeatherArcShape().stroke(Color(hex: "5E5343").opacity(0.45), lineWidth: 1.6).frame(width: 12, height: 6)
                }
                HStack(spacing: 10) {
                    FeatherArcShape().stroke(Color(hex: "5E5343").opacity(0.40), lineWidth: 1.6).frame(width: 12, height: 6)
                    FeatherArcShape().stroke(Color(hex: "5E5343").opacity(0.40), lineWidth: 1.6).frame(width: 12, height: 6)
                }
            }
            .scaleEffect(1.0 + 0.06 * breathProgress)
            .offset(y: 18)
            
            // 5. 雙眼臉盤 (Facial Disc - 雙圓交疊)
            HStack(spacing: -8) {
                Circle()
                    .fill(Color(hex: "EAE0C8").opacity(0.92))
                    .frame(width: 48, height: 48)
                Circle()
                    .fill(Color(hex: "EAE0C8").opacity(0.92))
                    .frame(width: 48, height: 48)
            }
            .shadow(color: Color.black.opacity(0.18), radius: 3, x: 0, y: 2)
            .offset(y: -20)
            
            // 6. 熟睡彎彎閉眼線條與柔和腮紅
            HStack(spacing: 18) {
                ClosedSleepEyeShape()
                    .stroke(Color(hex: "232B3E"), style: StrokeStyle(lineWidth: 2.6, lineCap: .round))
                    .frame(width: 20, height: 9)
                
                ClosedSleepEyeShape()
                    .stroke(Color(hex: "232B3E"), style: StrokeStyle(lineWidth: 2.6, lineCap: .round))
                    .frame(width: 20, height: 9)
            }
            .offset(y: -20)
            
            // 溫柔雙頰微紅暈
            HStack(spacing: 42) {
                Ellipse()
                    .fill(SleepTheme.warning.opacity(0.32))
                    .frame(width: 12, height: 7)
                Ellipse()
                    .fill(SleepTheme.warning.opacity(0.32))
                    .frame(width: 12, height: 7)
            }
            .offset(y: -12)
            
            // 7. 金色小鳥喙 (Beak)
            OwlBeakShape()
                .fill(SleepTheme.accent)
                .frame(width: 13, height: 14)
                .offset(y: -12)
            
            // 8. 左右收攏的翅膀（隨呼吸與點擊微動）
            OwlWingShape(isLeft: true)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "2B3754"), Color(hex: "182033")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 28, height: 68)
                .rotationEffect(.degrees(Double(breathProgress * 2.5) + Double(wingFlutterOffset)), anchor: .topTrailing)
                .offset(x: -48, y: 10)
            
            OwlWingShape(isLeft: false)
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "2B3754"), Color(hex: "182033")],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 28, height: 68)
                .rotationEffect(.degrees(Double(-breathProgress * 2.5) - Double(wingFlutterOffset)), anchor: .topLeading)
                .offset(x: 48, y: 10)
            
            // 9. 站在新月上的小腳爪 (Owl Feet)
            HStack(spacing: 24) {
                owlFoot
                owlFoot
            }
            .offset(y: 58)
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
    
    // MARK: - 飄浮 Zzz 睡眠符號層
    
    private func floatingZzzLayer(time: TimeInterval) -> some View {
        ZStack {
            ForEach(0..<3, id: \.self) { index in
                let duration = 4.5
                let delay = Double(index) * 1.5
                let localProgress = ((time + delay).truncatingRemainder(dividingBy: duration)) / duration
                // 由下往上飄移、微幅左右搖擺、先淡入再淡出
                let yOffset = -CGFloat(localProgress) * 58
                let xOffset = CGFloat(localProgress) * 26 + CGFloat(sin(localProgress * .pi * 2)) * 4
                let opacity = sin(localProgress * .pi) * 0.85
                let scale = 0.72 + CGFloat(localProgress) * 0.45
                
                Text("Z")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(index % 2 == 0 ? SleepTheme.moonGlow : SleepTheme.lavender)
                    .scaleEffect(scale)
                    .opacity(opacity)
                    .offset(x: xOffset, y: yOffset)
            }
        }
    }
    
    // MARK: - 點擊貓頭鷹微互動
    
    private func triggerOwlPokeInteraction() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        #endif
        
        withAnimation(.spring(response: 0.25, dampingFraction: 0.45)) {
            pokeBounce = true
            earTwitchAngle = 14
            wingFlutterOffset = 10
            showCozyBubble = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.55)) {
                pokeBounce = false
                earTwitchAngle = 0
                wingFlutterOffset = 0
            }
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation(.easeOut(duration: 0.3)) {
                showCozyBubble = false
            }
        }
    }
}

// MARK: - 自訂幾何向量形狀 (Custom Shapes)

/// 安心閉眼弧線
private struct ClosedSleepEyeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.3))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.3),
            control: CGPoint(x: rect.midX, y: rect.maxY + rect.height * 0.25)
        )
        return path
    }
}

/// 胸口羽毛弧紋
private struct FeatherArcShape: Shape {
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

/// 貓頭鷹菱形小鳥喙
private struct OwlBeakShape: Shape {
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

/// 貓頭鷹耳羽簇
private struct OwlEarTuftShape: Shape {
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

/// 貓頭鷹收攏雙翅
private struct OwlWingShape: Shape {
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
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
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

/// 貓頭鷹棲息的溫柔彎月底座
private struct CrescentMoonPerchShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let start = CGPoint(x: rect.minX + 8, y: rect.midY + 6)
        let end = CGPoint(x: rect.maxX - 4, y: rect.midY - 8)
        
        path.move(to: start)
        // 外弧（彎月下緣）
        path.addQuadCurve(
            to: end,
            control: CGPoint(x: rect.midX + 6, y: rect.maxY + 26)
        )
        // 內弧（彎月上緣，供貓頭鷹棲息）
        path.addQuadCurve(
            to: start,
            control: CGPoint(x: rect.midX + 2, y: rect.maxY - 6)
        )
        path.closeSubpath()
        return path
    }
}

