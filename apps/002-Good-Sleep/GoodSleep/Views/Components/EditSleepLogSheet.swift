import SwiftUI

/// 睡眠紀錄編輯與修改彈窗
struct EditSleepLogSheet: View {
    @ObservedObject var store: SleepStore
    let originalLog: SleepLog
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedRating: SleepRating
    @State private var bedtime: Date
    @State private var wakeTime: Date
    @State private var isSnoozed: Bool
    @State private var snoozeMinutes: Int
    @State private var note: String
    @State private var showingDeleteAlert: Bool = false
    
    init(store: SleepStore, log: SleepLog) {
        self.store = store
        self.originalLog = log
        _selectedRating = State(initialValue: log.rating)
        _bedtime = State(initialValue: log.bedtime)
        _wakeTime = State(initialValue: log.wakeTime)
        _isSnoozed = State(initialValue: log.isSnoozed)
        _snoozeMinutes = State(initialValue: max(5, log.snoozeMinutes))
        _note = State(initialValue: log.note)
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
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
                        
                        // 3. 賴床狀況
                        VStack(alignment: .leading, spacing: 10) {
                            Text("鬧鐘與賴床狀態")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            VStack(spacing: 12) {
                                Toggle("是否有賴床？", isOn: $isSnoozed)
                                    .foregroundColor(SleepTheme.textPrimary)
                                    .tint(SleepTheme.accent)
                                
                                if isSnoozed {
                                    Divider().background(SleepTheme.border)
                                    
                                    Stepper(value: $snoozeMinutes, in: 5...60, step: 5) {
                                        HStack {
                                            Text("賴床時長：")
                                                .font(.system(size: 14))
                                                .foregroundColor(SleepTheme.textSecondary)
                                            Text("\(snoozeMinutes) 分鐘")
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundColor(SleepTheme.warning)
                                        }
                                    }
                                }
                            }
                            .padding(14)
                            .background(SleepTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        
                        // 4. 晨間筆記
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
                                var updated = originalLog
                                updated.bedtime = bedtime
                                updated.wakeTime = wakeTime
                                updated.rating = selectedRating
                                updated.isSnoozed = isSnoozed
                                updated.snoozeMinutes = isSnoozed ? snoozeMinutes : 0
                                updated.note = note
                                
                                store.updateSleepLog(updated)
                                dismiss()
                            } label: {
                                Text("儲存修改")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(Color(hex: "0B0E14"))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(SleepTheme.accent)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            
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
                        .padding(.top, 10)
                        .padding(.bottom, 20)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("編輯睡眠記錄")
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
                    store.deleteSleepLog(id: originalLog.id)
                    dismiss()
                }
            } message: {
                Text("刪除後將無法復原。")
            }
        }
    }
}

