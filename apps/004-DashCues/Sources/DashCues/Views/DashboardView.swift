import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct DashboardView: View {
    @ObservedObject var store: ShortcutStore
    @ObservedObject var contentNavigation: SharedContentNavigation
    let onHotKeyChanged: @MainActor (HotKeyConfiguration) throws -> Void
    var clipboardWriter: (String) -> Bool = SystemClipboardWriter.write

    @State private var selectedApplicationID: String?
    @State private var searchText = ""
    @State private var showingApplicationEditor = false
    @State private var showingSettings = false
    @State private var applicationToEdit: ShortcutApplication?
    @State private var applicationPendingDelete: ShortcutApplication?
    @State private var errorMessage: String?
    @State private var successMessage: String?

    private var selectedApplication: ShortcutApplication? {
        guard let selectedApplicationID else { return nil }
        return store.application(id: selectedApplicationID)
    }

    private var filteredApplications: [ShortcutApplication] {
        guard !searchText.isEmpty else { return store.applications }
        return store.applications.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
                || $0.bundleIdentifier.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var sidebarHeader: some View {
        HStack(spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("搜尋 App", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))

            Button {
                applicationToEdit = nil
                showingApplicationEditor = true
            } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.borderless)
            .help("新增 App")
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }

    private var applicationList: some View {
        List(selection: $selectedApplicationID) {
                ForEach(filteredApplications) { application in
                    HStack(spacing: 8) {
                        ApplicationIconView(application: application, size: 18)
                        Text(application.name)
                        Spacer()
                        if application.isPinned {
                            Image(systemName: "pin.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .help("已釘選")
                        }
                    }
                    .tag(application.id)
                    .accessibilityIdentifier("dashboard.application.\(application.id)")
                }
                .onMove(perform: searchText.isEmpty ? { source, destination in
                    performStoreAction {
                        try store.moveApplications(fromOffsets: source, toOffset: destination)
                    }
                } : nil)
            }
    }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                sidebarHeader
                applicationList
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 240)
        } detail: {
            if let selectedApplication {
                applicationDetail(selectedApplication)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "keyboard")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("選擇一個 App")
                        .font(.headline)
                }
            }
        }
        .frame(minWidth: 850, minHeight: 580)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingSettings.toggle()
                } label: {
                    Image(systemName: "gearshape")
                }
                .help("設定")
                .popover(isPresented: $showingSettings, arrowEdge: .bottom) {
                    settingsSection
                }
            }
        }
        .sheet(isPresented: $showingApplicationEditor) {
            ApplicationEditorSheet(existingApplication: applicationToEdit) { name, bundleIdentifier, symbolName, iconData, tagEdits in
                performStoreAction {
                    if let applicationToEdit {
                        try store.updateApplicationDetails(
                            id: applicationToEdit.id,
                            name: name,
                            bundleIdentifier: bundleIdentifier,
                            symbolName: symbolName,
                            customIconData: .some(iconData),
                            tagEdits: tagEdits
                        )
                    } else {
                        selectedApplicationID = try store.addApplication(
                            name: name,
                            bundleIdentifier: bundleIdentifier,
                            symbolName: symbolName,
                            customIconData: iconData
                        )
                    }
                }
            }
        }
        .alert("無法完成操作", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("好", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .overlay(alignment: .bottom) {
            if let successMessage {
                Text(successMessage)
                    .accessibilityIdentifier("key-value.copy-feedback")
                    .padding(10)
                    .background(.regularMaterial, in: Capsule())
                    .padding()
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            self.successMessage = nil
                        }
                    }
            }
        }
        .confirmationDialog(
            "刪除 App？",
            isPresented: Binding(
                    get: { applicationPendingDelete != nil },
                    set: { if !$0 { applicationPendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("刪除", role: .destructive) {
                    guard let applicationPendingDelete else { return }
                    performStoreAction {
                        try store.deleteApplication(id: applicationPendingDelete.id)
                        selectedApplicationID = store.applications.first?.id
                    }
                    self.applicationPendingDelete = nil
            }
            Button("取消", role: .cancel) {
                    applicationPendingDelete = nil
            }
        } message: {
            Text("「\(applicationPendingDelete?.name ?? "")」及其快捷鍵都會被刪除。")
        }
        .onAppear {
            selectedApplicationID = selectedApplicationID ?? store.applications.first?.id
            followPendingJump()
        }
        .onChange(of: contentNavigation.pendingJump) { _ in followPendingJump() }
    }

    private func applicationDetail(_ application: ShortcutApplication) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                ApplicationIconView(application: application, size: 44)
                VStack(alignment: .leading) {
                    Text(application.name)
                        .font(.largeTitle.weight(.semibold))
                    Text(application.bundleIdentifier.isEmpty ? "自訂 App" : application.bundleIdentifier)
                        .foregroundStyle(.secondary)
                }
                contentTabs(for: application)
                    .padding(.leading, 12)
                Spacer(minLength: 8)
                Button {
                    performStoreAction { try store.setPinned(!application.isPinned, applicationID: application.id) }
                } label: {
                    Label(
                        application.isPinned ? "取消釘選" : "釘選",
                        systemImage: application.isPinned ? "pin.slash" : "pin"
                    )
                }
                if !application.isBuiltIn {
                    Menu {
                        Button("編輯 App…") {
                            applicationToEdit = application
                            showingApplicationEditor = true
                        }
                        Button("刪除 App", role: .destructive) {
                            applicationPendingDelete = application
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                }
            }

            if contentNavigation.selectedContentType == .shortcuts {
                ShortcutListView(store: store, applicationID: application.id) { errorMessage = $0 }
            } else {
                KeyValueCheatsheetView(
                    store: store,
                    contentNavigation: contentNavigation,
                    applicationID: application.id,
                    onError: {
                        errorMessage = $0
                        successMessage = nil
                    },
                    onCopySuccess: { successMessage = $0 },
                    clipboardWriter: clipboardWriter
                )
            }
        }
        .padding(24)
    }

    private func followPendingJump() {
        guard let jump = contentNavigation.pendingJump,
              store.application(id: jump.applicationID) != nil else { return }
        searchText = ""
        selectedApplicationID = jump.applicationID
    }

    private func contentTabs(for application: ShortcutApplication) -> some View {
        let selectedShortcutSheetID = application.sheets.first { $0.kind == .shortcuts }?.id
        let selectedKeyValueID = contentNavigation.selectedCheatsheetID(
            for: application.id,
            availableIDs: application.keyValueCheatsheets.map(\.id)
        )
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(application.sheets) { sheet in
                    let isSelected = sheet.kind == .shortcuts
                        ? contentNavigation.selectedContentType == .shortcuts && sheet.id == selectedShortcutSheetID
                        : contentNavigation.selectedContentType == .keyValue && sheet.id == selectedKeyValueID
                    sheetTab(
                        title: sheet.name,
                        systemImage: sheet.kind == .shortcuts ? "keyboard" : "list.bullet.rectangle",
                        isSelected: isSelected,
                        identifier: "dashboard.sheet-tab.\(sheet.kind == .shortcuts ? "shortcuts" : "key-value").\(sheet.id)"
                    ) {
                        if sheet.kind == .shortcuts {
                            contentNavigation.selectContentType(.shortcuts)
                        } else {
                            contentNavigation.selectCheatsheet(sheet.id, for: application.id)
                            contentNavigation.selectContentType(.keyValue)
                        }
                    }
                }
                if application.keyValueCheatsheets.isEmpty {
                    // Entry point for creating the app's first Key-Value sheet.
                    sheetTab(
                        title: "Key-Value",
                        systemImage: "list.bullet.rectangle",
                        isSelected: contentNavigation.selectedContentType == .keyValue,
                        identifier: "dashboard.tab.key-value"
                    ) {
                        contentNavigation.selectContentType(.keyValue)
                    }
                }
            }
        }
    }

    private func sheetTab(
        title: String,
        systemImage: String,
        isSelected: Bool,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor.opacity(0.18) : Color.clear, in: Capsule())
                .overlay {
                    Capsule().stroke(isSelected ? Color.accentColor : Color(nsColor: .separatorColor))
                }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityValue(isSelected ? "已選取" : "未選取")
    }

    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("設定")
                .font(.title3.weight(.semibold))

            VStack(alignment: .leading, spacing: 6) {
                Text("全域快捷鍵")
                    .font(.headline)
                Text("點擊下方區域後按下組合鍵")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HotKeyRecorder(configuration: store.hotKey) { configuration in
                    performStoreAction {
                        try onHotKeyChanged(configuration)
                    }
                }
                .frame(width: 200, height: 34)
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("備份")
                    .font(.headline)
                HStack {
                    Button("備份至檔案…") {
                        showingSettings = false
                        chooseBackupLocation()
                    }
                    Button("從備份還原…") {
                        showingSettings = false
                        chooseBackupToRestore()
                    }
                }
            }
        }
        .padding(16)
        .frame(width: 260)
    }

    private func chooseBackupLocation() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "DashCues-Backup.json"
        panel.canCreateDirectories = true
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            performStoreAction {
                try store.exportBackup(to: url)
                successMessage = "備份已儲存。"
            }
        }
    }

    private func chooseBackupToRestore() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let alert = NSAlert()
            alert.messageText = "還原 DashCues 備份？"
            alert.informativeText = "目前的快捷鍵資料將被備份內容取代。此操作無法自動復原。"
            alert.alertStyle = .warning
            alert.addButton(withTitle: "還原")
            alert.addButton(withTitle: "取消")
            guard alert.runModal() == .alertFirstButtonReturn else { return }
            performStoreAction {
                let previousHotKey = store.hotKey
                try store.restoreBackup(from: url)
                do {
                    try onHotKeyChanged(store.hotKey)
                } catch {
                    try store.updateHotKey(previousHotKey)
                    throw error
                }
                selectedApplicationID = store.applications.first?.id
                successMessage = "備份已還原。"
            }
        }
    }

    private func performStoreAction(_ action: () throws -> Void) {
        do {
            try action()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
