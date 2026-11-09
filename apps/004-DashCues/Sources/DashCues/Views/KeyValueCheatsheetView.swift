import AppKit
import SwiftUI

struct KeyValueCheatsheetView: View {
    @ObservedObject var store: ShortcutStore
    let applicationID: String
    let onError: (String) -> Void
    let onCopySuccess: (String) -> Void
    let clipboardWriter: (String) -> Bool

    @State private var selectedCheatsheetID: String?
    @State private var nameEditor: CheatsheetNameRequest?
    @State private var entryEditor: KeyValueEntry?
    @State private var cheatsheetPendingDelete: KeyValueCheatsheet?
    @State private var expandedEntryIDs = Set<String>()

    private var application: ShortcutApplication? {
        store.application(id: applicationID)
    }

    private var cheatsheets: [KeyValueCheatsheet] {
        application?.keyValueCheatsheets ?? []
    }

    private var selectedCheatsheet: KeyValueCheatsheet? {
        cheatsheets.first { $0.id == selectedCheatsheetID }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if cheatsheets.isEmpty {
                VStack(spacing: 10) {
                    Label("尚無 Key-Value 清單", systemImage: "list.bullet.rectangle")
                        .font(.headline)
                    Text("建立清單來整理這個 App 的參考內容。")
                        .foregroundStyle(.secondary)
                    Button("建立清單") { createCheatsheet() }
                        .accessibilityIdentifier("key-value.create-cheatsheet")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                cheatsheetToolbar
                if let selectedCheatsheet {
                    entryList(selectedCheatsheet)
                }
            }
        }
        .accessibilityIdentifier("key-value.management")
        .onAppear(perform: selectFirstCheatsheetIfNeeded)
        .onChange(of: applicationID) { _ in selectFirstCheatsheetIfNeeded() }
        .onChange(of: cheatsheets.map(\.id)) { ids in
            if !ids.contains(selectedCheatsheetID ?? "") {
                selectedCheatsheetID = ids.first
            }
        }
        .sheet(item: $nameEditor) { request in
            CheatsheetNameEditor(
                title: request.title,
                initialName: request.initialName,
                onSave: { saveCheatsheetName($0, request: request) }
            )
        }
        .sheet(item: $entryEditor) { entry in
            KeyValueEntryEditor(
                entry: entry,
                hasDuplicateKey: { key in
                    guard let selectedCheatsheet else { return false }
                    return store.hasDuplicateKey(
                        key,
                        cheatsheetID: selectedCheatsheet.id,
                        applicationID: applicationID,
                        excludingEntryID: entry.id
                    )
                },
                onSave: { saveEntry($0, cheatsheetID: selectedCheatsheetID) }
            )
        }
        .confirmationDialog(
            "刪除 Key-Value 清單？",
            isPresented: Binding(
                get: { cheatsheetPendingDelete != nil },
                set: { if !$0 { cheatsheetPendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("刪除", role: .destructive) {
                guard let cheatsheetPendingDelete else { return }
                performStoreAction {
                    try store.deleteKeyValueCheatsheet(
                        id: cheatsheetPendingDelete.id,
                        applicationID: applicationID
                    )
                }
                self.cheatsheetPendingDelete = nil
            }
            Button("取消", role: .cancel) { cheatsheetPendingDelete = nil }
        } message: {
            Text("「\(cheatsheetPendingDelete?.name ?? "")」及其內容都會被刪除。")
        }
    }

    private var cheatsheetToolbar: some View {
        HStack(spacing: 8) {
            Picker("Key-Value 清單", selection: $selectedCheatsheetID) {
                ForEach(cheatsheets) { cheatsheet in
                    Text(cheatsheet.name).tag(Optional(cheatsheet.id))
                }
            }
            .labelsHidden()
            .accessibilityIdentifier("key-value.cheatsheet-selector")
            .frame(maxWidth: 240)

            Button("新增清單", action: createCheatsheet)
                .accessibilityIdentifier("key-value.add-cheatsheet")
            Button("重新命名") {
                guard let selectedCheatsheet else { return }
                nameEditor = CheatsheetNameRequest(
                    title: "重新命名清單",
                    initialName: selectedCheatsheet.name,
                    cheatsheetID: selectedCheatsheet.id
                )
            }
            .accessibilityIdentifier("key-value.rename-cheatsheet")
            Button("刪除清單", role: .destructive) {
                cheatsheetPendingDelete = selectedCheatsheet
            }
            .accessibilityIdentifier("key-value.delete-cheatsheet")
            Spacer()
            Button {
                entryEditor = KeyValueEntry(key: "", value: "")
            } label: {
                Label("新增項目", systemImage: "plus")
            }
            .disabled(selectedCheatsheet == nil)
            .accessibilityIdentifier("key-value.add-entry")
        }
    }

    private func entryList(_ cheatsheet: KeyValueCheatsheet) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if cheatsheet.entries.isEmpty {
                VStack(spacing: 10) {
                    Label("此清單尚無項目", systemImage: "text.alignleft")
                        .font(.headline)
                    Text("新增 Key 與 Value 來建立第一個參考項目。")
                        .foregroundStyle(.secondary)
                    Button("新增項目") { entryEditor = KeyValueEntry(key: "", value: "") }
                        .accessibilityIdentifier("key-value.add-first-entry")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(cheatsheet.entries) { entry in
                            KeyValueEntryRow(
                                entry: entry,
                                isExpanded: Binding(
                                    get: { expandedEntryIDs.contains(entry.id) },
                                    set: { expanded in
                                        if expanded {
                                            expandedEntryIDs.insert(entry.id)
                                        } else {
                                            expandedEntryIDs.remove(entry.id)
                                        }
                                    }
                                ),
                                onEdit: { entryEditor = entry },
                                onDelete: {
                                    performStoreAction {
                                        try store.deleteKeyValueEntry(
                                            id: entry.id,
                                            cheatsheetID: cheatsheet.id,
                                            applicationID: applicationID
                                        )
                                    }
                                },
                                onCopy: copy,
                                onMove: { draggedEntryID in
                                    moveEntry(draggedEntryID, to: entry.id, in: cheatsheet)
                                }
                            )
                        }
                    }
                    .padding(8)
                }
                .accessibilityIdentifier("key-value.entries")
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func copy(_ text: String, field: String) {
        guard clipboardWriter(text) else {
            onError("無法複製 \(field) 到剪貼簿。")
            return
        }
        onCopySuccess("\(field) 已複製。")
    }

    private func moveEntry(_ draggedEntryID: String, to targetEntryID: String, in cheatsheet: KeyValueCheatsheet) {
        guard let source = cheatsheet.entries.firstIndex(where: { $0.id == draggedEntryID }),
              let target = cheatsheet.entries.firstIndex(where: { $0.id == targetEntryID }),
              source != target
        else {
            return
        }

        let destination = source < target ? target + 1 : target
        performStoreAction {
            try store.moveKeyValueEntries(
                fromOffsets: IndexSet(integer: source),
                toOffset: destination,
                cheatsheetID: cheatsheet.id,
                applicationID: applicationID
            )
        }
    }

    private func createCheatsheet() {
        nameEditor = CheatsheetNameRequest(title: "新增 Key-Value 清單", initialName: "")
    }

    private func selectFirstCheatsheetIfNeeded() {
        if !cheatsheets.contains(where: { $0.id == selectedCheatsheetID }) {
            selectedCheatsheetID = cheatsheets.first?.id
        }
    }

    private func saveCheatsheetName(_ name: String, request: CheatsheetNameRequest) -> Bool {
        do {
            if let cheatsheetID = request.cheatsheetID {
                try store.renameKeyValueCheatsheet(
                    id: cheatsheetID,
                    name: name,
                    applicationID: applicationID
                )
            } else {
                selectedCheatsheetID = try store.createKeyValueCheatsheet(
                    name: name,
                    applicationID: applicationID
                )
            }
            return true
        } catch {
            onError(error.localizedDescription)
            return false
        }
    }

    private func saveEntry(_ entry: KeyValueEntry, cheatsheetID: String?) -> Bool {
        guard let cheatsheetID else { return false }
        do {
            try store.saveKeyValueEntry(entry, cheatsheetID: cheatsheetID, applicationID: applicationID)
            return true
        } catch {
            onError(error.localizedDescription)
            return false
        }
    }

    private func performStoreAction(_ action: () throws -> Void) {
        do {
            try action()
        } catch {
            onError(error.localizedDescription)
        }
    }
}

private struct KeyValueEntryRow: View {
    let entry: KeyValueEntry
    @Binding var isExpanded: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onCopy: (String, String) -> Void
    let onMove: (String) -> Void

    private var preview: String {
        let key = entry.key.isEmpty ? "（空白 Key）" : entry.key
        let value = entry.value.isEmpty ? "（空白 Value）" : entry.value
        let singleLine = "\(key) — \(value)"
            .components(separatedBy: .newlines)
            .joined(separator: " ")
        guard singleLine.count > 100 else { return singleLine }
        return String(singleLine.prefix(99)) + "…"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button {
                    isExpanded.toggle()
                } label: {
                    Text(preview)
                        .font(.headline)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(preview)
                .accessibilityIdentifier("key-value.entry-preview.\(entry.id)")

                Button("編輯", action: onEdit)
                    .accessibilityIdentifier("key-value.edit-entry.\(entry.id)")
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .help("刪除項目")
                .accessibilityLabel("刪除項目")
                .accessibilityIdentifier("key-value.delete-entry.\(entry.id)")
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Key")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(entry.key.isEmpty ? "（空白 Key）" : entry.key)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("key-value.entry-key-text")
                        Button("複製 Key") { onCopy(entry.key, "Key") }
                            .accessibilityIdentifier("key-value.copy-key.\(entry.id)")
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Value")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(entry.value.isEmpty ? "（空白 Value）" : entry.value)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityIdentifier("key-value.entry-value-text")
                        Button("複製 Value") { onCopy(entry.value, "Value") }
                            .accessibilityIdentifier("key-value.copy-value.\(entry.id)")
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
        .accessibilityElement(children: .contain)
        .draggable(entry.id)
        .dropDestination(for: String.self) { draggedIDs, _ in
            guard let draggedEntryID = draggedIDs.first else { return false }
            onMove(draggedEntryID)
            return true
        }
        .help("拖曳以重新排序")
    }
}

enum SystemClipboardWriter {
    static func write(_ text: String) -> Bool {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        return pasteboard.setString(text, forType: .string)
    }
}

private struct CheatsheetNameRequest: Identifiable {
    let id = UUID()
    let title: String
    let initialName: String
    var cheatsheetID: String?

    init(title: String, initialName: String, cheatsheetID: String? = nil) {
        self.title = title
        self.initialName = initialName
        self.cheatsheetID = cheatsheetID
    }
}

private struct CheatsheetNameEditor: View {
    let title: String
    let onSave: (String) -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var name: String

    init(title: String, initialName: String, onSave: @escaping (String) -> Bool) {
        self.title = title
        self.onSave = onSave
        _name = State(initialValue: initialName)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title).font(.headline)
            TextField("清單名稱", text: $name)
                .accessibilityIdentifier("key-value.cheatsheet-name")
            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("儲存") {
                    if onSave(name) { dismiss() }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("key-value.save-cheatsheet-name")
            }
        }
        .padding(20)
        .frame(width: 360)
    }
}

private struct KeyValueEntryEditor: View {
    let entry: KeyValueEntry
    let hasDuplicateKey: (String) -> Bool
    let onSave: (KeyValueEntry) -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var key: String
    @State private var value: String

    init(
        entry: KeyValueEntry,
        hasDuplicateKey: @escaping (String) -> Bool,
        onSave: @escaping (KeyValueEntry) -> Bool
    ) {
        self.entry = entry
        self.hasDuplicateKey = hasDuplicateKey
        self.onSave = onSave
        _key = State(initialValue: entry.key)
        _value = State(initialValue: entry.value)
    }

    private var workingEntry: KeyValueEntry {
        KeyValueEntry(id: entry.id, key: key, value: value)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(entry.key.isEmpty && entry.value.isEmpty ? "新增項目" : "編輯項目")
                .font(.headline)

            Text("Key")
                .font(.subheadline.weight(.semibold))
            TextEditor(text: $key)
                .accessibilityIdentifier("key-value.entry-key")
                .frame(minHeight: 72)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))

            Text("Value")
                .font(.subheadline.weight(.semibold))
            TextEditor(text: $value)
                .accessibilityIdentifier("key-value.entry-value")
                .frame(minHeight: 120)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))

            if hasDuplicateKey(key) {
                Text("此清單已有相同 Key；仍可儲存。")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .accessibilityIdentifier("key-value.duplicate-key-warning")
            }

            HStack {
                Spacer()
                Button("取消") { dismiss() }
                Button("儲存") {
                    if onSave(workingEntry) { dismiss() }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(workingEntry.isBlank)
                .accessibilityIdentifier("key-value.save-entry")
            }
        }
        .padding(20)
        .frame(width: 460)
    }
}
