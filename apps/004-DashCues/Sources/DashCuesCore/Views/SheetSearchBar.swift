import AppKit
import SwiftUI

enum SearchBarFocusState: String, Equatable {
    case inactive = "inactive"
    case focusedNonEditing = "focusedNonEditing"
    case focusedEditing = "focusedEditing"
}

@MainActor
final class SheetSearchSession: ObservableObject {
    @Published var isShowingHistory: Bool = false
    @Published var historyIndex: Int = 0

    var getState: () -> SearchBarFocusState = { .inactive }
    var setState: (SearchBarFocusState) -> Void = { _ in }
    var onDownArrow: (() -> Void)?
    var onUpArrow: (() -> Void)?
    var onEscNonEditing: (() -> Void)?
    var onSelectSheetIndex: ((Int) -> Void)?

    private var searchKeyMonitor: Any?
    private var searchMouseMonitor: Any?

    func setupMonitors(containerView: @escaping () -> NSView?) {
        if searchKeyMonitor == nil {
            searchKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                guard let self else { return event }
                let flags = event.modifierFlags.intersection([.command, .option, .control, .shift])

                // Cmd-F anywhere: open/focus search bar into editing state
                if flags == .command && event.charactersIgnoringModifiers?.lowercased() == "f" {
                    self.isShowingHistory = false
                    self.setState(.focusedEditing)
                    return nil
                }

                let currentState = self.getState()
                if currentState == .focusedNonEditing {
                    guard flags.isEmpty else { return event }
                    if event.keyCode == 36 || event.keyCode == 76 { // Enter
                        self.setState(.focusedEditing)
                        return nil
                    } else if event.keyCode == 125 { // Down Arrow
                        self.setState(.inactive)
                        self.onDownArrow?()
                        return nil
                    } else if event.keyCode == 126 { // Up Arrow
                        self.setState(.inactive)
                        self.onUpArrow?()
                        return nil
                    } else if event.keyCode == 53 { // Esc
                        self.setState(.inactive)
                        self.onEscNonEditing?()
                        return nil
                    } else if let chars = event.characters, chars.count == 1,
                              let digit = Int(chars), digit >= 1 && digit <= 9 {
                        self.setState(.inactive)
                        self.onSelectSheetIndex?(digit - 1)
                        return nil
                    }
                }

                return event
            }
        }

        if searchMouseMonitor == nil {
            searchMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
                guard let self else { return event }
                if let view = containerView(), let window = view.window {
                    let frameInWindow = view.convert(view.bounds, to: nil)
                    let clickPoint = event.locationInWindow
                    let extendedFrame = NSRect(
                        x: frameInWindow.origin.x,
                        y: frameInWindow.origin.y - (self.isShowingHistory ? 220 : 0),
                        width: max(frameInWindow.width, 320),
                        height: frameInWindow.height + (self.isShowingHistory ? 220 : 0)
                    )
                    if !extendedFrame.contains(clickPoint) {
                        self.isShowingHistory = false
                        if self.getState() != .inactive {
                            self.setState(.inactive)
                            window.makeFirstResponder(nil)
                        }
                    }
                }
                return event
            }
        }
    }

    func teardownMonitors() {
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

struct SheetSearchBar: View {
    @Binding var text: String
    @Binding var state: SearchBarFocusState
    var placeholder: String = "搜尋目前 App 的所有工作表…"
    var applicationID: String? = nil
    @ObservedObject var recentSearchStore: RecentSearchStore = .shared
    var onDownArrow: (() -> Void)? = nil
    var onUpArrow: (() -> Void)? = nil
    var onEscNonEditing: (() -> Void)? = nil
    var onSelectSheetIndex: ((Int) -> Void)? = nil

    @StateObject private var session = SheetSearchSession()
    @State private var containerView: NSView?

    var historyItems: [String] {
        recentSearchStore.recentSearches(for: applicationID ?? "")
    }

    var body: some View {
        let _ = syncSession()
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(state == .inactive ? Color.secondary : Color.accentColor)

            SearchInputTextField(
                text: $text,
                state: $state,
                placeholder: placeholder,
                session: session,
                getHistoryItems: { historyItems },
                onSelectHistory: { item in
                    selectHistoryItem(item)
                },
                onSubmit: {
                    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty {
                        recentSearchStore.record(query: trimmed, for: applicationID ?? "")
                    }
                    session.isShowingHistory = false
                    state = .focusedNonEditing
                },
                onCancel: {
                    text = ""
                    session.isShowingHistory = false
                    state = .focusedNonEditing
                }
            )
            .frame(height: 22)

            if !text.isEmpty {
                Button {
                    text = ""
                    session.isShowingHistory = false
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
            view.setAccessibilityIdentifier("sheet.search-bar")
            view.setAccessibilityValue(state.rawValue)
        })
        .overlay(alignment: .topLeading) {
            if session.isShowingHistory && !historyItems.isEmpty {
                historyDropdownView
                    .offset(y: 34)
                    .zIndex(100)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sheet.search-bar")
        .accessibilityValue(state.rawValue)
        .onAppear {
            syncSession()
            session.setupMonitors(containerView: { containerView })
        }
        .onDisappear {
            session.teardownMonitors()
        }
        .onChange(of: state) { newState in
            syncSession()
            if newState != .focusedEditing {
                session.isShowingHistory = false
            }
        }
    }

    private func syncSession() {
        let stateBinding = $state
        session.getState = { stateBinding.wrappedValue }
        session.setState = { stateBinding.wrappedValue = $0 }
        session.onDownArrow = onDownArrow
        session.onUpArrow = onUpArrow
        session.onEscNonEditing = onEscNonEditing
        session.onSelectSheetIndex = onSelectSheetIndex
    }

    private var itemRowHeight: CGFloat { 28 }
    private var itemSpacing: CGFloat { 2 }
    private var verticalPadding: CGFloat { 8 }

    private var historyDropdownHeight: CGFloat {
        let count = min(historyItems.count, 5)
        guard count > 0 else { return 0 }
        return CGFloat(count) * itemRowHeight + CGFloat(max(0, count - 1)) * itemSpacing + verticalPadding
    }

    private var historyDropdownView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: historyItems.count > 5) {
                    VStack(spacing: itemSpacing) {
                        ForEach(Array(historyItems.enumerated()), id: \.offset) { index, item in
                            Button {
                                selectHistoryItem(item)
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .font(.system(size: 11))
                                        .foregroundStyle(index == session.historyIndex ? Color.accentColor : Color.secondary)
                                    Text(item)
                                        .font(.system(size: 13))
                                        .lineLimit(1)
                                        .foregroundStyle(index == session.historyIndex ? Color.accentColor : Color.primary)
                                    Spacer()
                                }
                                .padding(.horizontal, 10)
                                .frame(height: itemRowHeight)
                                .background(
                                    index == session.historyIndex ? Color.accentColor.opacity(0.15) : Color.clear,
                                    in: RoundedRectangle(cornerRadius: 5)
                                )
                            }
                            .buttonStyle(.plain)
                            .id(index)
                            .accessibilityIdentifier("sheet.search-history-item.\(index)")
                            .background(
                                ViewAnchor {
                                    $0.setAccessibilityElement(false)
                                    $0.setAccessibilityIdentifier("sheet.search-history-item.\(index)")
                                }
                                .accessibilityHidden(true)
                            )
                            .accessibilityValue(index == session.historyIndex ? "已選取" : "")
                        }
                    }
                    .padding(4)
                }
                .frame(height: historyDropdownHeight)
                .onChange(of: session.historyIndex) { newIndex in
                    withAnimation {
                        proxy.scrollTo(newIndex, anchor: .center)
                    }
                }
            }
        }
        .frame(width: 320, height: historyDropdownHeight)
        .background(Color(nsColor: .windowBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 6, x: 0, y: 3)
        .accessibilityIdentifier("sheet.search-history-dropdown")
        .background(
            ViewAnchor {
                $0.setAccessibilityElement(false)
                $0.setAccessibilityIdentifier("sheet.search-history-dropdown")
            }
            .accessibilityHidden(true)
        )
    }

    private func selectHistoryItem(_ item: String) {
        text = item
        recentSearchStore.record(query: item, for: applicationID ?? "")
        session.isShowingHistory = false
        state = .focusedNonEditing
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
    @ObservedObject var session: SheetSearchSession
    var getHistoryItems: () -> [String]
    var onSelectHistory: (String) -> Void
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
            if parent.session.isShowingHistory {
                parent.session.isShowingHistory = false
            }
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            let session = parent.session
            let items = parent.getHistoryItems()

            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                if session.isShowingHistory, items.indices.contains(session.historyIndex) {
                    let chosen = items[session.historyIndex]
                    parent.onSelectHistory(chosen)
                    return true
                }
                parent.onSubmit()
                return true
            } else if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
                if session.isShowingHistory {
                    session.isShowingHistory = false
                    return true
                }
                parent.onCancel()
                return true
            } else if commandSelector == #selector(NSResponder.moveDown(_:)) {
                if !items.isEmpty {
                    if !session.isShowingHistory {
                        session.isShowingHistory = true
                        session.historyIndex = 0
                    } else {
                        session.historyIndex = min(session.historyIndex + 1, items.count - 1)
                    }
                    return true
                }
            } else if commandSelector == #selector(NSResponder.moveUp(_:)) {
                if session.isShowingHistory, !items.isEmpty {
                    if session.historyIndex > 0 {
                        session.historyIndex -= 1
                    } else {
                        session.isShowingHistory = false
                    }
                    return true
                }
            }
            return false
        }
    }
}
