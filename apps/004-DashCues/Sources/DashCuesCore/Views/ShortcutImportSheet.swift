import AppKit
import SwiftUI

struct ShortcutImportSheet: View {
    let application: ShortcutApplication
    @ObservedObject var store: ShortcutStore
    let clipboardWriter: (String) -> Bool
    var initialSheetID: String? = nil
    var onSuccess: ((String) -> Void)? = nil
    var onError: ((String) -> Void)? = nil
    var onDismiss: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    @State private var inputText: String = ""
    @State private var parseError: String? = nil
    @State private var copiedTemplate: Bool = false
    @State private var previewShortcuts: [ShortcutItem] = []
    @State private var selectedTargetSheetID: String? = nil
    @State private var isHoveringClose: Bool = false
    @State private var showingUnsavedCloseAlert: Bool = false
    @State private var showingNewSheetDialog: Bool = false

    private var shortcutsSheets: [ShortcutSheet] {
        let app = store.application(id: application.id) ?? application
        return app.sheets.compactMap { sheet in
            if case .shortcuts(let s) = sheet {
                return s
            }
            return nil
        }
    }

    private var selectedSheetTitle: String {
        if let id = selectedTargetSheetID,
           let sheet = shortcutsSheets.first(where: { $0.id == id }) {
            return "匯入位置：\(sheet.name)"
        }
        return "匯入位置…"
    }

    init(
        application: ShortcutApplication,
        store: ShortcutStore,
        clipboardWriter: @escaping (String) -> Bool,
        initialSheetID: String? = nil,
        onSuccess: ((String) -> Void)? = nil,
        onError: ((String) -> Void)? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        self.application = application
        self.store = store
        self.clipboardWriter = clipboardWriter
        self.initialSheetID = initialSheetID
        self.onSuccess = onSuccess
        self.onError = onError
        self.onDismiss = onDismiss

        let appSheets = application.sheets.compactMap { sheet -> ShortcutSheet? in
            if case .shortcuts(let s) = sheet { return s }
            return nil
        }
        let defaultID = initialSheetID != nil && appSheets.contains(where: { $0.id == initialSheetID })
            ? initialSheetID
            : appSheets.first?.id
        _selectedTargetSheetID = State(initialValue: defaultID)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header Bar
            HStack {
                closeButton
                Spacer()
                Text("匯入快捷鍵")
                    .font(.headline)
                Spacer()
                // Balance spacer for title centering
                Color.clear.frame(width: 14, height: 14)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)
            .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            // Main Content: Left and Right Columns
            HStack(spacing: 0) {
                leftSection
                    .frame(minWidth: 340, maxWidth: .infinity)

                Divider()

                rightSection
                    .frame(minWidth: 420, maxWidth: .infinity)
            }
        }
        .frame(minWidth: 800, idealWidth: 880, maxWidth: .infinity, minHeight: 520, idealHeight: 580, maxHeight: .infinity)
        .alert("有內容尚未匯入，確定關閉？", isPresented: $showingUnsavedCloseAlert) {
            Button("取消", role: .cancel) {}
            Button("確認", role: .destructive) {
                doDismiss()
            }
            .accessibilityIdentifier("import.confirm-close")
        }
        .sheet(isPresented: $showingNewSheetDialog) {
            SheetNameEditor(kind: .shortcuts) { newName in
                do {
                    let newID = try store.createSheet(kind: .shortcuts, name: newName, applicationID: application.id)
                    selectedTargetSheetID = newID
                    return nil
                } catch let error as ShortcutStoreError {
                    return error.errorDescription ?? error.localizedDescription
                } catch {
                    return error.localizedDescription
                }
            }
        }
        .onAppear {
            if selectedTargetSheetID == nil {
                selectedTargetSheetID = shortcutsSheets.first?.id
            }
        }
    }

    // MARK: - Close Button

    private var closeButton: some View {
        Button {
            handleClose()
        } label: {
            ZStack {
                Circle()
                    .fill(isHoveringClose ? Color(nsColor: .systemRed) : Color(red: 1.0, green: 0.38, blue: 0.35))
                    .frame(width: 13, height: 13)
                    .overlay(Circle().stroke(Color.black.opacity(0.18), lineWidth: 0.5))
                if isHoveringClose {
                    Image(systemName: "xmark")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Color.black.opacity(0.65))
                }
            }
        }
        .buttonStyle(.plain)
        .onHover { isHoveringClose = $0 }
        .help("關閉")
        .testAnchor("import.close-button")
    }

    private func doDismiss() {
        if let onDismiss {
            onDismiss()
        } else {
            dismiss()
        }
    }

    private func handleClose() {
        if !previewShortcuts.isEmpty {
            showingUnsavedCloseAlert = true
        } else {
            doDismiss()
        }
    }

    // MARK: - Left Section

    private var leftSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("快捷鍵 Mapping 檔案 (JSON)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
            }

            ZStack(alignment: .topLeading) {
                TextEditor(text: $inputText)
                    .font(.system(.body, design: .monospaced))
                    .padding(6)
                    .background(Color(nsColor: .textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))
                    .accessibilityIdentifier("import.input-text")

                if inputText.isEmpty {
                    Text("貼上快捷鍵")
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(Color.secondary.opacity(0.55))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .allowsHitTesting(false)
                        .testAnchor("import.placeholder")
                }
            }
            .frame(maxHeight: .infinity)

            if let parseError {
                Text(parseError)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .testAnchor("import.parse-error")
            }

            HStack {
                Button {
                    copyTemplate()
                } label: {
                    Label(copiedTemplate ? "已複製製作格式！" : "複製製作格式", systemImage: copiedTemplate ? "checkmark" : "doc.on.doc")
                }
                .buttonStyle(.bordered)
                .testAnchor("import.copy-template")

                Spacer()

                Button {
                    generatePreview()
                } label: {
                    Label("產生", systemImage: "wand.and.stars")
                }
                .buttonStyle(.borderedProminent)
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .testAnchor("import.generate-button")
            }
        }
        .padding(16)
    }

    private func copyTemplate() {
        if clipboardWriter(ShortcutMappingParser.templatePrompt) {
            copiedTemplate = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                copiedTemplate = false
            }
        }
    }

    private func generatePreview() {
        do {
            let parsed = try ShortcutMappingParser.parse(inputText)
            previewShortcuts = parsed
            parseError = nil
        } catch {
            parseError = "JSON 格式不正確，請檢查內容符合格式。"
        }
    }

    // MARK: - Right Section

    private var rightSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("預覽清單")
                    .font(.subheadline.weight(.semibold))
                if !previewShortcuts.isEmpty {
                    Text("(\(previewShortcuts.count))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()

                if !previewShortcuts.isEmpty {
                    Button("清空") {
                        previewShortcuts.removeAll()
                    }
                    .buttonStyle(.plain)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("import.clear-preview")
                }

                Button {
                    addEmptyShortcut()
                } label: {
                    Label("新增", systemImage: "plus")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("import.add-preview-item")
            }

            if previewShortcuts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 32))
                        .foregroundStyle(.secondary)
                    Text("尚未產生快捷鍵預覽")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Text("在左側輸入框貼上 JSON 快捷鍵檔案後，點擊「產生」即可在此預覽與編輯。")
                        .font(.caption)
                        .foregroundStyle(.secondary.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .testAnchor("import.empty-preview")
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach($previewShortcuts) { $shortcut in
                            PreviewShortcutRow(item: $shortcut) {
                                previewShortcuts.removeAll { $0.id == shortcut.id }
                            }
                        }
                    }
                    .padding(4)
                }
                .testAnchor("import.preview-list")
            }

            Divider()

            // Bottom controls: Dropdown at left, Import button at right
            HStack(spacing: 12) {
                targetSheetMenu

                Spacer()

                Button("匯入") {
                    confirmImport()
                }
                .buttonStyle(.borderedProminent)
                .disabled(previewShortcuts.isEmpty || selectedTargetSheetID == nil)
                .testAnchor("import.confirm-button")
            }
        }
        .padding(16)
    }

    private func addEmptyShortcut() {
        let newItem = ShortcutItem(title: "未命名快捷鍵", keys: ["⌘", "K"], tags: [])
        previewShortcuts.append(newItem)
    }

    private var targetSheetMenu: some View {
        Menu {
            Button {
                showingNewSheetDialog = true
            } label: {
                Label("新建 sheet…", systemImage: "plus")
            }
            .accessibilityIdentifier("import.new-sheet")

            Divider()

            ForEach(shortcutsSheets) { sheet in
                Button {
                    selectedTargetSheetID = sheet.id
                } label: {
                    HStack {
                        Text(sheet.name)
                        if selectedTargetSheetID == sheet.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
                .accessibilityIdentifier("import.target-sheet.\(sheet.id)")
            }
        } label: {
            HStack(spacing: 6) {
                Text(selectedSheetTitle)
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .testAnchor("import.location-menu")
    }

    private func confirmImport() {
        guard let targetID = selectedTargetSheetID else { return }
        guard !previewShortcuts.isEmpty else { return }

        let count = previewShortcuts.count
        let sheetName = shortcutsSheets.first(where: { $0.id == targetID })?.name ?? "快捷鍵"

        do {
            for item in previewShortcuts {
                try store.saveShortcut(item, applicationID: application.id, sheetID: targetID)
            }
            onSuccess?("已成功匯入 \(count) 個快捷鍵至「\(sheetName)」")
            doDismiss()
        } catch {
            onError?("匯入失敗：\(error.localizedDescription)")
        }
    }
}

// MARK: - Preview Row View

private struct PreviewShortcutRow: View {
    @Binding var item: ShortcutItem
    let onDelete: () -> Void

    @State private var isRecordingKeys = false
    @State private var keyCaptureMonitor: Any?
    @State private var newTagText = ""
    @State private var showingAddTag = false
    @State private var showingManualInput = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                // Title Field
                TextField("功能名稱", text: $item.title)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("import.row-title.\(item.id)")

                Spacer(minLength: 4)

                // Key Combination Button / Recorder
                Button {
                    toggleRecording()
                } label: {
                    HStack(spacing: 3) {
                        if isRecordingKeys {
                            Text("請按下快捷鍵…")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color.accentColor)
                        } else if item.keys.isEmpty {
                            Text("設定按鍵")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(item.keys, id: \.self) { key in
                                Text(ShortcutKeyFormatter.displaySymbol(for: key))
                                    .font(.system(.caption, design: .rounded).weight(.medium))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 4))
                                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(nsColor: .separatorColor)))
                            }
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                    .background(isRecordingKeys ? Color.accentColor.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 5))
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(isRecordingKeys ? Color.accentColor : Color.clear, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .help(isRecordingKeys ? "按下鍵盤按鍵來錄製，或按 Esc 取消" : "點擊錄製快捷鍵")
                .accessibilityIdentifier("import.row-keys.\(item.id)")

                // Delete Button
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.red.opacity(0.8))
                }
                .buttonStyle(.plain)
                .help("刪除此項")
                .accessibilityIdentifier("import.row-delete.\(item.id)")
            }

            // Tags Row
            HStack(spacing: 6) {
                ForEach(item.tags, id: \.self) { tag in
                    TagChip(name: tag) {
                        item.tags.removeAll { $0 == tag }
                    }
                }

                if showingAddTag {
                    TextField("標籤名稱", text: $newTagText)
                        .textFieldStyle(.roundedBorder)
                        .font(.caption)
                        .frame(width: 90)
                        .onSubmit {
                            addTag()
                        }
                    Button("加入") {
                        addTag()
                    }
                    .font(.caption)
                    .buttonStyle(.borderless)

                    Button("取消") {
                        newTagText = ""
                        showingAddTag = false
                    }
                    .font(.caption)
                    .buttonStyle(.borderless)
                } else {
                    Button {
                        showingAddTag = true
                    } label: {
                        Label("標籤", systemImage: "plus")
                            .font(.caption2)
                    }
                    .buttonStyle(.borderless)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("import.row-add-tag.\(item.id)")
                }
            }

            // Notes Row
            HStack(spacing: 4) {
                Image(systemName: "note.text")
                    .font(.caption2)
                    .foregroundStyle(.secondary.opacity(0.6))
                TextField("備註（選填）", text: $item.notes)
                    .textFieldStyle(.plain)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("import.row-notes.\(item.id)")
            }
        }
        .padding(8)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))
        .contextMenu {
            Button("手動輸入…") {
                showingManualInput = true
            }
        }
        .sheet(isPresented: $showingManualInput) {
            ManualShortcutKeySheet(
                item: item,
                onSave: { updatedKeys in
                    item.keys = updatedKeys
                }
            )
        }
        .onDisappear {
            teardownMonitor()
        }
    }

    private func toggleRecording() {
        if isRecordingKeys {
            isRecordingKeys = false
            teardownMonitor()
        } else {
            isRecordingKeys = true
            setupMonitor()
        }
    }

    private func setupMonitor() {
        teardownMonitor()
        keyCaptureMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let flags = event.modifierFlags.intersection([.command, .control, .option, .shift])
            if event.keyCode == 53 && flags.isEmpty { // Esc
                isRecordingKeys = false
                teardownMonitor()
                return nil
            }
            let recorded = ShortcutKeyFormatter.keys(keyCode: event.keyCode, flags: event.modifierFlags, characters: event.characters)
            item.keys = recorded
            isRecordingKeys = false
            teardownMonitor()
            return nil
        }
    }

    private func teardownMonitor() {
        if let keyCaptureMonitor {
            NSEvent.removeMonitor(keyCaptureMonitor)
            self.keyCaptureMonitor = nil
        }
    }

    private func addTag() {
        let cleaned = newTagText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleaned.isEmpty && !item.tags.contains(cleaned) {
            item.tags.append(cleaned)
        }
        newTagText = ""
        showingAddTag = false
    }
}

private extension View {
    func testAnchor(_ identifier: String) -> some View {
        self
            .accessibilityIdentifier(identifier)
            .background(
                ViewAnchor {
                    $0.setAccessibilityElement(false)
                    $0.setAccessibilityIdentifier(identifier)
                }
                .accessibilityHidden(true)
            )
    }
}
