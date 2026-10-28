import SwiftUI

/// Search box above the shortcut list: keyword, tag chips and an optional key-combination mode.
struct ShortcutSearchBar: View {
    @ObservedObject var model: ShortcutListModel
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    FlowLayout(spacing: 6) {
                        ForEach(model.searchTags, id: \.self) { tag in
                            TagChip(name: tag) { model.removeSearchTag(tag) }
                        }
                        if !model.searchKeys.isEmpty {
                            TagChip(name: "⌨ " + model.searchKeys.joined()) { model.clearSearchKeys() }
                        }
                        if model.isRecordingSearchKeys {
                            Text(model.recordingPreview ?? "請按下要搜尋的按鍵…（Esc 結束）")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            TextField("搜尋名稱、標籤、按鍵", text: $model.searchText)
                                .textFieldStyle(.plain)
                                .frame(width: 170)
                                .focused($focused)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if model.isSearching {
                        Button {
                            model.clearSearch()
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("清除搜尋")
                    }
                }
                .padding(.vertical, 2)
                .fieldBox(active: focused || model.isRecordingSearchKeys)

                Button {
                    model.toggleSearchKeyRecording()
                } label: {
                    Image(systemName: "keyboard")
                        .foregroundStyle(model.isRecordingSearchKeys ? Color.orange : Color.secondary)
                }
                .buttonStyle(.borderless)
                .help("按鍵搜尋：直接按下要找的快捷鍵")
            }

            if focused, !model.isRecordingSearchKeys {
                suggestionList
            }
        }
        .background { ViewAnchor { model.searchBarView = $0 } }
        .onChange(of: focused) { model.searchFocused = $0 }
        .onChange(of: model.searchFocusToken) { _ in
            DispatchQueue.main.async { focused = true }
        }
    }

    @ViewBuilder
    private var suggestionList: some View {
        let items = model.searchSuggestions
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element) { index, tag in
                    Button {
                        model.addSearchTag(tag)
                    } label: {
                        HStack {
                            Text(tag).font(.caption)
                            Spacer()
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                        .background(model.searchSuggestionIndex == index ? Color.accentColor.opacity(0.35) : Color.clear)
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color(nsColor: .separatorColor)))
            .frame(maxWidth: 240)
        }
    }
}
