import SwiftUI

/// 今日主畫面：夜間倒數、晨間報告與快速打卡入口
struct TodayView: View {
    @ObservedObject var store: SleepStore
    @State private var showingCheckInSheet: Bool = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // 1. 今夜就寢目標與時鐘氛圍卡片
                        bedtimeHeroCard
                        
                        // 2. 今日晨間報告卡片 (如果今日已打卡)
                        if let log = store.todayLog {
                            morningReportCard(log: log)
                        } else {
                            unrecordedCard
                        }
                        
                        // 3. 今日避坑進度精簡摘要
                        checklistProgressCard
                        
                        // 4. 助眠科學微知識
                        sleepTipCard
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 10)
                    .padding(.bottom, 30)
                }
            }
            .navigationTitle("好好睡覺")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showingCheckInSheet) {
                MorningCheckInSheet(store: store)
            }
        }
    }
    
    // MARK: - 子組件視圖
    
    private var bedtimeHeroCard: some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("今晚目標就寢")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.textSecondary)
                    
                    Text(timeFormatter.string(from: store.alarmSetting.targetBedtime))
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundColor(SleepTheme.moonGlow)
                }
                
                Spacer()
                
                // 月亮光環視覺
                ZStack {
                    Circle()
                        .fill(SleepTheme.lavender.opacity(0.15))
                        .frame(width: 64, height: 64)
                    
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 28))
                        .foregroundColor(SleepTheme.accent)
                }
            }
            
            Divider().background(SleepTheme.border.opacity(0.6))
            
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "alarm.fill")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.accent)
                    Text("預設明早 \(timeFormatter.string(from: store.alarmSetting.targetWakeTime)) 喚醒")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                
                Spacer()
                
                Text("預計睡眠 \(String(format: "%.1f", store.alarmSetting.plannedSleepHours)) 小時")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.success)
            }
        }
        .padding(20)
        .background(SleepTheme.moonCardGradient)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(SleepTheme.border.opacity(0.6), lineWidth: 1)
        )
    }
    
    private func morningReportCard(log: SleepLog) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("☀️ 今日晨間報告")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                Spacer()
                
                Text(log.rating.emoji)
                    .font(.system(size: 24))
            }
            
            HStack(spacing: 12) {
                // 睡眠時長
                metricBox(title: "實際時長", value: log.durationFormatted, icon: "clock.fill", color: SleepTheme.calmTeal)
                // 睡眠品質分
                metricBox(title: "品質健康分", value: "\(log.calculatedScore) 分", icon: "sparkles", color: SleepTheme.accent)
            }
            
            if log.isSnoozed {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.warning)
                    Text("今晨賴床了 \(log.snoozeMinutes) 分鐘，稍微拖慢了大腦開機速度")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.warning)
                }
                .padding(.top, 4)
            }
            
            if !log.note.isEmpty {
                Text("“\(log.note)”")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundColor(SleepTheme.textSecondary)
                    .italic()
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SleepTheme.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(18)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
    
    private var unrecordedCard: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("今早尚未晨間復盤")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(SleepTheme.textPrimary)
                    Text("醒來花 30 秒記錄狀態，給大腦一個正向啟動儀式。")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                Spacer()
                Button {
                    showingCheckInSheet = true
                } label: {
                    Text("起床打卡")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(hex: "0B0E14"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(SleepTheme.accent)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    private var checklistProgressCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("睡前避坑與儀式")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                Spacer()
                Text("\(store.completedChecklistCount) / \(store.checklist.count) 項完成")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.accent)
            }
            
            // 進度條
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(SleepTheme.surfaceSecondary)
                        .frame(height: 8)
                    
                    Capsule()
                        .fill(LinearGradient(colors: [SleepTheme.accent, SleepTheme.success], startPoint: .leading, endPoint: .trailing))
                        .frame(width: proxy.size.width * CGFloat(store.completedChecklistCount) / CGFloat(max(1, store.checklist.count)), height: 8)
                }
            }
            .frame(height: 8)
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    private var sleepTipCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 13))
                    .foregroundColor(SleepTheme.accent)
                Text("睡眠小知識：90 分鐘週期理論")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.accent)
            }
            
            Text("人體的一個完整睡眠週期約為 90 分鐘（淺睡 ➔ 深睡 ➔ 快速動眼期 REM）。若在週期結束時被喚醒，大腦最為清醒不易昏沈。建議將目標睡眠時間設定為 7.5 小時 (5 個週期) 或 9 小時 (6 個週期)。")
                .font(.system(size: 12))
                .foregroundColor(SleepTheme.textSecondary)
                .lineSpacing(3)
        }
        .padding(16)
        .background(SleepTheme.surfaceSecondary.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    private func metricBox(title: String, value: String, icon: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 11))
                    .foregroundColor(SleepTheme.textTertiary)
                Text(value)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(SleepTheme.textPrimary)
            }
            Spacer()
        }
        .padding(12)
        .background(SleepTheme.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    
    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }
}

