import AppKit
import SwiftUI

/// Two-column Key-Value table with single-click expansion, per-cell copy, column reordering, resizing, and inline editing.
struct KeyValueTableView: View {
    let cheatsheetID: String
    let applicationID: String
    let entries: [KeyValueEntry]
    var layout: KeyValueTableLayout = KeyValueTableLayout()
    @ObservedObject var session: KeyValueEditSession
    @Binding var expandedEntryIDs: Set<String>
    let onCopy: (String, String) -> Bool
    let onDelete: (KeyValueEntry) -> Void
    let onMove: (String, String) -> Void
    var onUpdateLayout: ([KeyValueColumn]?, Double?, Double?) -> Void = { _, _, _ in }
    var navigation: TableKeyboardNavigation? = nil

    @State private var copiedCell: CopiedCell?
    @State private var dragKeyWidth: Double?
    @State private var dragValueWidth: Double?
    @State private var initialDragWidths: (key: Double, value: Double)?

    private struct CopiedCell: Equatable {
        let entryID: String
        let column: KeyValueEditSession.Column
    }

    private var showsNewRow: Bool {
        session.isNewEntry && session.editingEntryID != nil
    }

    private var columnOrder: [KeyValueColumn] {
        layout.columnOrder
    }

    var body: some View {
        GeometryReader { geometry in
            let availableWidth = max(geometry.size.width - 44, KeyValueTableLayout.minColumnWidth * 2)
            let activeLayout = KeyValueTableLayout(
                columnOrder: layout.columnOrder,
                keyWidth: dragKeyWidth ?? layout.keyWidth,
                valueWidth: dragValueWidth ?? layout.valueWidth
            )
            let widths = activeLayout.resolvedWidths(containerWidth: availableWidth)
            let totalTableWidth = widths.key + widths.value + 44

            ScrollView([.horizontal, .vertical]) {
                VStack(alignment: .leading, spacing: 0) {
                    header(widths: widths)
                    Divider()
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                            row(entry, widths: widths, index: index)
                            Divider()
                        }
                        if showsNewRow, let id = session.editingEntryID {
                            editingRow(id: id, widths: widths)
                            Divider()
                        }
                    }
                }
                .frame(width: max(totalTableWidth, geometry.size.width), alignment: .leading)
            }
            .accessibilityIdentifier("key-value.entries")
            .onChange(of: navigation?.expandedRowIDs) { expanded in
                if let expanded { expandedEntryIDs = expanded }
            }
        }
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
        .accessibilityIdentifier("key-value.table")
    }

    private func header(widths: (key: Double, value: Double)) -> some View {
        let firstCol = columnOrder[0]
        let secondCol = columnOrder[1]
        let firstWidth = firstCol == .key ? widths.key : widths.value
        let secondWidth = secondCol == .key ? widths.key : widths.value

        return HStack(spacing: 0) {
            headerCell(for: firstCol, width: firstWidth)
            separatorView(widths: widths)
            headerCell(for: secondCol, width: secondWidth)
            Divider()
            Color.clear.frame(width: 44)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .frame(height: 32)
    }

    private func headerCell(for column: KeyValueColumn, width: Double) -> some View {
        Text(column.title)
            .padding(10)
            .frame(width: width, alignment: .leading)
            .accessibilityIdentifier("key-value.header-\(column.rawValue)")
            .draggable(column.rawValue)
            .dropDestination(for: String.self) { draggedColumns, _ in
                guard let draggedRaw = draggedColumns.first,
                      let draggedCol = KeyValueColumn(rawValue: draggedRaw),
                      draggedCol != column else { return false }
                let newOrder = columnOrder.reversed()
                onUpdateLayout(Array(newOrder), layout.keyWidth, layout.valueWidth)
                return true
            }
    }

    private func separatorView(widths: (key: Double, value: Double)) -> some View {
        HStack(spacing: 0) {
            Divider()
        }
        .frame(width: 9)
        .contentShape(Rectangle())
        .gesture(
            DragGesture()
                .onChanged { value in
                    handleSeparatorDrag(translation: value.translation.width, widths: widths)
                }
                .onEnded { _ in
                    commitSeparatorDrag()
                }
        )
        .onHover { inside in
            if inside {
                NSCursor.resizeLeftRight.push()
            } else {
                NSCursor.pop()
            }
        }
        .accessibilityIdentifier("key-value.column-separator")
    }

    private func handleSeparatorDrag(translation: Double, widths: (key: Double, value: Double)) {
        let base = initialDragWidths ?? widths
        if initialDragWidths == nil {
            initialDragWidths = base
        }
        let minW = KeyValueTableLayout.minColumnWidth
        let firstCol = columnOrder[0]

        if firstCol == .key {
            let newKey = max(base.key + translation, minW)
            let newValue = max(base.value - translation, minW)
            dragKeyWidth = newKey
            dragValueWidth = newValue
        } else {
            let newValue = max(base.value + translation, minW)
            let newKey = max(base.key - translation, minW)
            dragValueWidth = newValue
            dragKeyWidth = newKey
        }
    }

    private func commitSeparatorDrag() {
        if let k = dragKeyWidth, let v = dragValueWidth {
            onUpdateLayout(columnOrder, k, v)
        }
        dragKeyWidth = nil
        dragValueWidth = nil
        initialDragWidths = nil
    }

    @ViewBuilder
    private func row(_ entry: KeyValueEntry, widths: (key: Double, value: Double), index: Int) -> some View {
        let isRowFocused = navigation?.focusArea == .table && navigation?.selectedRowIndex == index
        if session.editingEntryID == entry.id {
            editingRow(id: entry.id, widths: widths)
        } else {
            let isExpanded = expandedEntryIDs.contains(entry.id)
            let firstCol = columnOrder[0]
            let secondCol = columnOrder[1]
            let firstWidth = firstCol == .key ? widths.key : widths.value
            let secondWidth = secondCol == .key ? widths.key : widths.value

            HStack(alignment: .top, spacing: 0) {
                cell(entry, column: firstCol == .key ? .key : .value, isExpanded: isExpanded, width: firstWidth, index: index, isRowFocused: isRowFocused)
                Divider()
                cell(entry, column: secondCol == .key ? .key : .value, isExpanded: isExpanded, width: secondWidth, index: index, isRowFocused: isRowFocused)
                Divider()
                Button(role: .destructive) { onDelete(entry) } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .help("刪除項目")
                .accessibilityLabel("刪除項目")
                .accessibilityIdentifier("key-value.delete-entry.\(entry.id)")
                .frame(width: 44)
                .padding(.top, 10)
            }
            .background(isRowFocused ? Color.accentColor.opacity(0.08) : Color.clear)
            .accessibilityValue(isRowFocused ? "已選取" : "")
            .draggable(entry.id)
            .dropDestination(for: String.self) { draggedIDs, _ in
                guard let dragged = draggedIDs.first else { return false }
                onMove(dragged, entry.id)
                return true
            }
            .id(entry.id)
        }
    }

    private func cell(
        _ entry: KeyValueEntry,
        column: KeyValueEditSession.Column,
        isExpanded: Bool,
        width: Double,
        index: Int,
        isRowFocused: Bool
    ) -> some View {
        let text = column == .key ? entry.key : entry.value
        let name = column == .key ? "Key" : "Value"
        let idName = column == .key ? "key" : "value"
        let isCopied = copiedCell == CopiedCell(entryID: entry.id, column: column)
        let isFieldFocused = isRowFocused && navigation?.selectedColumn == (column == .key ? .key : .value)
        return HStack(alignment: .top, spacing: 6) {
            Group {
                if text.isEmpty {
                    Text("（空白）").foregroundStyle(.secondary)
                } else {
                    Text(text)
                }
            }
            .lineLimit(isExpanded ? nil : 1)
            .truncationMode(.tail)
            .fixedSize(horizontal: false, vertical: isExpanded)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement()
            .accessibilityLabel(text)
            .accessibilityIdentifier("key-value.\(idName)-cell.\(entry.id)")

            Button {
                if onCopy(text, name) { flashCopied(entry.id, column) }
            } label: {
                LucideIcon(isCopied ? .check : .copy)
                    .frame(width: 14, height: 14)
                    .foregroundStyle(isCopied ? Color.green : Color.secondary)
            }
            .buttonStyle(.borderless)
            .disabled(text.isEmpty)
            .help("複製 \(name)")
            .accessibilityLabel(isCopied ? "已複製 \(name)" : "複製 \(name)")
            .accessibilityIdentifier("key-value.copy-\(idName).\(entry.id)")
        }
        .padding(10)
        .frame(width: width, alignment: .topLeading)
        .overlay {
            if isFieldFocused {
                RoundedRectangle(cornerRadius: 4)
                    .stroke(Color.accentColor, lineWidth: 2)
                    .padding(2)
                    .accessibilityIdentifier("key-value.cell-focused")
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            session.begin(entry: entry, column: column, cheatsheetID: cheatsheetID, applicationID: applicationID)
        }
        .onTapGesture {
            navigation?.focusArea = .table
            navigation?.selectedRowIndex = index
            navigation?.selectedColumn = (column == .key ? .key : .value)
            if isExpanded { expandedEntryIDs.remove(entry.id) } else { expandedEntryIDs.insert(entry.id) }
        }
    }

    private func editingRow(id: String, widths: (key: Double, value: Double)) -> some View {
        let firstCol = columnOrder[0]
        let secondCol = columnOrder[1]
        let firstWidth = firstCol == .key ? widths.key : widths.value
        let secondWidth = secondCol == .key ? widths.key : widths.value

        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 0) {
                inlineEditor(for: firstCol, width: firstWidth)
                Divider()
                inlineEditor(for: secondCol, width: secondWidth)
                Divider()
                Color.clear.frame(width: 44)
            }
            if let message = session.validationMessage {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 10)
                    .accessibilityIdentifier("key-value.validation-message")
            }
            if session.hasDuplicateKeyWarning {
                Text("此清單已有相同 Key；仍可儲存。")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 10)
                    .accessibilityIdentifier("key-value.duplicate-key-warning")
            }
            Text("Enter 儲存 · Shift-Enter 換行 · Esc 取消")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.bottom, 6)
        }
        .background(Color.accentColor.opacity(0.06))
        .id(id)
    }

    @ViewBuilder
    private func inlineEditor(for column: KeyValueColumn, width: Double) -> some View {
        switch column {
        case .key:
            InlineTextEditor(
                text: $session.draftKey,
                identifier: "key-value.entry-key",
                wantsFocus: session.focusColumn == .key,
                onSubmit: { session.save() },
                onCancel: { session.cancel() }
            )
            .padding(10)
            .frame(width: width, alignment: .leading)
        case .value:
            InlineTextEditor(
                text: $session.draftValue,
                identifier: "key-value.entry-value",
                wantsFocus: session.focusColumn == .value,
                onSubmit: { session.save() },
                onCancel: { session.cancel() }
            )
            .padding(10)
            .frame(width: width, alignment: .leading)
        }
    }

    private func flashCopied(_ entryID: String, _ column: KeyValueEditSession.Column) {
        let cell = CopiedCell(entryID: entryID, column: column)
        copiedCell = cell
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if copiedCell == cell { copiedCell = nil }
        }
    }
}

/// Lucide "copy" and "check" icons drawn on their native 24-unit grid.
enum LucideGlyph {
    case copy
    case check
}

struct LucideIcon: View {
    let glyph: LucideGlyph

    init(_ glyph: LucideGlyph) {
        self.glyph = glyph
    }

    var body: some View {
        GeometryReader { geometry in
            let scale = min(geometry.size.width, geometry.size.height) / 24.0
            Path { path in
                switch glyph {
                case .copy:
                    path.addRoundedRect(
                        in: CGRect(x: 9, y: 9, width: 13, height: 13),
                        cornerSize: CGSize(width: 2, height: 2)
                    )
                    path.move(to: CGPoint(x: 5, y: 15))
                    path.addLine(to: CGPoint(x: 3, y: 15))
                    path.addArc(
                        center: CGPoint(x: 4, y: 14),
                        radius: 2,
                        startAngle: .degrees(90),
                        endAngle: .degrees(180),
                        clockwise: false
                    )
                    path.addLine(to: CGPoint(x: 2, y: 4))
                    path.addArc(
                        center: CGPoint(x: 4, y: 4),
                        radius: 2,
                        startAngle: .degrees(180),
                        endAngle: .degrees(270),
                        clockwise: false
                    )
                    path.addLine(to: CGPoint(x: 14, y: 2))
                    path.addArc(
                        center: CGPoint(x: 14, y: 4),
                        radius: 2,
                        startAngle: .degrees(270),
                        endAngle: .degrees(0),
                        clockwise: false
                    )
                    path.addLine(to: CGPoint(x: 15, y: 5))
                case .check:
                    path.move(to: CGPoint(x: 4, y: 12))
                    path.addLine(to: CGPoint(x: 9, y: 17))
                    path.addLine(to: CGPoint(x: 20, y: 6))
                }
            }
            .applying(CGAffineTransform(scaleX: scale, y: scale))
            .stroke(
                style: StrokeStyle(
                    lineWidth: 2 * scale,
                    lineCap: .round,
                    lineJoin: .round
                )
            )
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

private struct InlineTextEditor: NSViewRepresentable {
    @Binding var text: String
    let identifier: String
    let wantsFocus: Bool
    let onSubmit: () -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSTextField {
        let field = NSTextField(string: text)
        field.delegate = context.coordinator
        field.isEditable = true
        field.isBezeled = true
        field.bezelStyle = .roundedBezel
        field.usesSingleLineMode = false
        field.cell?.wraps = true
        field.cell?.isScrollable = false
        field.lineBreakMode = .byWordWrapping
        field.setAccessibilityIdentifier(identifier)
        if wantsFocus {
            DispatchQueue.main.async { field.window?.makeFirstResponder(field) }
        }
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        context.coordinator.parent = self
        if field.stringValue != text, field.currentEditor() == nil {
            field.stringValue = text
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, nsView field: NSTextField, context: Context) -> CGSize? {
        let width = proposal.width ?? 200
        guard let cell = field.cell else { return nil }
        let size = cell.cellSize(forBounds: NSRect(x: 0, y: 0, width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: max(size.height, 24))
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: InlineTextEditor

        init(_ parent: InlineTextEditor) { self.parent = parent }

        func controlTextDidChange(_ notification: Notification) {
            guard let field = notification.object as? NSTextField else { return }
            parent.text = field.stringValue
            field.invalidateIntrinsicContentSize()
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
            switch selector {
            case #selector(NSResponder.insertNewline(_:)):
                if NSApp.currentEvent?.modifierFlags.contains(.shift) == true {
                    textView.insertNewlineIgnoringFieldEditor(nil)
                } else {
                    parent.text = textView.string
                    parent.onSubmit()
                }
                return true
            case #selector(NSResponder.cancelOperation(_:)):
                parent.onCancel()
                return true
            default:
                return false
            }
        }
    }
}
