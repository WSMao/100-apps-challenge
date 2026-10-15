import SwiftUI

/// 睡前避坑與儀式檢核項目卡片
struct ChecklistRow: View {
    let item: ChecklistItem
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 16) {
                // 圖示
                ZStack {
                    Circle()
                        .fill(item.isCompleted ? SleepTheme.success.opacity(0.18) : SleepTheme.surfaceSecondary)
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: item.iconName)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(item.isCompleted ? SleepTheme.success : SleepTheme.textSecondary)
                }
                
                // 標題與說明
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(item.isCompleted ? SleepTheme.textSecondary : SleepTheme.textPrimary)
                        .strikethrough(item.isCompleted, color: SleepTheme.textTertiary)
                    
                    Text(item.subtitle)
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textTertiary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                // 勾選方塊
                Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 24))
                    .foregroundColor(item.isCompleted ? SleepTheme.success : SleepTheme.border)
            }
            .padding(14)
            .background(SleepTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(item.isCompleted ? SleepTheme.success.opacity(0.3) : SleepTheme.border.opacity(0.4), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

