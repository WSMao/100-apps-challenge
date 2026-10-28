import SwiftUI

struct ShortcutPopoverView: View {
    @ObservedObject var store: ShortcutStore
    @ObservedObject var pinnedWindowManager: PinnedMapWindowManager
    @ObservedObject var navigation: PopoverNavigation
    @FocusState private var searchFieldFocused: Bool

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

            Group {
                if let selectedApplication {
                    ShortcutMapView(
                        application: selectedApplication,
                        isPinned: pinnedWindowManager.isPinned(applicationID: selectedApplication.id),
                        onTogglePin: { pinnedWindowManager.toggle(application: selectedApplication) },
                        highlightedShortcutID: navigation.focusArea == .shortcuts ? navigation.selectedShortcutID : nil
                    )
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "keyboard")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("選擇一個 App")
                            .font(.headline)
                        Text("將游標移至應用程式以查看快捷鍵地圖。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(minWidth: 350)
        }
        .frame(width: 620, height: 480)
        .background(Color(nsColor: .windowBackgroundColor))
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
        .onHover { isHovering in
            if isHovering {
                navigation.focusApplication(application.id)
            }
        }
    }
}
