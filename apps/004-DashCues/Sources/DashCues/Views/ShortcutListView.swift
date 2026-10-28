import AppKit
import SwiftUI

struct ShortcutListView: View {
    @ObservedObject var store: ShortcutStore
    let applicationID: String
    let onError: (String) -> Void

    @StateObject private var model: ShortcutListModel

    init(store: ShortcutStore, applicationID: String, onError: @escaping (String) -> Void) {
        self.store = store
        self.applicationID = applicationID
        self.onError = onError
        _model = StateObject(wrappedValue: ShortcutListModel(store: store, applicationID: applicationID))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("快捷鍵")
                    .font(.title2.weight(.semibold))
                Spacer()
                Button {
                    model.addNew()
                } label: {
                    Label("新增快捷鍵", systemImage: "plus")
                }
            }

            ShortcutSearchBar(model: model)

            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 2) {
                            ForEach(model.rows) { item in
                                ShortcutRowView(item: item, model: model)
                                    .id(item.id)
                            }
                        }
                        .padding(6)
                    }
                    .onChange(of: model.scrollTarget) { request in
                        if let request { proxy.scrollTo(request.id) }
                    }
                }
                .overlay {
                    if model.isSearching, model.rows.isEmpty {
                        Text("沒有符合的快捷鍵")
                            .foregroundStyle(.secondary)
                    }
                }

                if !model.selection.isEmpty {
                    Divider()
                    HStack {
                        Spacer()
                        Button {
                            model.requestDelete()
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(.red)
                        }
                        .buttonStyle(.borderless)
                        .help("刪除選取的快捷鍵")
                    }
                    .padding(8)
                }
            }
            .background(ViewAnchor { model.listView = $0 })
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
        }
        .onAppear {
            model.onError = onError
            model.startMonitoring()
        }
        .onDisappear {
            model.finishEditing()
            model.stopMonitoring()
        }
        .onChange(of: applicationID) { model.setApplication($0) }
        .alert(
            model.selection.count > 1 ? "刪除 \(model.selection.count) 個快捷鍵？" : "刪除這個快捷鍵？",
            isPresented: $model.requestsDeleteConfirmation
        ) {
            Button("確定", role: .destructive) { model.confirmDelete() }
            Button("取消", role: .cancel) {}
        } message: {
            Text("此操作無法復原。")
        }
    }
}

private struct ShortcutRowView: View {
    let item: ShortcutItem
    @ObservedObject var model: ShortcutListModel
    @FocusState private var focus: ShortcutField?

    private var isSelected: Bool { model.selection.contains(item.id) }
    private var isEditingRow: Bool { model.editingID == item.id }
    private var showsInputs: Bool { isSelected && model.selection.count == 1 }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                titleView
                categoryView
            }
            Spacer(minLength: 8)
            keysView
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(minHeight: 58)
        .background(
            isSelected ? Color.accentColor.opacity(0.2) : Color.clear,
            in: RoundedRectangle(cornerRadius: 8)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            model.click(item.id, field: nil, modifiers: NSEvent.modifierFlags)
        }
        .background {
            if isEditingRow {
                ViewAnchor { model.editingRowView = $0 }
            }
        }
        .onChange(of: model.editingField) { _ in syncFocus() }
        .onAppear { syncFocus() }
    }

    private func syncFocus() {
        let target: ShortcutField? = {
            guard isEditingRow, let field = model.editingField, field != .keys else { return nil }
            return field
        }()
        DispatchQueue.main.async { focus = target }
    }

    private func isEditing(_ field: ShortcutField) -> Bool {
        isEditingRow && model.editingField == field
    }

    private func tap(_ field: ShortcutField) {
        model.click(item.id, field: field, modifiers: NSEvent.modifierFlags)
    }

    @ViewBuilder
    private var titleView: some View {
        if !showsInputs {
            Text(item.title)
                .lineLimit(1)
        } else if isEditing(.title) {
            TextField("功能名稱", text: workingBinding(\.title))
                .textFieldStyle(.plain)
                .focused($focus, equals: .title)
                .fieldBox(active: true)
        } else {
            placeholderText(item.title, placeholder: "功能名稱")
                .fieldBox(active: false)
                .onTapGesture { tap(.title) }
        }
    }

    private var displayedTags: [String] {
        isEditing(.tags) ? (model.workingItem?.tags ?? item.tags) : item.tags
    }

    @ViewBuilder
    private var categoryView: some View {
        if !showsInputs {
            if !item.tags.isEmpty {
                FlowLayout(spacing: 4) {
                    ForEach(item.tags, id: \.self) { tag in
                        TagChip(name: tag, onRemove: nil)
                    }
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                FlowLayout(spacing: 6) {
                    ForEach(displayedTags, id: \.self) { tag in
                        TagChip(name: tag) { model.removeTag(tag, itemID: item.id) }
                    }
                    if isEditing(.tags) {
                        TextField(displayedTags.isEmpty ? "輸入標籤" : "", text: $model.tagDraft)
                            .textFieldStyle(.plain)
                            .font(.caption)
                            .frame(width: 110)
                            .focused($focus, equals: .tags)
                    } else if displayedTags.isEmpty {
                        Text("標籤").font(.caption).foregroundColor(.secondary.opacity(0.6))
                    }
                }
                .padding(.top, 5)
                .fieldBox(active: isEditing(.tags))
                .contentShape(Rectangle())
                .onTapGesture { tap(.tags) }
                .onChange(of: model.focusToken) { _ in
                    if isEditing(.tags) { DispatchQueue.main.async { focus = .tags } }
                }

                if isEditing(.tags) {
                    suggestionList
                }
            }
        }
    }

    @ViewBuilder
    private var suggestionList: some View {
        let items = model.suggestions
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, suggestion in
                    Button {
                        model.addTag(suggestion.name)
                    } label: {
                        HStack {
                            Text(suggestion.isNew ? "新增「\(suggestion.name)」" : suggestion.name)
                                .font(.caption)
                            Spacer()
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                        .background(model.suggestionIndex == index ? Color.accentColor.opacity(0.35) : Color.clear)
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color(nsColor: .separatorColor)))
            .frame(maxWidth: 240)
        }
    }

    @ViewBuilder
    private var keysView: some View {
        if !showsInputs {
            Text(item.keys.isEmpty ? "—" : item.keyCombination)
                .font(.system(.body, design: .rounded).weight(.medium))
        } else if isEditing(.keys) {
            Text(model.recordingPreview ?? (item.keys.isEmpty ? "請按下按鍵…" : item.keyCombination))
                .font(.system(.body, design: .rounded).weight(.medium))
                .foregroundStyle(model.recordingPreview == nil && item.keys.isEmpty ? .secondary : .primary)
                .frame(minWidth: 110)
                .fieldBox(active: true)
        } else {
            placeholderText(item.keys.isEmpty ? "" : item.keyCombination, placeholder: "按鍵組合")
                .font(.system(.body, design: .rounded).weight(.medium))
                .frame(minWidth: 110)
                .fieldBox(active: false)
                .onTapGesture { tap(.keys) }
        }
    }

    private func placeholderText(_ text: String, placeholder: String) -> Text {
        text.isEmpty ? Text(placeholder).foregroundColor(.secondary.opacity(0.6)) : Text(text)
    }

    private func workingBinding(_ keyPath: WritableKeyPath<ShortcutItem, String>) -> Binding<String> {
        Binding(
            get: { model.workingItem?[keyPath: keyPath] ?? "" },
            set: { model.workingItem?[keyPath: keyPath] = $0 }
        )
    }
}

extension View {
    /// Orange outline marks the field that currently has focus, distinct from the row's accent highlight.
    func fieldBox(active: Bool) -> some View {
        self
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(active ? Color.orange : Color(nsColor: .separatorColor), lineWidth: active ? 2 : 1)
            )
    }
}

struct TagChip: View {
    let name: String
    let onRemove: (() -> Void)?

    var body: some View {
        Text(name)
            .font(.caption)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .padding(.trailing, onRemove == nil ? 0 : 6)
            .background(Color.secondary.opacity(0.2), in: Capsule())
            .overlay(alignment: .topTrailing) {
                if let onRemove {
                    Button(action: onRemove) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .background(Circle().fill(Color(nsColor: .textBackgroundColor)))
                    }
                    .buttonStyle(.plain)
                    .offset(x: 4, y: -5)
                    .help("移除標籤")
                }
            }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(width: proposal.width ?? .infinity, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(width: bounds.width, subviews: subviews)
        for (index, origin) in result.origins.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y), proposal: .unspecified)
        }
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> (size: CGSize, origins: [CGPoint]) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxX = max(maxX, x - spacing)
        }
        return (CGSize(width: maxX, height: y + rowHeight), origins)
    }
}

struct ViewAnchor: NSViewRepresentable {
    let onResolve: (NSView) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = PassthroughView()
        onResolve(view)
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        onResolve(nsView)
    }

    private final class PassthroughView: NSView {
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }
}
