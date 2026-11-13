import AppKit
import SwiftUI

struct SheetSearchResultsView: View {
    let application: ShortcutApplication
    let query: String
    let store: ShortcutStore
    let clipboardWriter: (String) -> Bool
    let onCopySuccess: (String) -> Void
    let onJumpToKeyValue: (KeyValueCheatsheet, KeyValueEntry) -> Void
    let onJumpToShortcut: (ShortcutSheet, ShortcutItem) -> Void

    @State private var copiedFieldToken: String?

    private var sections: [SheetSearchResultSection] {
        store.searchAllSheets(query: query, in: application)
    }

    var body: some View {
        Group {
            if sections.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                    Text("找不到符合的項目")
                        .font(.headline)
                    Text("請嘗試其他搜尋文字。")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("sheet.search-no-results")
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(sections) { section in
                            sectionCard(for: section)
                        }
                    }
                    .padding(8)
                }
                .accessibilityIdentifier("sheet.search-results")
                .background(identifiableView(identifier: "sheet.search-results"))
            }
        }
        .frame(maxHeight: .infinity)
    }

    @ViewBuilder
    private func sectionCard(for section: SheetSearchResultSection) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section Header
            HStack(spacing: 8) {
                Image(systemName: section.kind == .keyValue ? "list.bullet.rectangle" : "command")
                    .foregroundStyle(Color.accentColor)
                Text(section.sheetName)
                    .font(.headline)
                Text(section.kind == .keyValue ? "Key-Value" : "快捷鍵")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.15), in: Capsule())
                    .foregroundStyle(.secondary)
                Spacer()
                let count = section.kind == .keyValue ? section.keyValueEntries.count : section.shortcuts.count
                Text("\(count) 個項目")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            // Section Body
            if section.kind == .keyValue {
                keyValueSectionContent(section)
            } else {
                shortcutSectionContent(section)
            }
        }
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
        .accessibilityIdentifier("sheet.search-section.\(section.sheetID)")
        .background(identifiableView(identifier: "sheet.search-section.\(section.sheetID)"))
    }

    @ViewBuilder
    private func keyValueSectionContent(_ section: SheetSearchResultSection) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Table Header
            HStack(spacing: 0) {
                Text("Key")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                Divider()
                Text("Value")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                Divider()
                Text("跳轉")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 44, alignment: .center)
                    .padding(.vertical, 8)
            }
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            // Rows
            ForEach(Array(section.keyValueEntries.enumerated()), id: \.element.entry.id) { index, item in
                let (cheatsheet, entry) = item
                HStack(alignment: .top, spacing: 0) {
                    // Key Cell
                    HStack(alignment: .top, spacing: 8) {
                        Text(entry.key.isEmpty ? "（空白 Key）" : entry.key)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                        Button {
                            copyText(entry.key, fieldName: "Key", token: "\(entry.id)-key")
                        } label: {
                            Image(systemName: copiedFieldToken == "\(entry.id)-key" ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 12))
                                .foregroundStyle(copiedFieldToken == "\(entry.id)-key" ? Color.green : Color.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("複製 Key")
                        .accessibilityIdentifier("sheet.search-copy-key.\(entry.id)")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .topLeading)

                    Divider()

                    // Value Cell
                    HStack(alignment: .top, spacing: 8) {
                        Text(entry.value.isEmpty ? "（空白 Value）" : entry.value)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                        Button {
                            copyText(entry.value, fieldName: "Value", token: "\(entry.id)-val")
                        } label: {
                            Image(systemName: copiedFieldToken == "\(entry.id)-val" ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 12))
                                .foregroundStyle(copiedFieldToken == "\(entry.id)-val" ? Color.green : Color.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("複製 Value")
                        .accessibilityIdentifier("sheet.search-copy-value.\(entry.id)")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .topLeading)

                    Divider()

                    // Jump Cell
                    Button {
                        onJumpToKeyValue(cheatsheet, entry)
                    } label: {
                        Image(systemName: "arrow.up.right.square")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.accentColor)
                    }
                    .buttonStyle(.plain)
                    .help("跳轉至「\(section.sheetName)」並選取此項目")
                    .accessibilityLabel("跳轉至「\(section.sheetName)」並選取此項目")
                    .accessibilityIdentifier("sheet.search-jump.key-value.\(entry.id)")
                    .background(identifiableView(identifier: "sheet.search-jump.key-value.\(entry.id)"))
                    .frame(width: 44, height: 32, alignment: .center)
                }

                if index < section.keyValueEntries.count - 1 {
                    Divider()
                }
            }
        }
    }

    @ViewBuilder
    private func shortcutSectionContent(_ section: SheetSearchResultSection) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(section.shortcuts.enumerated()), id: \.element.item.id) { index, pair in
                let (sheet, item) = pair
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.body.weight(.medium))
                            .lineLimit(1)
                        if !item.tags.isEmpty {
                            FlowLayout(spacing: 4) {
                                ForEach(item.tags, id: \.self) { tag in
                                    TagChip(name: tag, onRemove: nil)
                                }
                            }
                        }
                    }

                    Spacer(minLength: 8)

                    HStack(spacing: 3) {
                        ForEach(item.keys, id: \.self) { key in
                            Text(key)
                                .font(.system(.body, design: .rounded).weight(.medium))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
                                .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color(nsColor: .separatorColor)))
                        }
                    }

                    Button {
                        onJumpToShortcut(sheet, item)
                    } label: {
                        Image(systemName: "arrow.up.right.square")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.accentColor)
                    }
                    .buttonStyle(.plain)
                    .help("跳轉至「\(section.sheetName)」並選取此快捷鍵")
                    .accessibilityLabel("跳轉至「\(section.sheetName)」並選取此快捷鍵")
                    .accessibilityIdentifier("sheet.search-jump.shortcut.\(item.id)")
                    .background(identifiableView(identifier: "sheet.search-jump.shortcut.\(item.id)"))
                    .frame(width: 44, height: 32, alignment: .center)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)

                if index < section.shortcuts.count - 1 {
                    Divider()
                }
            }
        }
    }

    private func identifiableView(identifier: String) -> some View {
        ViewAnchor {
            $0.setAccessibilityElement(false)
            $0.setAccessibilityIdentifier(identifier)
        }
        .accessibilityHidden(true)
    }

    private func copyText(_ text: String, fieldName: String, token: String) {
        if clipboardWriter(text) {
            copiedFieldToken = token
            onCopySuccess("已複製 \(fieldName)")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                if copiedFieldToken == token {
                    copiedFieldToken = nil
                }
            }
        }
    }
}
