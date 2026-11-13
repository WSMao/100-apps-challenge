import AppKit
import SwiftUI

enum SearchBarFocusState: String, Equatable {
    case inactive = "inactive"
    case focusedNonEditing = "focusedNonEditing"
    case focusedEditing = "focusedEditing"
}

struct SheetSearchBar: View {
    @Binding var text: String
    @Binding var state: SearchBarFocusState
    var placeholder: String = "搜尋目前 App 的所有工作表…"
    var onDownArrow: (() -> Void)? = nil
    var onEscNonEditing: (() -> Void)? = nil

    @State private var searchKeyMonitor: Any?
    @State private var searchMouseMonitor: Any?
    @State private var containerView: NSView?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(state == .inactive ? Color.secondary : Color.accentColor)

            SearchInputTextField(
                text: $text,
                state: $state,
                placeholder: placeholder,
                onSubmit: {
                    state = .focusedNonEditing
                },
                onCancel: {
                    text = ""
                    state = .focusedNonEditing
                }
            )
            .frame(height: 22)

            if !text.isEmpty {
                Button {
                    text = ""
                    if state == .inactive {
                        state = .focusedEditing
                    }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("清除搜尋")
                .accessibilityIdentifier("sheet.search-clear")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Color(nsColor: state == .focusedEditing ? .textBackgroundColor : .controlBackgroundColor),
            in: RoundedRectangle(cornerRadius: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(
                    state == .inactive ? Color(nsColor: .separatorColor) : Color.accentColor,
                    lineWidth: state == .inactive ? 1 : 2
                )
                .shadow(
                    color: state == .inactive ? .clear : Color.accentColor.opacity(0.35),
                    radius: state == .inactive ? 0 : 3,
                    x: 0,
                    y: 0
                )
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if state != .focusedEditing {
                state = .focusedEditing
            }
        }
        .background(ViewAnchor { view in
            if containerView !== view {
                DispatchQueue.main.async {
                    containerView = view
                }
            }
        })
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sheet.search-bar")
        .accessibilityValue(state.rawValue)
        .onAppear {
            setupMonitors()
        }
        .onDisappear {
            teardownMonitors()
        }
    }

    private func setupMonitors() {
        if searchKeyMonitor == nil {
            searchKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                let flags = event.modifierFlags.intersection([.command, .option, .control, .shift])

                // Cmd-F anywhere: open/focus search bar into editing state
                if flags == .command && event.charactersIgnoringModifiers?.lowercased() == "f" {
                    state = .focusedEditing
                    return nil
                }

                if state == .focusedNonEditing {
                    guard flags.isEmpty else { return event }
                    if event.keyCode == 36 || event.keyCode == 76 { // Enter
                        state = .focusedEditing
                        return nil
                    } else if event.keyCode == 125 { // Down Arrow
                        state = .inactive
                        onDownArrow?()
                        return nil
                    } else if event.keyCode == 53 { // Esc
                        state = .inactive
                        onEscNonEditing?()
                        return nil
                    }
                }

                return event
            }
        }

        if searchMouseMonitor == nil {
            searchMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { event in
                if let view = containerView, let window = view.window {
                    let frameInWindow = view.convert(view.bounds, to: nil)
                    let clickPoint = event.locationInWindow
                    if !frameInWindow.contains(clickPoint) {
                        if state != .inactive {
                            state = .inactive
                            window.makeFirstResponder(nil)
                        }
                    }
                }
                return event
            }
        }
    }

    private func teardownMonitors() {
        if let searchKeyMonitor {
            NSEvent.removeMonitor(searchKeyMonitor)
            self.searchKeyMonitor = nil
        }
        if let searchMouseMonitor {
            NSEvent.removeMonitor(searchMouseMonitor)
            self.searchMouseMonitor = nil
        }
    }
}

private final class CustomSearchNSTextField: NSTextField {
    var isEditingActive: Bool = false

    override var acceptsFirstResponder: Bool {
        true
    }

    override var canBecomeKeyView: Bool {
        isEditingActive
    }
}

private struct SearchInputTextField: NSViewRepresentable {
    @Binding var text: String
    @Binding var state: SearchBarFocusState
    let placeholder: String
    let onSubmit: () -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> CustomSearchNSTextField {
        let textField = CustomSearchNSTextField()
        textField.isBordered = false
        textField.drawsBackground = false
        textField.focusRingType = .none
        textField.placeholderString = placeholder
        textField.font = NSFont.systemFont(ofSize: NSFont.systemFontSize)
        textField.delegate = context.coordinator
        context.coordinator.textField = textField
        textField.setAccessibilityIdentifier("sheet.search-input")
        return textField
    }

    func updateNSView(_ nsView: CustomSearchNSTextField, context: Context) {
        context.coordinator.parent = self
        if nsView.stringValue != text {
            nsView.stringValue = text
        }
        nsView.placeholderString = placeholder

        let shouldEdit = (state == .focusedEditing)
        nsView.isEditingActive = shouldEdit

        if shouldEdit {
            DispatchQueue.main.async {
                if let window = nsView.window, window.firstResponder != nsView.currentEditor() {
                    window.makeFirstResponder(nsView)
                }
            }
        } else {
            DispatchQueue.main.async {
                if let window = nsView.window, window.firstResponder == nsView.currentEditor() {
                    window.makeFirstResponder(nil)
                }
            }
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: SearchInputTextField
        weak var textField: CustomSearchNSTextField?

        init(_ parent: SearchInputTextField) {
            self.parent = parent
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            if let editor = field.currentEditor() {
                parent.text = editor.string
            } else {
                parent.text = field.stringValue
            }
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                parent.onSubmit()
                return true
            } else if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
                parent.onCancel()
                return true
            }
            return false
        }
    }
}
