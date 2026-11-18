import SwiftUI

/// 彈窗目的類型 (編輯現有記錄、為某日新增補登、或查看睡眠統計)
enum HistorySheetDestination: Identifiable {
    case edit(SleepLog)
    case new(Date)
    case statistics
    
    var id: String {
        switch self {
        case .edit(let log):
            return "edit-\(log.id)"
        case .new(let date):
            return "new-\(date.timeIntervalSince1970)"
        case .statistics:
            return "statistics"
        }
    }
}

/// 睡眠趨勢與歷史分頁視圖 (含互動式週/月日曆、置頂連動滾動、點擊修改編輯、無記錄點擊補登)
struct HistoryView: View {
    @ObservedObject var store: SleepStore
    @State private var selectedDate: Date = Date()
    @State private var activeSheet: HistorySheetDestination? = nil
    @State private var shouldScrollListToSelection: Bool = true
    
    private let calendar = Calendar.current
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollViewReader { proxy in
                    VStack(spacing: 12) {
                        // 1. 固定在頂部的互動式日曆 (支援月/週切換、左上角統計、Today返回、無記錄點擊補登)
                        SleepCalendarView(
                            selectedDate: $selectedDate,
                            store: store,
                            onSelectDateWithoutLog: { date in
                                activeSheet = .new(date)
                            },
                            onShowStatistics: {
                                activeSheet = .statistics
                            },
                            onTapToday: {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                    proxy.scrollTo("history-top-anchor", anchor: .top)
                                }
                            }
                        )
                        .padding(.horizontal, 16)
                        .padding(.top, 6)
                        
                        // 2. 睡眠紀錄串流列表 (日曆選中日期自動移至第一列顯示，保留時間先後順序)
                        ScrollView {
                            VStack(spacing: 10) {
                                // 頂部捲動定位點 (點擊 Today 時平滑捲動至此)
                                Color.clear
                                    .frame(height: 0)
                                    .id("history-top-anchor")
                                
                                if store.sleepHistory.isEmpty {
                                    emptyPlaceholder
                                } else {
                                    ForEach(store.sleepHistory) { log in
                                        let isSelectedDay = calendar.isDate(log.date, inSameDayAs: selectedDate)
                                        
                                        Button {
                                            if isSelectedDay {
                                                // 已高亮選取 -> 再次點擊進入編輯睡眠記錄視窗
                                                activeSheet = .edit(log)
                                            } else {
                                                // 尚未選取 -> 先高亮選取該筆記錄，並連動上方行事曆移動至對應日期
                                                shouldScrollListToSelection = false
                                                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                                    selectedDate = log.date
                                                }
                                            }
                                        } label: {
                                            historyCard(log: log, isHighlight: isSelectedDay)
                                        }
                                        .buttonStyle(.plain)
                                        .id(log.id)
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 30)
                        }
                        .onChange(of: selectedDate) { _, newDate in
                            if shouldScrollListToSelection {
                                if let matchingLog = store.log(for: newDate) {
                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        proxy.scrollTo(matchingLog.id, anchor: .top)
                                    }
                                }
                            } else {
                                // 列表手動點選觸發，重置標誌以利後續日曆換日滾動
                                shouldScrollListToSelection = true
                            }
                        }
                        .onChange(of: store.sleepHistory.count) { _, _ in
                            if let matchingLog = store.log(for: selectedDate) {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    proxy.scrollTo(matchingLog.id, anchor: .top)
                                }
                            }
                        }
                    }
                }
            }
            .navigationBarHidden(true) // 移除頂部標題佔位，保留最大視覺空間給日曆與列表
            .sheet(item: $activeSheet) { destination in
                switch destination {
                case .edit(let log):
                    EditSleepLogSheet(store: store, log: log)
                case .new(let date):
                    EditSleepLogSheet(store: store, newLogDate: date)
                case .statistics:
                    SleepStatsSheet(store: store)
                }
            }
        }
    }
    
    // MARK: - 空白記錄提示
    private var emptyPlaceholder: some View {
        VStack(spacing: 8) {
            Image(systemName: "moon.zzz")
                .font(.system(size: 28))
                .foregroundColor(SleepTheme.textTertiary)
            Text("尚無睡眠紀錄，明早完成打卡後將在此呈現。")
                .font(.system(size: 13))
                .foregroundColor(SleepTheme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    

    
    // MARK: - 單筆歷史卡片 (支援外框高亮、點擊進入修改)
    private func historyCard(log: SleepLog, isHighlight: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 6) {
                Text(dateFormatter.string(from: log.date) + " 晚")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                if log.isLateNight(fallbackTarget: store.alarmSetting.targetBedtime) {
                    Text("熬夜晚睡")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(SleepTheme.warning)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(SleepTheme.warning.opacity(0.16))
                        .clipShape(Capsule())
                }
                
                if log.isSnoozed {
                    Text("賴床")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(SleepTheme.lavender)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(SleepTheme.lavender.opacity(0.16))
                        .clipShape(Capsule())
                }
                
                Spacer()
                
                HStack(spacing: 6) {
                    Text(log.rating.emoji)
                        .font(.system(size: 16))
                    Text(log.rating.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.accent)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.textTertiary)
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
            
            if !log.bedtimeNote.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "moon.fill")
                        .font(.system(size: 10))
                        .foregroundColor(SleepTheme.accent)
                        .padding(.top, 2)
                    Text("睡前：\(log.bedtimeNote)")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SleepTheme.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            
            if !log.note.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "sun.max.fill")
                        .font(.system(size: 10))
                        .foregroundColor(SleepTheme.calmTeal)
                        .padding(.top, 2)
                    Text("晨醒：\(log.note)")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SleepTheme.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(14)
        .background(isHighlight ? SleepTheme.surfaceSecondary : SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isHighlight ? Color(hex: "56B6C2") : SleepTheme.border.opacity(0.3), lineWidth: isHighlight ? 1.5 : 1)
        )
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

// MARK: - 睡眠統計資訊彈窗 (點擊日曆左上角圖示彈出)
struct SleepStatsSheet: View {
    @ObservedObject var store: SleepStore
    @Environment(\.dismiss) private var dismiss
    @State private var showingClearAllAlert: Bool = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        if store.sleepHistory.isEmpty {
                            emptyView
                        } else {
                            // 1. 平均睡眠時長卡片
                            averageDurationCard
                            
                            // 2. 熬夜率與賴床率雙欄指標卡片
                            ratesRow
                            
                            // 3. 起床精神狀態自評 4 大分類分佈
                            ratingBreakdownCard
                            
                            // 4. 危險管理區：清空所有歷史紀錄
                            clearAllDataButton
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
            }
            .navigationTitle("睡眠統計")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SleepTheme.accent)
                }
            }
            .alert("確定要清空所有歷史紀錄嗎？", isPresented: $showingClearAllAlert) {
                Button("取消", role: .cancel) { }
                Button("全部刪除", role: .destructive) {
                    store.clearAllHistory()
                    dismiss()
                }
            } message: {
                Text("此操作將永久刪除全部共 \(store.sleepHistory.count) 晚睡眠紀錄，統計數據將重置且無法復原。")
            }
        }
    }
    
    // MARK: - 清空所有歷史紀錄按鈕
    private var clearAllDataButton: some View {
        Button(role: .destructive) {
            showingClearAllAlert = true
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "trash")
                    .font(.system(size: 13, weight: .semibold))
                Text("清空所有歷史紀錄")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundColor(SleepTheme.warning)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(SleepTheme.warning.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(SleepTheme.warning.opacity(0.3), lineWidth: 1)
            )
        }
        .padding(.top, 6)
        .padding(.bottom, 10)
    }
    
    // MARK: - 空白狀態提示
    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 40))
                .foregroundColor(SleepTheme.textTertiary)
                .padding(.top, 40)
            
            Text("尚無足夠的睡眠紀錄")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(SleepTheme.textSecondary)
            
            Text("完成早晨打卡後，系統將自動統計您的平均睡眠時長、起床身心狀態佔比與熬夜/賴床率。")
                .font(.system(size: 13))
                .foregroundColor(SleepTheme.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // MARK: - 平均睡眠時長卡片
    private var averageDurationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(SleepTheme.calmTeal.opacity(0.18))
                        .frame(width: 32, height: 32)
                    Image(systemName: "clock.fill")
                        .font(.system(size: 14))
                        .foregroundColor(SleepTheme.calmTeal)
                }
                
                Text("平均睡眠時長")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                Spacer()
                
                Text("累計 \(store.sleepHistory.count) 晚紀錄")
                    .font(.system(size: 12))
                    .foregroundColor(SleepTheme.textTertiary)
            }
            
            Divider().background(SleepTheme.border.opacity(0.5))
            
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text(String(format: "%.1f", store.averageSleepHours))
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .foregroundColor(SleepTheme.calmTeal)
                
                Text("小時 / 晚")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(SleepTheme.textSecondary)
                
                Spacer()
                
                let hours = Int(store.averageSleepHours)
                let minutes = Int((store.averageSleepHours - Double(hours)) * 60)
                Text("約 \(hours) 小時 \(minutes) 分")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(SleepTheme.surfaceSecondary)
                    .clipShape(Capsule())
            }
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(SleepTheme.border.opacity(0.5), lineWidth: 1)
        )
    }
    
    // MARK: - 熬夜率與賴床率雙欄卡片
    private var ratesRow: some View {
        HStack(spacing: 12) {
            // 熬夜率
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.warning)
                    Text("熬夜率")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                
                Text(String(format: "%.0f%%", store.lateNightRate))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(SleepTheme.warning)
                
                Text("\(store.lateNightCount) 次晚於就寢目標")
                    .font(.system(size: 11))
                    .foregroundColor(SleepTheme.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(SleepTheme.border.opacity(0.5), lineWidth: 1)
            )
            
            // 賴床率
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "alarm.waves.left.and.right.fill")
                        .font(.system(size: 13))
                        .foregroundColor(SleepTheme.lavender)
                    Text("賴床率")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.textSecondary)
                }
                
                Text(String(format: "%.0f%%", store.snoozeRate))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(SleepTheme.lavender)
                
                Text("\(store.snoozeCount) 次鬧鐘後賴床")
                    .font(.system(size: 11))
                    .foregroundColor(SleepTheme.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(SleepTheme.border.opacity(0.5), lineWidth: 1)
            )
        }
    }
    
    // MARK: - 自評 4 個狀態百分比卡片
    private var ratingBreakdownCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("起床自評分佈")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                Spacer()
                
                Text("4 種精神感受佔比")
                    .font(.system(size: 12))
                    .foregroundColor(SleepTheme.textTertiary)
            }
            
            Divider().background(SleepTheme.border.opacity(0.5))
            
            VStack(spacing: 14) {
                ForEach(SleepRating.allCases) { rating in
                    let pct = store.ratingPercentage(for: rating)
                    let count = store.ratingCount(for: rating)
                    let tintColor = ratingColor(for: rating)
                    
                    VStack(spacing: 6) {
                        HStack {
                            Text(rating.emoji)
                                .font(.system(size: 16))
                            Text(rating.title)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(SleepTheme.textPrimary)
                            
                            Spacer()
                            
                            Text("\(count) 天")
                                .font(.system(size: 12))
                                .foregroundColor(SleepTheme.textTertiary)
                            
                            Text(String(format: "%.1f%%", pct))
                                .font(.system(size: 14, weight: .bold, design: .rounded))
                                .foregroundColor(tintColor)
                                .frame(width: 54, alignment: .trailing)
                        }
                        
                        // 進度長條圖
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(SleepTheme.surfaceSecondary)
                                    .frame(height: 7)
                                
                                Capsule()
                                    .fill(tintColor)
                                    .frame(width: max(count > 0 ? 6 : 0, geo.size.width * CGFloat(pct / 100.0)), height: 7)
                            }
                        }
                        .frame(height: 7)
                    }
                }
            }
        }
        .padding(16)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(SleepTheme.border.opacity(0.5), lineWidth: 1)
        )
    }
    
    private func ratingColor(for rating: SleepRating) -> Color {
        switch rating {
        case .refreshed:
            return SleepTheme.success
        case .good:
            return SleepTheme.calmTeal
        case .tired:
            return SleepTheme.accent
        case .exhausted:
            return SleepTheme.warning
        }
    }
}

