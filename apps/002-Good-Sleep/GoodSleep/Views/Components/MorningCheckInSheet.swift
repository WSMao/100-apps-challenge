import SwiftUI

/// 晨間起床打卡與復盤彈窗
struct MorningCheckInSheet: View {
    @ObservedObject var store: SleepStore
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedRating: SleepRating = .good
    @State private var bedtime: Date
    @State private var wakeTime: Date = Date()
    @State private var isSnoozed: Bool = false
    @State private var snoozeMinutes: Int = 10
    @State private var note: String = ""
    @State private var bedtimeNote: String = ""
    
    init(store: SleepStore) {
        self.store = store
        let defaultBed = Calendar.current.date(byAdding: .hour, value: -8, to: Date()) ?? Date()
        _bedtime = State(initialValue: store.ongoingBedtime ?? defaultBed)
        _bedtimeNote = State(initialValue: store.todayLog?.bedtimeNote ?? store.pendingBedtimeNote)
        _note = State(initialValue: store.todayLog?.note ?? "")
    }
    
    private var isTimeRangeValid: Bool {
        bedtime < wakeTime
    }
    
    private var targetNightString: String {
        let f = DateFormatter()
        f.dateFormat = "M/d"
        return f.string(from: bedtime)
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // 晨間問候
                        VStack(alignment: .leading, spacing: 6) {
                            Text("☀️ 早安！\(targetNightString) 晚上睡得如何？")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(SleepTheme.textPrimary)
                            
                            Text("花 30 秒記錄昨晚睡眠身心狀態，協助建立個人專屬的規律作息。")
                                .font(.system(size: 14))
                                .foregroundColor(SleepTheme.textSecondary)
                        }
                        
                        // 1. 醒來精神狀態貼圖 (四選一)
                        VStack(alignment: .leading, spacing: 12) {
                            Text("1. 起床狀態自評")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                                ForEach(SleepRating.allCases) { rating in
                                    Button {
                                        selectedRating = rating
                                    } label: {
                                        VStack(spacing: 8) {
                                            Text(rating.emoji)
                                                .font(.system(size: 36))
                                            
                                            Text(rating.title)
                                                .font(.system(size: 14, weight: .semibold))
                                                .foregroundColor(selectedRating == rating ? SleepTheme.accent : SleepTheme.textPrimary)
                                            
                                            Text(rating.description)
                                                .font(.system(size: 11))
                                                .foregroundColor(SleepTheme.textTertiary)
                                                .multilineTextAlignment(.center)
                                                .lineLimit(2)
                                        }
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 14)
                                        .padding(.horizontal, 8)
                                        .background(selectedRating == rating ? SleepTheme.accent.opacity(0.12) : SleepTheme.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                                .stroke(selectedRating == rating ? SleepTheme.accent : SleepTheme.border.opacity(0.4), lineWidth: selectedRating == rating ? 1.5 : 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        
                        // 2. 實際入睡與起床時間
                        VStack(alignment: .leading, spacing: 12) {
                            Text("2. 睡眠時間確認")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            VStack(spacing: 12) {
                                DatePicker(
                                    "就寢入睡時間",
                                    selection: $bedtime,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .datePickerStyle(.compact)
                                .foregroundColor(SleepTheme.textPrimary)
                                
                                Divider().background(SleepTheme.border)
                                
                                DatePicker(
                                    "今晨醒來時間",
                                    selection: $wakeTime,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .datePickerStyle(.compact)
                                .foregroundColor(SleepTheme.textPrimary)
                            }
                            .padding(16)
                            .background(SleepTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            
                            // 防呆驗證提示：入睡時間晚於或等於醒來時間
                            if !isTimeRangeValid {
                                HStack(spacing: 6) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.system(size: 13))
                                    Text("入睡時間不能晚於或等於醒來時間")
                                        .font(.system(size: 13, weight: .semibold))
                                }
                                .foregroundColor(SleepTheme.warning)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(SleepTheme.warning.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                        }
                        
                        // 3. 賴床檢測
                        VStack(alignment: .leading, spacing: 12) {
                            Text("3. 鬧鐘與賴床追蹤")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            VStack(spacing: 14) {
                                Toggle(isOn: $isSnoozed) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("鬧鐘響後有賴床嗎？")
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundColor(SleepTheme.textPrimary)
                                        Text("有按貪睡按鈕或稍微躺著不想起")
                                            .font(.system(size: 12))
                                            .foregroundColor(SleepTheme.textTertiary)
                                    }
                                }
                                .tint(SleepTheme.accent)
                                
                                if isSnoozed {
                                    Divider().background(SleepTheme.border)
                                    
                                    Stepper(value: $snoozeMinutes, in: 5...60, step: 5) {
                                        HStack {
                                            Text("大約賴床時長：")
                                                .font(.system(size: 14))
                                                .foregroundColor(SleepTheme.textSecondary)
                                            Text("\(snoozeMinutes) 分鐘")
                                                .font(.system(size: 14, weight: .bold))
                                                .foregroundColor(SleepTheme.warning)
                                        }
                                    }
                                }
                            }
                            .padding(16)
                            .background(SleepTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        
                        // 4. 睡前筆記
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("4. 睡前筆記")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(SleepTheme.accent)
                                Spacer()
                                if !bedtimeNote.isEmpty {
                                    Text("昨夜已記錄")
                                        .font(.system(size: 11))
                                        .foregroundColor(SleepTheme.success)
                                }
                            }
                            
                            TextField("昨夜入睡前的心情、狀態或感恩事項...", text: $bedtimeNote, axis: .vertical)
                                .lineLimit(2...4)
                                .padding(14)
                                .background(SleepTheme.surface)
                                .foregroundColor(SleepTheme.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(SleepTheme.border.opacity(0.4), lineWidth: 1)
                                )
                        }
                        
                        // 5. 晨間微筆記
                        VStack(alignment: .leading, spacing: 12) {
                            Text("5. 晨間微筆記 (選填)")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            
                            TextField("記下做夢內容、醒來身心狀態或開機感受...", text: $note, axis: .vertical)
                                .lineLimit(3...5)
                                .padding(14)
                                .background(SleepTheme.surface)
                                .foregroundColor(SleepTheme.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(SleepTheme.border.opacity(0.4), lineWidth: 1)
                                )
                        }
                        
                        // 保存完成按鈕
                        Button {
                            guard isTimeRangeValid else { return }
                            store.recordMorningWakeUp(
                                bedtime: bedtime,
                                wakeTime: wakeTime,
                                rating: selectedRating,
                                isSnoozed: isSnoozed,
                                snoozeMinutes: isSnoozed ? snoozeMinutes : 0,
                                note: note,
                                bedtimeNote: bedtimeNote
                            )
                            dismiss()
                        } label: {
                            Text("完成今日晨間打卡")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(Color(hex: "0B0E14"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(isTimeRangeValid ? SleepTheme.accent : SleepTheme.accent.opacity(0.35))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .shadow(color: isTimeRangeValid ? SleepTheme.accent.opacity(0.3) : Color.clear, radius: 10, y: 4)
                        }
                        .disabled(!isTimeRangeValid)
                        .padding(.top, 10)
                        .padding(.bottom, 30)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("晨間起床復盤")
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
    }
}

