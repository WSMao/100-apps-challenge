import SwiftUI

/// 睡眠日曆元件 (支援月視圖 / 週視圖滑動切換、左/右滑動換月、Today快速返回標籤、年月快選、無記錄點擊補登)
struct SleepCalendarView: View {
    @Binding var selectedDate: Date
    @ObservedObject var store: SleepStore
    var onSelectDateWithoutLog: ((Date) -> Void)? = nil
    var onShowStatistics: (() -> Void)? = nil
    var onTapToday: (() -> Void)? = nil
    
    enum CalendarScope {
        case week
        case month
    }
    
    @State private var scope: CalendarScope = .week
    @State private var currentMonth: Date = Date()
    @State private var showingDatePicker: Bool = false
    
    private let calendar = Calendar.current
    private let weekdays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
    
    var body: some View {
        VStack(spacing: 12) {
            // 頂部日期、Today 標籤與快速選擇按鈕
            headerView
            
            // 星期抬頭 (週日 ... 週六)
            weekdayHeaderView
            
            // 日期網格 (月視圖 or 週視圖，支援左右滑動換月/換週，上下滑動收展)
            calendarGridView
            
            // 底部拖拉橫桿 (往上滑收起成週視圖，往下滑展開成月視圖)
            dragHandleBar
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(SleepTheme.border.opacity(0.5), lineWidth: 1)
        )
        .gesture(
            DragGesture(minimumDistance: 25)
                .onEnded { value in
                    handleDragEnded(value)
                }
        )
        .sheet(isPresented: $showingDatePicker) {
            YearMonthPickerSheet(selectedDate: $selectedDate, currentMonth: $currentMonth)
        }
        .onAppear {
            currentMonth = selectedDate
        }
        .onChange(of: selectedDate) { _, newDate in
            if !calendar.isDate(newDate, equalTo: currentMonth, toGranularity: .month) {
                withAnimation(.easeInOut(duration: 0.25)) {
                    currentMonth = newDate
                }
            }
        }
    }
    
    // MARK: - 手勢滑動判定 (左右滑動切換月份，上下滑動切換週/月展開)
    private func handleDragEnded(_ value: DragGesture.Value) {
        let h = value.translation.width
        let v = value.translation.height
        
        if abs(h) > abs(v) && abs(h) > 35 {
            // 水平滑動
            if h > 0 {
                // 往右滑：上個月 (或上一週)
                if scope == .month {
                    changeMonth(by: -1)
                } else {
                    changeWeek(by: -1)
                }
            } else {
                // 往左滑：下個月 (或下一週)
                if scope == .month {
                    changeMonth(by: 1)
                } else {
                    changeWeek(by: 1)
                }
            }
        } else if abs(v) > abs(h) && abs(v) > 30 {
            // 垂直滑動
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                if v < 0 {
                    // 往上滑：收起成週視圖
                    scope = .week
                } else {
                    // 往下滑：展開成月視圖
                    scope = .month
                }
            }
        }
    }
    
    private func changeMonth(by value: Int) {
        if let nextMonth = calendar.date(byAdding: .month, value: value, to: currentMonth) {
            withAnimation(.easeInOut(duration: 0.25)) {
                currentMonth = nextMonth
            }
        }
    }
    
    private func changeWeek(by value: Int) {
        if let nextWeek = calendar.date(byAdding: .weekOfYear, value: value, to: selectedDate) {
            withAnimation(.easeInOut(duration: 0.25)) {
                selectedDate = nextWeek
                currentMonth = nextWeek
            }
        }
    }
    
    // MARK: - 頂部日期標題、左側統計圖示按鈕、Today 標籤與日曆圖示按鈕
    private var headerView: some View {
        HStack(alignment: .center) {
            // 左側：統計按鈕 (icon) 與 Today 快速返回標籤
            HStack(spacing: 8) {
                Button {
                    onShowStatistics?()
                } label: {
                    ZStack {
                        Circle()
                            .fill(SleepTheme.surfaceSecondary)
                            .frame(width: 34, height: 34)
                        
                        Image(systemName: "chart.bar.xaxis")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(SleepTheme.accent)
                    }
                }
                .buttonStyle(.plain)
                
                if !calendar.isDateInToday(selectedDate) || !calendar.isDate(currentMonth, equalTo: Date(), toGranularity: .month) {
                    Button {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            selectedDate = Date()
                            currentMonth = Date()
                        }
                        onTapToday?()
                    } label: {
                        Text("Today")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(SleepTheme.accent)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .background(SleepTheme.surfaceSecondary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // 中間：選取日期 (若同月份) 或 目前瀏覽年月
            Text(headerTitleString)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundColor(SleepTheme.textPrimary)
                .lineLimit(1)
                .layoutPriority(1)
            
            // 右側：小日曆圖示 (點擊彈出年月快選)
            HStack {
                Spacer()
                Button {
                    showingDatePicker = true
                } label: {
                    ZStack {
                        Circle()
                            .fill(SleepTheme.surfaceSecondary)
                            .frame(width: 34, height: 34)
                        
                        Image(systemName: "calendar")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(SleepTheme.accent)
                    }
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }
    
    private var headerTitleString: String {
        if calendar.isDate(selectedDate, equalTo: currentMonth, toGranularity: .month) {
            return dateDisplayFormatter.string(from: selectedDate)
        } else {
            return monthDisplayFormatter.string(from: currentMonth)
        }
    }
    
    // MARK: - 星期欄頭
    private var weekdayHeaderView: some View {
        HStack {
            ForEach(0..<7, id: \.self) { index in
                Text(weekdays[index])
                    .font(.system(size: 12, weight: .medium))
                    .frame(maxWidth: .infinity)
                    .foregroundColor(weekdayColor(for: index))
            }
        }
        .padding(.vertical, 4)
    }
    
    private func weekdayColor(for index: Int) -> Color {
        if index == 0 {
            return Color(hex: "E06C75") // 週日 (淡紅)
        } else if index == 6 {
            return Color(hex: "73DACA") // 週六 (柔綠)
        } else {
            return SleepTheme.textSecondary
        }
    }
    
    // MARK: - 日期網格
    private var calendarGridView: some View {
        let days = (scope == .month) ? generateMonthDays(for: currentMonth) : generateWeekDays(for: selectedDate)
        
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 10) {
            ForEach(days, id: \.date) { day in
                dayCell(day: day)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: scope)
    }
    
    private func dayCell(day: DayInfo) -> some View {
        let isSelected = calendar.isDate(day.date, inSameDayAs: selectedDate)
        let isToday = calendar.isDateInToday(day.date)
        let hasSleepRecord = store.hasLog(on: day.date)
        let colIndex = (calendar.component(.weekday, from: day.date) - 1) % 7
        
        return Button {
            selectedDate = day.date
            currentMonth = day.date
            
            // 若該日無記錄，觸發新增視窗回調
            if !hasSleepRecord {
                onSelectDateWithoutLog?(day.date)
            }
        } label: {
            VStack(spacing: 3) {
                ZStack {
                    // 選取時的外環光圈
                    if isSelected {
                        Circle()
                            .stroke(Color(hex: "56B6C2"), lineWidth: 2)
                            .frame(width: 34, height: 34)
                    } else if isToday {
                        Circle()
                            .fill(SleepTheme.surfaceSecondary)
                            .frame(width: 32, height: 32)
                    }
                    
                    Text(day.dayString)
                        .font(.system(size: 15, weight: (isSelected || isToday) ? .bold : .medium, design: .rounded))
                        .foregroundColor(cellTextColor(day: day, colIndex: colIndex, isSelected: isSelected))
                }
                .frame(height: 34)
                
                // 睡眠打卡標記點
                Circle()
                    .fill(hasSleepRecord ? SleepTheme.accent : Color.clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
    
    private func cellTextColor(day: DayInfo, colIndex: Int, isSelected: Bool) -> Color {
        if isSelected {
            return SleepTheme.textPrimary
        }
        if !day.isCurrentMonth {
            return SleepTheme.textTertiary.opacity(0.4)
        }
        if colIndex == 0 {
            return Color(hex: "E06C75").opacity(0.85) // 週日
        } else if colIndex == 6 {
            return Color(hex: "73DACA").opacity(0.85) // 週六
        } else {
            return SleepTheme.textPrimary
        }
    }
    
    // MARK: - 底部拖拉橫桿 (手勢往上滑收起成週視圖，往下滑展開成月視圖)
    private var dragHandleBar: some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                scope = (scope == .month) ? .week : .month
            }
        } label: {
            VStack(spacing: 4) {
                Capsule()
                    .fill(SleepTheme.border.opacity(0.9))
                    .frame(width: 42, height: 5)
                    .padding(.vertical, 6)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - 日期計算輔助
    struct DayInfo {
        let date: Date
        let dayString: String
        let isCurrentMonth: Bool
    }
    
    private func generateMonthDays(for monthDate: Date) -> [DayInfo] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: monthDate),
              let firstWeek = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.start) else {
            return []
        }
        
        var days: [DayInfo] = []
        var current = firstWeek.start
        
        // 渲染 6 週或足夠覆蓋當月的日期
        for _ in 0..<42 {
            let isCurrent = calendar.isDate(current, equalTo: monthDate, toGranularity: .month)
            let dayNum = calendar.component(.day, from: current)
            let dayStr = String(format: "%02d", dayNum)
            
            days.append(DayInfo(date: current, dayString: dayStr, isCurrentMonth: isCurrent))
            
            guard let next = calendar.date(byAdding: .day, value: 1, to: current) else { break }
            current = next
            
            // 如果已經進入下個月且剛好是週六結束，提早停止
            if days.count >= 28 && !isCurrent && calendar.component(.weekday, from: current) == 1 {
                break
            }
        }
        
        return days
    }
    
    private func generateWeekDays(for date: Date) -> [DayInfo] {
        guard let weekInterval = calendar.dateInterval(of: .weekOfYear, for: date) else {
            return []
        }
        
        var days: [DayInfo] = []
        var current = weekInterval.start
        
        for _ in 0..<7 {
            let isCurrent = calendar.isDate(current, equalTo: date, toGranularity: .month)
            let dayNum = calendar.component(.day, from: current)
            let dayStr = String(format: "%02d", dayNum)
            
            days.append(DayInfo(date: current, dayString: dayStr, isCurrentMonth: isCurrent))
            
            guard let next = calendar.date(byAdding: .day, value: 1, to: current) else { break }
            current = next
        }
        
        return days
    }
    
    private var dateDisplayFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "yyyy/MM/dd"
        return f
    }
    
    private var monthDisplayFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "yyyy / MM"
        return f
    }
}

// MARK: - 年月快速切換視窗
struct YearMonthPickerSheet: View {
    @Binding var selectedDate: Date
    @Binding var currentMonth: Date
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedYear: Int
    @State private var selectedMonth: Int
    
    private let calendar = Calendar.current
    private let years = Array(2020...2032)
    private let months = Array(1...12)
    
    init(selectedDate: Binding<Date>, currentMonth: Binding<Date>) {
        self._selectedDate = selectedDate
        self._currentMonth = currentMonth
        let cal = Calendar.current
        _selectedYear = State(initialValue: cal.component(.year, from: currentMonth.wrappedValue))
        _selectedMonth = State(initialValue: cal.component(.month, from: currentMonth.wrappedValue))
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                VStack(spacing: 24) {
                    Text("快速切換年月")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(SleepTheme.textSecondary)
                        .padding(.top, 16)
                    
                    HStack(spacing: 20) {
                        // 年份滾輪
                        Picker("年份", selection: $selectedYear) {
                            ForEach(years, id: \.self) { year in
                                Text("\(String(year)) 年")
                                    .font(.system(size: 17, weight: .medium))
                                    .foregroundColor(SleepTheme.textPrimary)
                                    .tag(year)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(maxWidth: .infinity)
                        
                        // 月份滾輪
                        Picker("月份", selection: $selectedMonth) {
                            ForEach(months, id: \.self) { month in
                                Text("\(month) 月")
                                    .font(.system(size: 17, weight: .medium))
                                    .foregroundColor(SleepTheme.textPrimary)
                                    .tag(month)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal, 16)
                    .background(SleepTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    
                    Button {
                        var components = DateComponents()
                        components.year = selectedYear
                        components.month = selectedMonth
                        components.day = 1
                        if let newDate = calendar.date(from: components) {
                            currentMonth = newDate
                        }
                        dismiss()
                    } label: {
                        Text("套用跳轉")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Color(hex: "0B0E14"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(SleepTheme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
                .padding(16)
            }
            .navigationTitle("選擇年月")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                    .foregroundColor(SleepTheme.textSecondary)
                }
            }
        }
        .presentationDetents([.height(340)])
    }
}
