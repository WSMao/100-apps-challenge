import AppKit
import SwiftUI

/// Two-column Key-Value table with single-click expansion, per-cell copy, and inline editing.
struct KeyValueTableView: View {
    let cheatsheetID: String
    let applicationID: String
    let entries: [KeyValueEntry]
    @ObservedObject var session: KeyValueEditSession
    @Binding var expandedEntryIDs: Set<String>
    let onCopy: (String, String) -> Bool
    let onDelete: (KeyValueEntry) -> Void
    let onMove: (String, String) -> Void

    @State private var copiedCell: CopiedCell?

    private struct CopiedCell: Equatable {
        let entryID: String
        let column: KeyValueEditSession.Column
    }

    private var showsNewRow: Bool {
        session.isNewEntry && session.editingEntryID != nil
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(entries) { entry in
                        row(entry)
                        Divider()
                    }
                    if showsNewRow, let id = session.editingEntryID {
                        editingRow(id: id)
                        Divider()
                    }
                }
            }
            .accessibilityIdentifier("key-value.entries")
        }
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(nsColor: .separatorColor)))
        .accessibilityIdentifier("key-value.table")
    }

    private var header: some View {
        HStack(spacing: 0) {
            Text("Key")
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("key-value.header-key")
            Divider()
            Text("Value")
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("key-value.header-value")
            Divider()
            Color.clear.frame(width: 44)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .frame(height: 32)
    }

    @ViewBuilder
    private func row(_ entry: KeyValueEntry) -> some View {
        if session.editingEntryID == entry.id {
            editingRow(id: entry.id)
        } else {
            let isExpanded = expandedEntryIDs.contains(entry.id)
            HStack(alignment: .top, spacing: 0) {
                cell(entry, column: .key, isExpanded: isExpanded)
                Divider()
                cell(entry, column: .value, isExpanded: isExpanded)
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
            .draggable(entry.id)
            .dropDestination(for: String.self) { draggedIDs, _ in
                guard let dragged = draggedIDs.first else { return false }
                onMove(dragged, entry.id)
                return true
            }
            .id(entry.id)
        }
    }

    private func cell(_ entry: KeyValueEntry, column: KeyValueEditSession.Column, isExpanded: Bool) -> some View {
        let text = column == .key ? entry.key : entry.value
        let name = column == .key ? "Key" : "Value"
        let idName = column == .key ? "key" : "value"
        let isCopied = copiedCell == CopiedCell(entryID: entry.id, column: column)
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
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            session.begin(entry: entry, column: column, cheatsheetID: cheatsheetID, applicationID: applicationID)
        }
        .onTapGesture {
            if isExpanded { expandedEntryIDs.remove(entry.id) } else { expandedEntryIDs.insert(entry.id) }
        }
    }

    private func editingRow(id: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 0) {
                InlineTextEditor(
                    text: $session.draftKey,
                    identifier: "key-value.entry-key",
                    wantsFocus: session.focusColumn == .key,
                    onSubmit: { session.save() },
                    onCancel: { session.cancel() }
                )
                .padding(10)
                Divider()
                InlineTextEditor(
                    text: $session.draftValue,
                    identifier: "key-value.entry-value",
                    wantsFocus: session.focusColumn == .value,
                    onSubmit: { session.save() },
                    onCancel: { session.cancel() }
                )
                .padding(10)
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

    private func flashCopied(_ entryID: String, _ column: KeyValueEditSession.Column) {
        let cell = CopiedCell(entryID: entryID, column: column)
        copiedCell = cell
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if copiedCell == cell { copiedCell = nil }
        }
    }
}

/// Lucide "copy" and "check" icons drawn on their native 24-unit grid.
struct LucideIcon: View {
    enum Kind { case copy, check }
    let kind: Kind

    init(_ kind: Kind) { self.kind = kind }

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24
            let transform = CGAffineTransform(scaleX: scale, y: scale)
            let style = StrokeStyle(lineWidth: 2 * scale, lineCap: .round, lineJoin: .round)
            for path in paths {
                context.stroke(path.applying(transform), with: .foreground, style: style)
            }
        }
        .accessibilityHidden(true)
    }

    private var paths: [Path] {
        switch kind {
        case .copy:
            var back = Path()
            back.move(to: CGPoint(x: 4, y: 16))
            back.addCurve(to: CGPoint(x: 2, y: 14), control1: CGPoint(x: 2.9, y: 16), control2: CGPoint(x: 2, y: 15.1))
            back.addLine(to: CGPoint(x: 2, y: 4))
            back.addCurve(to: CGPoint(x: 4, y: 2), control1: CGPoint(x: 2, y: 2.9), control2: CGPoint(x: 2.9, y: 2))
            back.addLine(to: CGPoint(x: 14, y: 2))
            back.addCurve(to: CGPoint(x: 16, y: 4), control1: CGPoint(x: 15.1, y: 2), control2: CGPoint(x: 16, y: 2.9))
            return [Path(roundedRect: CGRect(x: 8, y: 8, width: 14, height: 14), cornerRadius: 2), back]
        case .check:
            var tick = Path()
            tick.move(to: CGPoint(x: 20, y: 6))
            tick.addLine(to: CGPoint(x: 9, y: 17))
            tick.addLine(to: CGPoint(x: 4, y: 12))
            return [tick]
        }
    }
}

/// Multi-line text field where Enter saves, Shift-Enter inserts a newline and Esc cancels.
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
