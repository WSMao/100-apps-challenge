import SwiftUI

/// 睡眠紀錄歷史與規律分析視圖
struct HistoryView: View {
    @ObservedObject var store: SleepStore
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // 1. 三大統計數據卡片
                        statisticsRow
                        
                        // 2. 歷史紀錄列表
                        VStack(alignment: .leading, spacing: 12) {
                            Text("近期睡眠紀錄")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(SleepTheme.textPrimary)
                            
                            if store.sleepHistory.isEmpty {
                                Text("尚無睡眠紀錄，明早完成打卡後將在此呈現。")
                                    .font(.system(size: 13))
                                    .foregroundColor(SleepTheme.textTertiary)
                                    .padding(.vertical, 20)
                            } else {
                                ForEach(store.sleepHistory) { log in
                                    historyCard(log: log)
                                }
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("睡眠趨勢與歷史")
        }
    }
    
    // MARK: - 統計指標卡片
    private var statisticsRow: some View {
        HStack(spacing: 12) {
            statBox(
                title: "平均時長",
                value: String(format: "%.1f 小時", store.averageSleepHours),
                color: SleepTheme.calmTeal
            )
            
            statBox(
                title: "平均評分",
                value: "\(store.averageScore) 分",
                color: SleepTheme.accent
            )
            
            statBox(
                title: "賴床頻率",
                value: String(format: "%.0f%%", store.snoozeRate),
                color: SleepTheme.warning
            )
        }
    }
    
    private func statBox(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11))
                .foregroundColor(SleepTheme.textTertiary)
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
    
    // MARK: - 單筆歷史卡片
    private func historyCard(log: SleepLog) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(dateFormatter.string(from: log.date))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                Spacer()
                
                HStack(spacing: 6) {
                    Text(log.rating.emoji)
                        .font(.system(size: 16))
                    Text(log.rating.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.accent)
                }
            }
            
            Divider().background(SleepTheme.border.opacity(0.5))
            
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "clock")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textTertiary)
                    Text("\(timeFormatter.string(from: log.bedtime)) → \(timeFormatter.string(from: log.wakeTime))")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                
                Spacer()
                
                Text(log.durationFormatted)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(SleepTheme.success)
            }
            
            if log.isSnoozed {
                HStack(spacing: 4) {
                    Image(systemName: "alarm")
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.warning)
                    Text("賴床 \(log.snoozeMinutes) 分鐘")
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.warning)
                }
            }
            
            if !log.note.isEmpty {
                Text("“\(log.note)”")
                    .font(.system(size: 12))
                    .foregroundColor(SleepTheme.textSecondary)
                    .italic()
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SleepTheme.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(14)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
    
    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "M 月 d 日 E"
        return f
    }
    
    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }
}

