import SwiftUI

/// 彈窗目的類型 (編輯現有記錄 或 為某日新增補登)
enum HistorySheetDestination: Identifiable {
    case edit(SleepLog)
    case new(Date)
    
    var id: String {
        switch self {
        case .edit(let log):
            return "edit-\(log.id)"
        case .new(let date):
            return "new-\(date.timeIntervalSince1970)"
        }
    }
}

/// 睡眠趨勢與歷史分頁視圖 (含互動式週/月日曆、置頂連動滾動、點擊修改編輯、無記錄點擊補登)
struct HistoryView: View {
    @ObservedObject var store: SleepStore
    @State private var selectedDate: Date = Date()
    @State private var activeSheet: HistorySheetDestination? = nil
    
    private let calendar = Calendar.current
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                VStack(spacing: 12) {
                    // 1. 固定在頂部的互動式日曆 (支援月/週切換、左右滑動換月、Today返回、無記錄點擊補登)
                    SleepCalendarView(
                        selectedDate: $selectedDate,
                        store: store,
                        onSelectDateWithoutLog: { date in
                            activeSheet = .new(date)
                        }
                    )
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
                    
                    // 2. 睡眠紀錄串流列表 (日曆選中日期自動移至第一列顯示，保留時間先後順序)
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: 10) {
                                if store.sleepHistory.isEmpty {
                                    emptyPlaceholder
                                } else {
                                    ForEach(store.sleepHistory) { log in
                                        let isSelectedDay = calendar.isDate(log.date, inSameDayAs: selectedDate)
                                        
                                        Button {
                                            activeSheet = .edit(log)
                                        } label: {
                                            historyCard(log: log, isHighlight: isSelectedDay)
                                        }
                                        .buttonStyle(.plain)
                                        .id(log.id)
                                    }
                                    
                                    // 歷史整體統計指標
                                    statisticsRow
                                        .padding(.top, 8)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 30)
                        }
                        .onChange(of: selectedDate) { _, newDate in
                            if let matchingLog = store.log(for: newDate) {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    proxy.scrollTo(matchingLog.id, anchor: .top)
                                }
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
    
    // MARK: - 統計指標卡片
    private var statisticsRow: some View {
        HStack(spacing: 10) {
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
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(size: 11))
                .foregroundColor(SleepTheme.textTertiary)
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    
    // MARK: - 單筆歷史卡片 (支援外框高亮、點擊進入修改)
    private func historyCard(log: SleepLog, isHighlight: Bool) -> some View {
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
