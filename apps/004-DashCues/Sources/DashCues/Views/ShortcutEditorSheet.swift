import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationEditorSheet: View {
    let existingApplication: ShortcutApplication?
    let onSave: (String, String, String, [TagEdit]?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var bundleIdentifier: String
    private let symbolName: String
    @State private var tagRows: [TagRow]

    private struct TagRow: Identifiable {
        let id = UUID()
        let original: String
        var name: String
    }

    init(
        existingApplication: ShortcutApplication?,
        onSave: @escaping (String, String, String, [TagEdit]?) -> Void
    ) {
        self.existingApplication = existingApplication
        self.onSave = onSave
        _name = State(initialValue: existingApplication?.name ?? "")
        _bundleIdentifier = State(initialValue: existingApplication?.bundleIdentifier ?? "")
        symbolName = existingApplication?.symbolName ?? "app"
        _tagRows = State(initialValue: (existingApplication?.tags ?? []).map { TagRow(original: $0, name: $0) })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ApplicationIconView(
                    application: ShortcutApplication(
                        name: name,
                        bundleIdentifier: bundleIdentifier,
                        symbolName: symbolName
                    ),
                    size: 48
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(bundleIdentifier.isEmpty ? "尚未選擇 App" : bundleIdentifier)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                    Button("選擇 App…", action: chooseApplication)
                }
            }

            TextField("App 名稱", text: $name)

            if existingApplication != nil { tagSection }
        }
        .padding()
        .frame(width: 380)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("儲存") {
                    onSave(name, bundleIdentifier, symbolName, existingApplication == nil ? nil : tagRows.map { TagEdit(original: $0.original, name: $0.name) })
                    dismiss()
                }
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !tagsAreValid)
            }
        }
    }

    private var tagsAreValid: Bool {
        let keys = tagRows.map { TagList.key($0.name) }
        return !keys.contains("") && Set(keys).count == keys.count
    }

    private func usageCount(_ tag: String) -> Int {
        (existingApplication?.shortcuts ?? []).filter { $0.tags.contains { TagList.key($0) == TagList.key(tag) } }.count
    }

    private var tagSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("標籤管理").font(.headline)
            if tagRows.isEmpty {
                Text("此 App 還沒有標籤。").font(.caption).foregroundStyle(.secondary)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach($tagRows) { $row in
                            HStack {
                                TextField("標籤名稱", text: $row.name)
                                Text("\(usageCount(row.original)) 個快捷鍵")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Button {
                                    tagRows.removeAll { $0.id == row.id }
                                } label: {
                                    Image(systemName: "trash").foregroundStyle(.red)
                                }
                                .buttonStyle(.borderless)
                                .help("刪除標籤")
                            }
                        }
                    }
                }
                .frame(maxHeight: 180)
            }
            Text(tagsAreValid ? "變更會在按下「儲存」後套用；刪除標籤會從所有快捷鍵移除。" : "標籤名稱不可空白或重複。")
                .font(.caption2)
                .foregroundStyle(tagsAreValid ? Color.secondary : Color.red)
        }
    }

    private func chooseApplication() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.application]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.directoryURL = URL(fileURLWithPath: "/Applications", isDirectory: true)
        panel.prompt = "選擇"
        guard panel.runModal() == .OK, let url = panel.url else { return }

        let bundle = Bundle(url: url)
        bundleIdentifier = bundle?.bundleIdentifier ?? ""
        ApplicationIconProvider.invalidate(bundleIdentifier: bundleIdentifier)
        name = bundle?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
            ?? bundle?.object(forInfoDictionaryKey: "CFBundleName") as? String
            ?? url.deletingPathExtension().lastPathComponent
    }
}
