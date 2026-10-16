import SwiftUI

/// 懸浮全域迷你音訊播放器 (播放助眠白噪音聲景時常駐於底部導覽列上方)
struct MiniPlayerBar: View {
    @ObservedObject var soundManager: SoundManager
    
    var body: some View {
        if let sound = soundManager.currentSound {
            HStack(spacing: 12) {
                // 1. 左側聲景圖示與呼吸動畫
                ZStack {
                    Circle()
                        .fill(SleepTheme.lavender.opacity(0.18))
                        .frame(width: 38, height: 38)
                    
                    Image(systemName: sound.icon)
                        .font(.system(size: 16))
                        .foregroundColor(soundManager.isPlaying ? SleepTheme.accent : SleepTheme.textSecondary)
                }
                
                // 2. 音訊名稱與即時狀態/倒數計時
                VStack(alignment: .leading, spacing: 2) {
                    Text(sound.rawValue)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SleepTheme.textPrimary)
                        .lineLimit(1)
                    
                    if soundManager.activeTimerOption != .off {
                        HStack(spacing: 3) {
                            Image(systemName: "timer")
                                .font(.system(size: 10))
                            Text(soundManager.remainingTimerFormatted)
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                        }
                        .foregroundColor(SleepTheme.accent)
                    } else {
                        Text(soundManager.isPlaying ? "助眠播放中" : "已暫停")
                            .font(.system(size: 11))
                            .foregroundColor(soundManager.isPlaying ? SleepTheme.calmTeal : SleepTheme.textTertiary)
                    }
                }
                
                Spacer(minLength: 4)
                
                // 3. 控制按鈕組
                HStack(spacing: 10) {
                    // 上一首
                    Button {
                        soundManager.playPrevious()
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    } label: {
                        Image(systemName: "backward.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(SleepTheme.textSecondary)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    
                    // 播放 / 暫停 (突顯按鈕)
                    Button {
                        soundManager.togglePlayPause()
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    } label: {
                        ZStack {
                            Circle()
                                .fill(SleepTheme.accent)
                                .frame(width: 34, height: 34)
                            
                            Image(systemName: soundManager.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(Color(hex: "0B0E14"))
                        }
                    }
                    .buttonStyle(.plain)
                    
                    // 下一首
                    Button {
                        soundManager.playNext()
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    } label: {
                        Image(systemName: "forward.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(SleepTheme.textSecondary)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    
                    // 計時器選單 (5 / 15 / 30 分鐘 / 內容結束時停止 / 關閉)
                    Menu {
                        Section("定時關閉助眠聲景") {
                            Button {
                                soundManager.setSleepTimer(.minutes(5))
                            } label: {
                                timerMenuItemLabel(title: "5 分鐘", isSelected: soundManager.activeTimerOption == .minutes(5))
                            }
                            
                            Button {
                                soundManager.setSleepTimer(.minutes(15))
                            } label: {
                                timerMenuItemLabel(title: "15 分鐘", isSelected: soundManager.activeTimerOption == .minutes(15))
                            }
                            
                            Button {
                                soundManager.setSleepTimer(.minutes(30))
                            } label: {
                                timerMenuItemLabel(title: "30 分鐘", isSelected: soundManager.activeTimerOption == .minutes(30))
                            }
                            
                            Button {
                                soundManager.setSleepTimer(.endOfTrack)
                            } label: {
                                timerMenuItemLabel(title: "內容結束時停止播放", isSelected: soundManager.activeTimerOption == .endOfTrack)
                            }
                        }
                        
                        if soundManager.activeTimerOption != .off {
                            Section {
                                Button(role: .destructive) {
                                    soundManager.setSleepTimer(.off)
                                } label: {
                                    Label("關閉定時器", systemImage: "timer.slash")
                                }
                            }
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .fill(soundManager.activeTimerOption != .off ? SleepTheme.accent.opacity(0.18) : SleepTheme.surface)
                                .frame(width: 28, height: 28)
                            
                            Image(systemName: soundManager.activeTimerOption != .off ? "timer.circle.fill" : "timer")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(soundManager.activeTimerOption != .off ? SleepTheme.accent : SleepTheme.textSecondary)
                        }
                    }
                    
                    // 完全停止按鈕 (關閉迷你播放器)
                    Button {
                        soundManager.stop()
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 17))
                            .foregroundColor(SleepTheme.textTertiary)
                            .frame(width: 26, height: 26)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(hex: "131822"))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(SleepTheme.border.opacity(0.7), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.45), radius: 14, x: 0, y: 6)
        }
    }
    
    @ViewBuilder
    private func timerMenuItemLabel(title: String, isSelected: Bool) -> some View {
        if isSelected {
            Label(title, systemImage: "checkmark")
        } else {
            Text(title)
        }
    }
}

