import SwiftUI

/// 今日主畫面：夜間倒數、晨間報告與快速打卡入口
struct TodayView: View {
    @ObservedObject var store: SleepStore
    @State private var showingCheckInSheet: Bool = false
    @State private var showingGoodNightModal: Bool = false
    @State private var bedtimeNoteInput: String = ""
    @State private var noteSavedFeedback: Bool = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // 1. 今夜就寢目標與時鐘氛圍卡片 (含「晚安」按鈕)
                        bedtimeHeroCard
                        
                        // 2. 睡眠進行中狀態提醒 (若已按開始睡眠)
                        if store.isSleeping {
                            sleepingStatusBanner
                        } else if let log = store.todayLog {
                            // 3. 今日晨間報告卡片 (如果今日醒來已打卡)
                            morningReportCard(log: log)
                        } else {
                            unrecordedCard
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 10)
                    .padding(.bottom, 30)
                }
                
                // 4. 晚安彈出視窗 (置中 Modal)
                if showingGoodNightModal {
                    ZStack {
                        Color.black.opacity(0.65)
                            .ignoresSafeArea()
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    showingGoodNightModal = false
                                }
                            }
                        
                        goodNightModal
                            .padding(.horizontal, 22)
                            .transition(.scale(scale: 0.94).combined(with: .opacity))
                    }
                    .zIndex(100)
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
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("今晚目標就寢")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SleepTheme.textSecondary)
                    
                    Text(timeFormatter.string(from: store.alarmSetting.targetBedtime))
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundColor(SleepTheme.moonGlow)
                }
                
                Spacer()
                
                // 「晚安」按鈕
                Button {
                    bedtimeNoteInput = store.pendingBedtimeNote.isEmpty ? (store.todayLog?.bedtimeNote ?? "") : store.pendingBedtimeNote
                    noteSavedFeedback = false
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        showingGoodNightModal = true
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: store.isSleeping ? "bed.double.fill" : "moon.stars.fill")
                            .font(.system(size: 15, weight: .semibold))
                        Text(store.isSleeping ? "睡眠中" : "晚安")
                            .font(.system(size: 15, weight: .bold))
                    }
                    .foregroundColor(Color(hex: "0B0E14"))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: store.isSleeping ? [SleepTheme.calmTeal, SleepTheme.success] : [SleepTheme.moonGlow, SleepTheme.accent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(Capsule())
                    .shadow(color: (store.isSleeping ? SleepTheme.calmTeal : SleepTheme.accent).opacity(0.35), radius: 8, x: 0, y: 4)
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
    
    /// 睡眠中即時橫幅
    private var sleepingStatusBanner: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(SleepTheme.calmTeal.opacity(0.18))
                    .frame(width: 40, height: 40)
                
                Image(systemName: "moon.zzz.fill")
                    .font(.system(size: 18))
                    .foregroundColor(SleepTheme.calmTeal)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                Text("正在睡眠記錄中")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                if let bedtime = store.ongoingBedtime {
                    Text("已於 \(timeFormatter.string(from: bedtime)) 開始入睡，祝你好夢！")
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textSecondary)
                }
            }
            
            Spacer()
            
            Button {
                showingCheckInSheet = true
            } label: {
                Text("醒來打卡")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(Color(hex: "0B0E14"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(SleepTheme.calmTeal)
                    .clipShape(Capsule())
            }
        }
        .padding(14)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(SleepTheme.calmTeal.opacity(0.4), lineWidth: 1)
        )
    }
    
    // MARK: - 晚安彈出視窗
    
    private var goodNightModal: some View {
        VStack(spacing: 20) {
            // 頂部圓形圖示與標題
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(SleepTheme.lavender.opacity(0.2))
                        .frame(width: 56, height: 56)
                    
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 26))
                        .foregroundColor(SleepTheme.accent)
                }
                
                Text("晚安儀式")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(SleepTheme.textPrimary)
                
                Text("放下螢幕與雜念，為優質睡眠按下開關。")
                    .font(.system(size: 13))
                    .foregroundColor(SleepTheme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 4)
            
            // 按鈕 1：開始睡眠
            Button {
                let note = bedtimeNoteInput.trimmingCharacters(in: .whitespacesAndNewlines)
                store.startSleep(at: Date(), note: note)
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                withAnimation(.easeInOut(duration: 0.25)) {
                    showingGoodNightModal = false
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: store.isSleeping ? "arrow.clockwise.circle.fill" : "bed.double.fill")
                        .font(.system(size: 17, weight: .bold))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(store.isSleeping ? "重新記錄入睡時間" : "開始睡眠")
                            .font(.system(size: 16, weight: .bold))
                        Text(store.isSleeping && store.ongoingBedtime != nil ? "已於 \(timeFormatter.string(from: store.ongoingBedtime!)) 入睡（點擊重設為現在）" : "自動記錄當前為入睡時間")
                            .font(.system(size: 11, weight: .regular))
                            .opacity(0.85)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .opacity(0.6)
                }
                .foregroundColor(Color(hex: "0B0E14"))
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity)
                .background(
                    LinearGradient(
                        colors: [SleepTheme.moonGlow, SleepTheme.accent],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: SleepTheme.accent.opacity(0.3), radius: 6, x: 0, y: 3)
            }
            
            // 按鈕 2 與輸入框：睡前筆記
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 14))
                            .foregroundColor(SleepTheme.accent)
                        Text("睡前筆記")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(SleepTheme.textPrimary)
                    }
                    
                    Spacer()
                    
                    if noteSavedFeedback {
                        Text("✓ 已儲存")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(SleepTheme.success)
                            .transition(.opacity)
                    }
                }
                
                ZStack(alignment: .topLeading) {
                    if bedtimeNoteInput.isEmpty {
                        Text("記錄今晚的想法、感謝的事或卸下腦中的思緒...")
                            .font(.system(size: 13))
                            .foregroundColor(SleepTheme.textTertiary)
                            .padding(.top, 10)
                            .padding(.leading, 12)
                    }
                    
                    TextEditor(text: $bedtimeNoteInput)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(height: 85)
                        .font(.system(size: 14))
                        .foregroundColor(SleepTheme.textPrimary)
                        .background(SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                
                Button {
                    let note = bedtimeNoteInput.trimmingCharacters(in: .whitespacesAndNewlines)
                    store.saveBedtimeNote(note)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation {
                        noteSavedFeedback = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        withAnimation {
                            noteSavedFeedback = false
                        }
                    }
                } label: {
                    HStack {
                        Spacer()
                        Text("儲存筆記")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(SleepTheme.accent)
                        Spacer()
                    }
                    .padding(.vertical, 8)
                    .background(SleepTheme.accent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
            .padding(14)
            .background(SleepTheme.surfaceSecondary.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            
            // 底部關閉按鈕
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showingGoodNightModal = false
                }
            } label: {
                Text("稍後再說 / 關閉")
                    .font(.system(size: 13))
                    .foregroundColor(SleepTheme.textSecondary)
                    .padding(.vertical, 4)
            }
        }
        .padding(22)
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(SleepTheme.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.6), radius: 24, x: 0, y: 12)
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
            
            // 睡前筆記
            if !log.bedtimeNote.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: "moon.fill")
                            .font(.system(size: 11))
                            .foregroundColor(SleepTheme.moonGlow)
                        Text("睡前筆記")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(SleepTheme.moonGlow)
                    }
                    Text("“\(log.bedtimeNote)”")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundColor(SleepTheme.textSecondary)
                        .italic()
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SleepTheme.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            
            // 晨醒備註
            if !log.note.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 11))
                            .foregroundColor(SleepTheme.accent)
                        Text("晨醒微筆記")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(SleepTheme.accent)
                    }
                    Text("“\(log.note)”")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundColor(SleepTheme.textSecondary)
                        .italic()
                }
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
                    Text(store.isSleeping ? "睡眠已進入後半程" : "今早尚未晨間復盤")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(SleepTheme.textPrimary)
                    Text(store.isSleeping ? "醒來花 30 秒打卡完成記錄，評估今日睡眠品質。" : "醒來花 30 秒記錄狀態，給大腦一個正向啟動儀式。")
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

