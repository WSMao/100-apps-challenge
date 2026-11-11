import SwiftUI

struct ShortcutPopoverView: View {
    @ObservedObject var store: ShortcutStore
    @ObservedObject var pinnedWindowManager: PinnedMapWindowManager
    @ObservedObject var navigation: PopoverNavigation
    @ObservedObject var contentNavigation: SharedContentNavigation
    let clipboardWriter: (String) -> Bool
    @FocusState private var searchFieldFocused: Bool
    @State private var errorMessage: String?
    @State private var successMessage: String?

    private var selectedApplicationID: String? { navigation.selectedApplicationID }

    private var selectedApplication: ShortcutApplication? {
        guard let selectedApplicationID else { return nil }
        return store.application(id: selectedApplicationID)
    }

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Button(action: navigation.openDashboard) {
                    Label("打開 DashCues", systemImage: "macwindow")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("popover.open-dashboard")
                .background(
                    navigation.focusOnOpenButton ? Color.accentColor.opacity(0.14) : .clear,
                    in: RoundedRectangle(cornerRadius: 6)
                )
                .onHover { if $0 && !navigation.searchFocused { navigation.focusOpenButton() } }

                searchField

                Divider()

                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            if !navigation.pinnedApplications.isEmpty {
                                sectionTitle("釘選的應用程式")
                                ForEach(navigation.pinnedApplications) { application in
                                    applicationRow(application).id(application.id)
                                }
                                Divider().padding(.vertical, 4)
                            }
                            sectionTitle("其他應用程式")
                            ForEach(navigation.otherApplications) { application in
                                applicationRow(application).id(application.id)
                            }
                        }
                    }
                    .onChange(of: navigation.selectedApplicationID) { id in
                        if let id { proxy.scrollTo(id) }
                    }
                }
            }
            .padding(10)
            .frame(width: 230)

            Divider()

            VStack(spacing: 0) {
                if let selectedApplication {
                    contentTabs(for: selectedApplication)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                }

                Group {
                    if let selectedApplication {
                        let currentSheet = contentNavigation.selectedSheet(for: selectedApplication.id, in: selectedApplication.sheets)
                        switch currentSheet?.kind ?? .shortcuts {
                        case .shortcuts:
                            ShortcutMapView(
                                application: selectedApplication,
                                isPinned: pinnedWindowManager.isPinned(applicationID: selectedApplication.id),
                                onTogglePin: { pinnedWindowManager.toggle(application: selectedApplication) },
                                sheetID: currentSheet?.id,
                                highlightedShortcutID: navigation.focusArea == .shortcuts ? navigation.selectedShortcutID : nil
                            )
                        case .keyValue:
                            KeyValueCheatsheetView(
                                store: store,
                                contentNavigation: contentNavigation,
                                applicationID: selectedApplication.id,
                                sheetID: currentSheet?.id,
                                onError: {
                                    errorMessage = $0
                                    successMessage = nil
                                },
                                onCopySuccess: { successMessage = $0 },
                                clipboardWriter: clipboardWriter,
                                isReadOnly: true,
                                onSearchFocusChanged: { navigation.keyValueSearchFocused = $0 },
                                onJumpToDashboard: { result in
                                    contentNavigation.requestJump(applicationID: selectedApplication.id, result: result)
                                    navigation.openDashboard()
                                }
                            )
                            .padding(12)
                        }
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "keyboard")
                                .font(.largeTitle)
                                .foregroundStyle(.secondary)
                            Text("選擇一個 App")
                                .font(.headline)
                            Text("將游標移至應用程式以查看參考內容。")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(minWidth: 350)
        }
        .frame(width: 620, height: 480)
        .background(Color(nsColor: .windowBackgroundColor))
        .accessibilityIdentifier("dashcues.popover")
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
    }

    private func contentTabs(for application: ShortcutApplication) -> some View {
        let currentSheet = contentNavigation.selectedSheet(for: application.id, in: application.sheets)
        let selectedID = currentSheet?.id
        let overflow = TabOverflowLayout(sheets: application.sheets, maxVisible: 3, selectedID: selectedID)

        return HStack(spacing: 6) {
            ForEach(overflow.visibleSheets) { sheet in
                Button {
                    contentNavigation.selectSheet(sheet, for: application.id)
                } label: {
                    Label(sheet.name, systemImage: sheet.kind == .shortcuts ? "keyboard" : "list.bullet.rectangle")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            sheet.id == selectedID ? Color.accentColor.opacity(0.18) : .clear,
                            in: Capsule()
                        )
                        .overlay {
                            Capsule().stroke(
                                sheet.id == selectedID
                                    ? Color.accentColor
                                    : Color(nsColor: .separatorColor)
                            )
                        }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier(popoverTabIdentifier(for: sheet, in: application))
                .accessibilityValue(sheet.id == selectedID ? "已選取" : "未選取")
            }

            if !overflow.overflowSheets.isEmpty {
                Menu {
                    ForEach(overflow.overflowSheets) { sheet in
                        Button(sheet.name) {
                            contentNavigation.selectSheet(sheet, for: application.id)
                        }
                    }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                        .background(Color(nsColor: .controlBackgroundColor), in: Capsule())
                        .overlay(Capsule().stroke(Color(nsColor: .separatorColor)))
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .accessibilityIdentifier("popover.tab-overflow-menu")
            }

            Spacer()
        }
    }

    private func popoverTabIdentifier(for sheet: AppSheet, in application: ShortcutApplication) -> String {
        if sheet.kind == .shortcuts && application.sheets.first(where: { $0.kind == .shortcuts })?.id == sheet.id {
            return "popover.tab.shortcuts"
        }
        if sheet.kind == .keyValue && application.sheets.first(where: { $0.kind == .keyValue })?.id == sheet.id {
            return "popover.tab.key-value"
        }
        return "popover.sheet-tab.\(sheet.id)"
    }

    private var searchField: some View {
        HStack(spacing: 4) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("搜尋 App", text: $navigation.searchText)
                .textFieldStyle(.plain)
                .focused($searchFieldFocused)
            if !navigation.searchText.isEmpty {
                Button {
                    navigation.searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(searchFieldFocused ? Color.orange : Color(nsColor: .separatorColor), lineWidth: searchFieldFocused ? 2 : 1)
        )
        .onChange(of: searchFieldFocused) { navigation.searchFocused = $0 }
        .onChange(of: navigation.searchFocused) { searchFieldFocused = $0 }
        .onAppear { DispatchQueue.main.async { searchFieldFocused = navigation.searchFocused } }
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.top, 5)
            .padding(.bottom, 2)
    }

    private func applicationRow(_ application: ShortcutApplication) -> some View {
        Button {
            navigation.focusApplication(application.id)
        } label: {
            HStack(spacing: 8) {
                ApplicationIconView(application: application, size: 18)
                Text(application.name)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text("\(application.shortcuts.count)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                (!navigation.focusOnOpenButton && selectedApplicationID == application.id) ? Color.accentColor.opacity(0.14) : .clear,
                in: RoundedRectangle(cornerRadius: 6)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("popover.application.\(application.id)")
        .onHover { isHovering in
            if isHovering {
                navigation.focusApplication(application.id)
            }
        }
    }
}
