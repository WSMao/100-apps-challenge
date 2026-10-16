import SwiftUI

/// 睡眠紀錄編輯與新增彈窗 (支援編輯既有記錄或為指定日期補打卡)
struct EditSleepLogSheet: View {
    @ObservedObject var store: SleepStore
    let originalLog: SleepLog?
    let newLogDate: Date?
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedRating: SleepRating
    @State private var bedtime: Date
    @State private var wakeTime: Date
    @State private var isSnoozed: Bool
    @State private var note: String
    @State private var showingDeleteAlert: Bool = false
    @State private var bedtimeNote: String = ""
    
    var isEditing: Bool {
        originalLog != nil
    }
    
    // 編輯既有記錄
    init(store: SleepStore, log: SleepLog) {
        self.store = store
        self.originalLog = log
        self.newLogDate = nil
        _selectedRating = State(initialValue: log.rating)
        _bedtime = State(initialValue: log.bedtime)
        _wakeTime = State(initialValue: log.wakeTime)
        _isSnoozed = State(initialValue: log.isSnoozed)
        _note = State(initialValue: log.note)
        _bedtimeNote = State(initialValue: log.bedtimeNote)
    }
    
    // 為指定日期新增睡眠記錄
    init(store: SleepStore, newLogDate: Date) {
        self.store = store
        self.originalLog = nil
        self.newLogDate = newLogDate
        
        let cal = Calendar.current
        let targetNight = cal.startOfDay(for: newLogDate)
        
        // 預設入睡時間：該夜 23:00
        let defaultBed = cal.date(bySettingHour: 23, minute: 0, second: 0, of: targetNight) ?? targetNight
        // 預設起床時間：隔日早晨 07:00
        let nextDay = cal.date(byAdding: .day, value: 1, to: targetNight) ?? targetNight
        let defaultWake = cal.date(bySettingHour: 7, minute: 0, second: 0, of: nextDay) ?? nextDay
        
        _selectedRating = State(initialValue: .good)
        _bedtime = State(initialValue: defaultBed)
        _wakeTime = State(initialValue: defaultWake)
        _isSnoozed = State(initialValue: false)
        _note = State(initialValue: "")
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        // 0. 日期標籤 (新增記錄時提示所選日期)
                        if let targetDate = newLogDate {
                            HStack {
                                Image(systemName: "calendar.badge.plus")
                                    .foregroundColor(SleepTheme.calmTeal)
                                Text("補登日期：\(dateDisplayFormatter.string(from: targetDate))")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(SleepTheme.textSecondary)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(SleepTheme.surfaceSecondary)
                            .clipShape(Capsule())
                        }
                        
                        // 1. 起床自評狀態貼圖
                        VStack(alignment: .leading, spacing: 10) {
                            Text("起床狀態自評")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                                ForEach(SleepRating.allCases) { rating in
                                    Button {
                                        selectedRating = rating
                                    } label: {
                                        HStack(spacing: 8) {
                                            Text(rating.emoji)
                                                .font(.system(size: 26))
                                            Text(rating.title)
                                                .font(.system(size: 13, weight: .medium))
                                                .foregroundColor(selectedRating == rating ? SleepTheme.accent : SleepTheme.textPrimary)
                                            Spacer()
                                        }
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 12)
                                        .background(selectedRating == rating ? SleepTheme.accent.opacity(0.15) : SleepTheme.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(selectedRating == rating ? SleepTheme.accent : SleepTheme.border.opacity(0.4), lineWidth: 1.5)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        
                        // 2. 入睡與醒來時間
                        VStack(alignment: .leading, spacing: 10) {
                            Text("睡眠時間調整")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            VStack(spacing: 12) {
                                DatePicker(
                                    "入睡時間",
                                    selection: $bedtime,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .foregroundColor(SleepTheme.textPrimary)
                                
                                Divider().background(SleepTheme.border)
                                
                                DatePicker(
                                    "醒來時間",
                                    selection: $wakeTime,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .foregroundColor(SleepTheme.textPrimary)
                            }
                            .padding(14)
                            .background(SleepTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        
                        // 3. 賴床狀況 (由醒來時間與鬧鐘時間自動換算時長)
                        VStack(alignment: .leading, spacing: 10) {
                            Text("鬧鐘與賴床狀態")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            VStack(spacing: 12) {
                                Toggle("是否有賴床？", isOn: $isSnoozed)
                                    .foregroundColor(SleepTheme.textPrimary)
                                    .tint(SleepTheme.accent)
                            }
                            .padding(14)
                            .background(SleepTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        
                        // 4. 睡前筆記
                        VStack(alignment: .leading, spacing: 10) {
                            Text("睡前筆記")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            TextField("記下睡前身心感受、雜念或感恩事項...", text: $bedtimeNote, axis: .vertical)
                                .lineLimit(2...4)
                                .padding(12)
                                .background(SleepTheme.surface)
                                .foregroundColor(SleepTheme.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(SleepTheme.border.opacity(0.4), lineWidth: 1)
                                )
                        }
                        
                        // 5. 晨間微筆記
                        VStack(alignment: .leading, spacing: 10) {
                            Text("晨間微筆記")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            TextField("記下昨晚入睡容易度、做夢內容或醒來身心狀態...", text: $note, axis: .vertical)
                                .lineLimit(3...5)
                                .padding(12)
                                .background(SleepTheme.surface)
                                .foregroundColor(SleepTheme.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(SleepTheme.border.opacity(0.4), lineWidth: 1)
                                )
                        }
                        
                        // 儲存與刪除按鈕
                        VStack(spacing: 12) {
                            Button {
                                saveAction()
                            } label: {
                                Text("儲存")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(Color(hex: "0B0E14"))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(SleepTheme.accent)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            
                            if isEditing, let log = originalLog {
                                Button(role: .destructive) {
                                    showingDeleteAlert = true
                                } label: {
                                    HStack {
                                        Image(systemName: "trash")
                                        Text("刪除此筆記錄")
                                    }
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(SleepTheme.warning)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                }
                            }
                        }
                        .padding(.top, 10)
                        .padding(.bottom, 20)
                    }
                    .padding(20)
                }
            }
            .navigationTitle(isEditing ? "編輯睡眠記錄" : "新增睡眠記錄")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                    .foregroundColor(SleepTheme.textSecondary)
                }
            }
            .alert("確定要刪除此筆記錄嗎？", isPresented: $showingDeleteAlert) {
                Button("取消", role: .cancel) { }
                Button("刪除", role: .destructive) {
                    if let log = originalLog {
                        store.deleteSleepLog(id: log.id)
                    }
                    dismiss()
                }
            } message: {
                Text("刪除後將無法復原。")
            }
        }
    }
    
    /// 自動換算醒來時間與預定鬧鐘時間的差距 (分鐘)
    private func calculateSnoozeMinutes() -> Int {
        guard isSnoozed else { return 0 }
        let cal = Calendar.current
        let targetAlarm = originalLog?.scheduledWakeTime ?? store.alarmSetting.targetWakeTime
        let alarmHour = cal.component(.hour, from: targetAlarm)
        let alarmMinute = cal.component(.minute, from: targetAlarm)
        
        if let scheduledOnDay = cal.date(bySettingHour: alarmHour, minute: alarmMinute, second: 0, of: wakeTime) {
            let diffSeconds = wakeTime.timeIntervalSince(scheduledOnDay)
            let minutes = Int(round(diffSeconds / 60.0))
            return max(5, minutes)
        }
        return 10
    }
    
    private func saveAction() {
        let calculatedSnooze = calculateSnoozeMinutes()
        
        if let original = originalLog {
            var updated = original
            updated.bedtime = bedtime
            updated.wakeTime = wakeTime
            updated.date = SleepStore.logicalSleepDate(for: bedtime)
            updated.rating = selectedRating
            updated.isSnoozed = isSnoozed
            updated.snoozeMinutes = calculatedSnooze
            updated.note = note
            updated.bedtimeNote = bedtimeNote
            store.updateSleepLog(updated)
        } else if let _ = newLogDate {
            let scheduledTime = store.alarmSetting.targetWakeTime
            let logicalDate = SleepStore.logicalSleepDate(for: bedtime)
            let newLog = SleepLog(
                date: logicalDate,
                bedtime: bedtime,
                wakeTime: wakeTime,
                scheduledWakeTime: scheduledTime,
                rating: selectedRating,
                isSnoozed: isSnoozed,
                snoozeMinutes: calculatedSnooze,
                note: note,
                bedtimeNote: bedtimeNote,
                completedChecklistCount: 0
            )
            store.addSleepLog(newLog)
        }
        dismiss()
    }
    
    private var dateDisplayFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "yyyy 年 M 月 d 日"
        return f
    }
}
