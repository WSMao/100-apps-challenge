import SwiftUI

/// 全螢幕晨間鬧鐘響鈴互動視窗 (支援持續循環響鈴、起床打卡與賴床貪睡)
struct AlarmRingingView: View {
    @ObservedObject var store: SleepStore
    @ObservedObject var soundManager = SoundManager.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var pulseScale: CGFloat = 1.0
    @State private var showingSnoozeToast: Bool = false
    
    var body: some View {
        ZStack {
            // 深色晨曦漸層背景
            LinearGradient(
                colors: [
                    Color(hex: "0B0E14"),
                    Color(hex: "1A2333"),
                    Color(hex: "23354C")
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            VStack(spacing: 36) {
                Spacer()
                
                // 動態呼吸光環與太陽鬧鐘圖示
                ZStack {
                    Circle()
                        .fill(SleepTheme.accent.opacity(0.12))
                        .frame(width: 190, height: 190)
                        .scaleEffect(pulseScale)
                    
                    Circle()
                        .fill(SleepTheme.accent.opacity(0.22))
                        .frame(width: 140, height: 140)
                    
                    Image(systemName: "alarm.waves.left.and.right.fill")
                        .font(.system(size: 64))
                        .foregroundColor(SleepTheme.accent)
                }
                .onAppear {
                    withAnimation(
                        .easeInOut(duration: 1.1)
                        .repeatForever(autoreverses: true)
                    ) {
                        pulseScale = 1.25
                    }
                }
                
                // 當前時間與喚醒提示
                VStack(spacing: 8) {
                    Text(currentTimeString)
                        .font(.system(size: 64, weight: .bold, design: .rounded))
                        .foregroundColor(SleepTheme.textPrimary)
                    
                    Text("☀️ 早安！美好的一天開始了")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(SleepTheme.accent)
                    
                    Text("晨間喚醒音樂正在響鈴中，深呼吸伸展一下身體...")
                        .font(.system(size: 14))
                        .foregroundColor(SleepTheme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                
                Spacer()
                
                // 操作按鈕：起床打卡 / 賴床 5 分鐘
                VStack(spacing: 16) {
                    // 1. 關閉鬧鐘並打卡
                    Button {
                        soundManager.stopAlarmMelody()
                        NotificationManager.shared.cancelWakeAlarm()
                        dismiss()
                        // 稍作延遲彈出晨間打卡視窗
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            store.isShowingMorningSheet = true
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 18))
                            Text("關閉鬧鐘並打卡")
                                .font(.system(size: 17, weight: .bold))
                        }
                        .foregroundColor(Color(hex: "0B0E14"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(SleepTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .shadow(color: SleepTheme.accent.opacity(0.3), radius: 10, y: 4)
                    }
                    
                    // 2. 賴床 5 分鐘
                    Button {
                        soundManager.stopAlarmMelody()
                        NotificationManager.shared.scheduleSnoozeAlarm(minutes: 5)
                        dismiss()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "zzz")
                                .font(.system(size: 16))
                            Text("賴床 5 分鐘 (稍後再響)")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .foregroundColor(SleepTheme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 36)
            }
        }
    }
    
    private var currentTimeString: String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: Date())
    }
}

