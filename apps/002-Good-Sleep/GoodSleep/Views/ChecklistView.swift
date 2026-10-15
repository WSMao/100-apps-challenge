import SwiftUI

/// 睡前避坑與儀式檢核清單視圖 (含助眠聲景播放器)
struct ChecklistView: View {
    @ObservedObject var store: SleepStore
    @StateObject private var soundManager = SoundManager.shared
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        // 1. 頂部助眠聲景混音器
                        soundscapeCard
                        
                        // 2. 檢核項目分組列表
                        ForEach(ChecklistItem.Category.allCases, id: \.self) { category in
                            let items = store.checklist.filter { $0.category == category }
                            if !items.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Text(category.rawValue)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundColor(SleepTheme.accent)
                                        Spacer()
                                        Text("\(items.filter { $0.isCompleted }.count)/\(items.count)")
                                            .font(.system(size: 12))
                                            .foregroundColor(SleepTheme.textTertiary)
                                    }
                                    
                                    VStack(spacing: 8) {
                                        ForEach(items) { item in
                                            ChecklistRow(item: item) {
                                                store.toggleChecklistItem(id: item.id)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("睡前避坑與引導")
        }
    }
    
    // MARK: - 助眠聲景迷你卡片
    private var soundscapeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("🌙 助眠微音效 (低頻白噪音)")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(SleepTheme.textPrimary)
                    Text("遮蔽突發雜音，營造放鬆避風港")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textTertiary)
                }
                Spacer()
                if soundManager.isPlaying {
                    Button("停止播放") {
                        soundManager.stop()
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(SleepTheme.warning)
                }
            }
            
            // 四種音效快速切換按鈕
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
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(isCurrent ? SleepTheme.accent : SleepTheme.textPrimary)
                                Text(isCurrent ? "播放中..." : "點擊播放")
                                    .font(.system(size: 10))
                                    .foregroundColor(isCurrent ? SleepTheme.success : SleepTheme.textTertiary)
                            }
                            Spacer()
                        }
                        .padding(10)
                        .background(isCurrent ? SleepTheme.accent.opacity(0.12) : SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(isCurrent ? SleepTheme.accent.opacity(0.4) : Color.clear, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

