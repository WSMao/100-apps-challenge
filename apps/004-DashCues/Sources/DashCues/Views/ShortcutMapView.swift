import SwiftUI

struct ShortcutMapView: View {
    let application: ShortcutApplication
    let isPinned: Bool
    let onTogglePin: () -> Void
    var highlightedShortcutID: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ApplicationIconView(application: application, size: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(application.name)
                        .font(.title3.weight(.semibold))
                    Text("\(application.shortcuts.count) 個快捷鍵")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(action: onTogglePin) {
                    Image(systemName: isPinned ? "pin.slash.fill" : "pin")
                }
                .buttonStyle(.borderless)
                .help(isPinned ? "關閉固定的快捷鍵地圖" : "固定快捷鍵地圖")
                .accessibilityLabel(isPinned ? "關閉固定的快捷鍵地圖" : "固定快捷鍵地圖")
            }

            Divider()

            if application.shortcuts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "keyboard")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("尚無快捷鍵")
                        .font(.headline)
                    Text("可以在 DashCues 視窗中新增快捷鍵。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(application.shortcuts) { shortcut in
                            HStack(alignment: .center, spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(shortcut.title)
                                        .font(.callout)
                                    let tagText: String = shortcut.tags.joined(separator: " · ")
                                    let subtitle: String = [tagText, shortcut.notes].filter { !$0.isEmpty }.joined(separator: " · ")
                                    if !subtitle.isEmpty {
                                        Text(subtitle)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer(minLength: 8)
                                HStack(spacing: 3) {
                                    ForEach(Array(shortcut.keys.enumerated()), id: \.offset) { _, key in
                                        Text(key)
                                            .font(.system(.caption, design: .rounded).weight(.medium))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 4)
                                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 5))
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                            .padding(.horizontal, 6)
                            .background(
                                highlightedShortcutID == shortcut.id ? Color.accentColor.opacity(0.18) : .clear,
                                in: RoundedRectangle(cornerRadius: 6)
                            )
                            .id(shortcut.id)
                            Divider()
                        }
                    }
                }
                .onChange(of: highlightedShortcutID) { id in
                    if let id { proxy.scrollTo(id) }
                }
                }
            }
        }
        .padding(16)
        .frame(minWidth: 330, maxWidth: .infinity, minHeight: 260, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}
