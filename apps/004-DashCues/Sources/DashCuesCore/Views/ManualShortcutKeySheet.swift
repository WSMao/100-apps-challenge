import AppKit
import SwiftUI

struct ManualShortcutKeySheet: View {
    let item: ShortcutItem
    let onSave: ([String]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var keyInput: String = ""
    @State private var showCheatSheet: Bool = false
    @State private var previewKeys: [String] = []

    init(item: ShortcutItem, onSave: @escaping ([String]) -> Void) {
        self.item = item
        self.onSave = onSave
        let jsonKeys = item.keys.map { "\"\($0)\"" }.joined(separator: ", ")
        _keyInput = State(initialValue: "[\(jsonKeys)]")
        _previewKeys = State(initialValue: item.keys)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("手動輸入快捷鍵")
                    .font(.headline)
                if !item.title.isEmpty {
                    Text(item.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // Input section
            VStack(alignment: .leading, spacing: 8) {
                Text("按鍵格式（JSON 陣列或按鍵列表）：")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    TextField("例如 [\"⌘\", \"V\"] 或 [\"⌥\", \"Drag\"]", text: $keyInput)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.body, design: .monospaced))
                        .accessibilityIdentifier("shortcut.manual-keys-input")
                        .onChange(of: keyInput) { newValue in
                            previewKeys = ShortcutMappingParser.parseKeysInput(newValue)
                        }

                    Button {
                        showCheatSheet.toggle()
                    } label: {
                        Image(systemName: "questionmark.circle")
                            .font(.system(size: 16))
                    }
                    .buttonStyle(.plain)
                    .help("查看快捷鍵與滑鼠操作符號小抄")
                    .accessibilityIdentifier("shortcut.manual-keys-help")
                    .popover(isPresented: $showCheatSheet, arrowEdge: .trailing) {
                        CheatSheetPopoverView()
                    }
                }

                // Preview keys badges
                HStack(spacing: 6) {
                    Text("解析預覽：")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if previewKeys.isEmpty {
                        Text("無（或輸入空白）")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    } else {
                        ForEach(previewKeys, id: \.self) { key in
                            Text(ShortcutKeyFormatter.displaySymbol(for: key))
                                .font(.system(.caption, design: .rounded).weight(.medium))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 4))
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(nsColor: .separatorColor)))
                        }
                    }
                }
                .padding(.top, 2)
            }

            Divider()

            // Buttons
            HStack {
                Spacer()
                Button("取消") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                Button("儲存") {
                    let finalKeys = ShortcutMappingParser.parseKeysInput(keyInput)
                    onSave(finalKeys)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .accessibilityIdentifier("shortcut.manual-keys-save")
            }
        }
        .padding(20)
        .frame(width: 480)
    }
}

struct CheatSheetPopoverView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("按鍵與滑鼠操作小抄")
                    .font(.headline)
                Spacer()
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(ShortcutMappingParser.cheatSheetText, forType: .string)
                } label: {
                    Label("複製對照表", systemImage: "doc.on.doc")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .accessibilityIdentifier("shortcut.cheatsheet-copy")
            }

            ScrollView {
                Text(ShortcutMappingParser.cheatSheetText)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding(8)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))
            }
            .frame(height: 280)
        }
        .padding(14)
        .frame(width: 360, height: 340)
    }
}
