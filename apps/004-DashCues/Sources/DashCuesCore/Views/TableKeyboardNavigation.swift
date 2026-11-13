import AppKit
import Foundation
import SwiftUI

/// Layout helper calculating visible tabs and overflow menu tabs.
struct TabOverflowLayout {
    let visibleSheets: [AppSheet]
    let overflowSheets: [AppSheet]

    init(
        sheets: [AppSheet],
        availableWidth: CGFloat? = nil,
        maxVisible: Int = 4,
        selectedID: String?,
        isCompact: Bool = false
    ) {
        guard !sheets.isEmpty, maxVisible > 0 else {
            self.visibleSheets = sheets
            self.overflowSheets = []
            return
        }

        if let availableWidth, availableWidth > 0 {
            let spacing: CGFloat = 6
            let overflowButtonWidth: CGFloat = isCompact ? 36 : 46
            let allTabsWidth = sheets.reduce(CGFloat(0)) { $0 + Self.estimatedTabWidth(for: $1, isCompact: isCompact) }
                + CGFloat(max(0, sheets.count - 1)) * spacing

            if sheets.count <= maxVisible && allTabsWidth <= availableWidth {
                self.visibleSheets = sheets
                self.overflowSheets = []
                return
            }

            let budget = max(0, availableWidth - overflowButtonWidth - spacing)
            let selectedIndex = sheets.firstIndex(where: { $0.id == selectedID }) ?? 0
            let maxSlots = min(maxVisible, max(1, sheets.count - 1))

            var prefixCount = 0
            var usedWidth: CGFloat = 0
            for index in 0..<maxSlots {
                let width = Self.estimatedTabWidth(for: sheets[index], isCompact: isCompact)
                let nextWidth = prefixCount == 0 ? width : usedWidth + spacing + width
                if nextWidth <= budget {
                    usedWidth = nextWidth
                    prefixCount += 1
                } else {
                    break
                }
            }
            prefixCount = max(1, prefixCount)

            if selectedIndex < prefixCount {
                let visible = Array(sheets.prefix(prefixCount))
                self.visibleSheets = visible
                self.overflowSheets = sheets.filter { sheet in
                    !visible.contains { $0.id == sheet.id }
                }
            } else {
                let selectedSheet = sheets[selectedIndex]
                let selectedWidth = Self.estimatedTabWidth(for: selectedSheet, isCompact: isCompact)
                var visible: [AppSheet] = []
                var leadingWidth: CGFloat = 0
                let maxLeading = max(0, min(selectedIndex, maxSlots - 1))
                for index in 0..<maxLeading {
                    let width = Self.estimatedTabWidth(for: sheets[index], isCompact: isCompact)
                    let candidateLeading = visible.isEmpty ? width : leadingWidth + spacing + width
                    if candidateLeading + spacing + selectedWidth <= budget {
                        leadingWidth = candidateLeading
                        visible.append(sheets[index])
                    } else {
                        break
                    }
                }
                visible.append(selectedSheet)
                self.visibleSheets = visible
                self.overflowSheets = sheets.filter { sheet in
                    !visible.contains { $0.id == sheet.id }
                }
            }
            return
        }

        guard sheets.count > maxVisible else {
            self.visibleSheets = sheets
            self.overflowSheets = []
            return
        }

        let selectedIndex = sheets.firstIndex(where: { $0.id == selectedID }) ?? 0
        if selectedIndex < maxVisible {
            self.visibleSheets = Array(sheets.prefix(maxVisible))
            self.overflowSheets = Array(sheets.dropFirst(maxVisible))
        } else {
            // Selected sheet is outside initial prefix: make it visible in place of the last visible slot
            let prefixCount = maxVisible - 1
            var visible = Array(sheets.prefix(prefixCount))
            visible.append(sheets[selectedIndex])
            self.visibleSheets = visible
            self.overflowSheets = sheets.filter { sheet in
                !visible.contains { $0.id == sheet.id }
            }
        }
    }

    static func estimatedTabWidth(for sheet: AppSheet, isCompact: Bool = false) -> CGFloat {
        let fontSize = isCompact ? NSFont.smallSystemFontSize : NSFont.systemFontSize
        let font = NSFont.systemFont(ofSize: fontSize, weight: .regular)
        let textWidth = ceil((sheet.name as NSString).size(withAttributes: [.font: font]).width)
        let extra: CGFloat = isCompact ? 40 : 56
        return textWidth + extra
    }
}

/// Navigation mode focus and key events controller for sheet tabs and Key-Value table.
@MainActor
final class TableKeyboardNavigation: ObservableObject {
    enum FocusArea: Equatable {
        case sidebar
        case tabs
        case table
    }

    @Published var focusArea: FocusArea = .sidebar
    @Published var selectedSheetID: String?
    @Published var selectedRowIndex: Int = 0
    @Published var selectedColumn: KeyValueColumn = .key
    @Published var isTextEditing: Bool = false
    @Published var expandedRowIDs = Set<String>()
    @Published var selectedEntryIDs = Set<String>()
    @Published var anchorRowIndex: Int?
    var onDeleteRequested: (() -> Void)?
    var onMoveFocusToShortcuts: (() -> Bool)?
    var measuredTruncatableRowIDs: Set<String>?
    var isPinnedWindow = false

    private weak var store: ShortcutStore?
    let applicationID: String
    private weak var editSession: KeyValueEditSession?
    let clipboardWriter: (String) -> Bool
    var onCopyResult: ((Bool, String) -> Void)?

    init(
        store: ShortcutStore,
        applicationID: String,
        editSession: KeyValueEditSession?,
        clipboardWriter: @escaping (String) -> Bool
    ) {
        self.store = store
        self.applicationID = applicationID
        self.editSession = editSession
        self.clipboardWriter = clipboardWriter
        self.selectedSheetID = store.application(id: applicationID)?.sheets.first?.id
    }

    var application: ShortcutApplication? {
        store?.application(id: applicationID)
    }

    var sheets: [AppSheet] {
        application?.sheets ?? []
    }

    var currentSheet: AppSheet? {
        sheets.first { $0.id == selectedSheetID } ?? sheets.first
    }

    var currentKeyValueCheatsheet: KeyValueCheatsheet? {
        if case .keyValue(let sheet) = currentSheet { return sheet }
        return nil
    }

    var currentShortcutSheet: ShortcutSheet? {
        if case .shortcuts(let sheet) = currentSheet { return sheet }
        return nil
    }

    var entries: [KeyValueEntry] {
        currentKeyValueCheatsheet?.entries ?? []
    }

    var columnOrder: [KeyValueColumn] {
        currentKeyValueCheatsheet?.columnOrder ?? [.key, .value]
    }

    var selectedTabIndex: Int {
        sheets.firstIndex(where: { $0.id == selectedSheetID }) ?? 0
    }

    func selectSheet(id: String) {
        guard sheets.contains(where: { $0.id == id }) else { return }
        selectedSheetID = id
        selectedRowIndex = 0
        selectedColumn = columnOrder.first ?? .key
        selectedEntryIDs = []
        anchorRowIndex = nil
        if focusArea == .table && entries.isEmpty {
            focusArea = .tabs
        }
    }

    func selectSheet(at index: Int) {
        guard index >= 0 && index < sheets.count else { return }
        selectSheet(id: sheets[index].id)
    }

    // 1–9 digit handling
    func handleNumberKey(_ digit: Int) -> Bool {
        guard !isTextEditing, digit >= 1 && digit <= 9 else { return false }
        let index = digit - 1
        guard index < sheets.count else { return false }
        selectSheet(at: index)
        return true
    }

    func isRowTruncatable(_ entry: KeyValueEntry) -> Bool {
        if entry.key.contains(where: \.isNewline) || entry.value.contains(where: \.isNewline) {
            return true
        }
        if let measured = measuredTruncatableRowIDs {
            return measured.contains(entry.id)
        }
        return entry.key.count > 24 || entry.value.count > 24
    }

    // Right Arrow
    func handleRightArrow() -> Bool {
        guard !isTextEditing else { return false }
        switch focusArea {
        case .sidebar:
            focusArea = .tabs
            return true
        case .tabs:
            if selectedTabIndex + 1 < sheets.count {
                selectSheet(at: selectedTabIndex + 1)
            }
            return true
        case .table:
            if currentSheet?.kind == .shortcuts {
                return false
            }
            guard selectedRowIndex < entries.count else { return false }
            let entry = entries[selectedRowIndex]
            guard isRowTruncatable(entry) else { return false }
            expandedRowIDs.insert(entry.id)
            return true
        }
    }

    // Left Arrow
    func handleLeftArrow() -> Bool {
        guard !isTextEditing else { return false }
        switch focusArea {
        case .sidebar:
            return false
        case .tabs:
            if selectedTabIndex > 0 {
                selectSheet(at: selectedTabIndex - 1)
            }
            return true
        case .table:
            if currentSheet?.kind == .shortcuts {
                focusArea = isPinnedWindow ? .tabs : .sidebar
                return true
            }
            guard selectedRowIndex < entries.count else { return false }
            let entry = entries[selectedRowIndex]
            if isRowTruncatable(entry) && expandedRowIDs.contains(entry.id) {
                expandedRowIDs.remove(entry.id)
                return true
            } else {
                expandedRowIDs.remove(entry.id)
                focusArea = isPinnedWindow ? .tabs : .sidebar
                return true
            }
        }
    }

    // Down Arrow
    func handleDownArrow(extend: Bool = false) -> Bool {
        guard !isTextEditing else { return false }
        switch focusArea {
        case .sidebar:
            return false
        case .tabs:
            if currentSheet?.kind == .shortcuts {
                if let onMoveFocusToShortcuts {
                    if onMoveFocusToShortcuts() {
                        focusArea = .table
                        return true
                    }
                    return false
                }
                guard let sheet = currentShortcutSheet, !sheet.shortcuts.isEmpty else {
                    return false
                }
                focusArea = .table
                return true
            }
            if entries.isEmpty {
                return false
            }
            focusArea = .table
            selectedRowIndex = 0
            anchorRowIndex = 0
            selectedColumn = columnOrder.first ?? .key
            selectedEntryIDs = entries.first.map { [$0.id] } ?? []
            return true
        case .table:
            guard selectedRowIndex + 1 < entries.count else { return true }
            selectedRowIndex += 1
            if extend {
                let anchor = anchorRowIndex ?? (selectedRowIndex - 1)
                anchorRowIndex = anchor
                let low = min(anchor, selectedRowIndex)
                let high = max(anchor, selectedRowIndex)
                selectedEntryIDs = Set(entries[low...high].map(\.id))
            } else {
                anchorRowIndex = selectedRowIndex
                selectedEntryIDs = [entries[selectedRowIndex].id]
            }
            return true
        }
    }

    // Up Arrow
    func handleUpArrow(extend: Bool = false) -> Bool {
        guard !isTextEditing else { return false }
        switch focusArea {
        case .sidebar:
            return false
        case .tabs:
            return false
        case .table:
            if currentSheet?.kind == .shortcuts {
                focusArea = .tabs
                return true
            }
            if selectedRowIndex > 0 {
                selectedRowIndex -= 1
                if extend {
                    let anchor = anchorRowIndex ?? (selectedRowIndex + 1)
                    anchorRowIndex = anchor
                    let low = min(anchor, selectedRowIndex)
                    let high = max(anchor, selectedRowIndex)
                    selectedEntryIDs = Set(entries[low...high].map(\.id))
                } else {
                    anchorRowIndex = selectedRowIndex
                    selectedEntryIDs = [entries[selectedRowIndex].id]
                }
                return true
            } else {
                if !extend {
                    focusArea = .tabs
                    selectedEntryIDs = []
                    anchorRowIndex = nil
                }
                return true
            }
        }
    }

    // Tab / Shift-Tab / Ctrl-Tab
    func handleTab(shift: Bool, control: Bool) -> Bool {
        guard !isTextEditing, focusArea == .table else { return false }
        if control {
            focusArea = .tabs
            return true
        }
        let order = columnOrder
        guard order.count >= 2 else { return false }
        if selectedColumn == order[0] {
            selectedColumn = order[1]
        } else {
            selectedColumn = order[0]
        }
        return true
    }

    // Cmd-C
    func handleCopy() -> Bool {
        guard !isTextEditing, editSession?.isEditing != true, focusArea == .table, selectedRowIndex < entries.count else { return false }
        let entry = entries[selectedRowIndex]
        let text = selectedColumn == .key ? entry.key : entry.value
        let fieldName = selectedColumn == .key ? "Key" : "Value"
        let success = clipboardWriter(text)
        onCopyResult?(success, fieldName)
        return success
    }

    // Enter
    func handleEnter() -> Bool {
        guard !isFieldEditorFocused, focusArea == .table, selectedRowIndex < entries.count else { return false }
        if editSession == nil {
            let entryID = entries[selectedRowIndex].id
            if expandedRowIDs.contains(entryID) {
                expandedRowIDs.remove(entryID)
            } else {
                expandedRowIDs.insert(entryID)
            }
            return true
        }
        guard let sheet = currentKeyValueCheatsheet, let editSession else { return false }
        let entry = entries[selectedRowIndex]
        let editCol: KeyValueEditSession.Column = selectedColumn == .key ? .key : .value
        editSession.begin(entry: entry, column: editCol, cheatsheetID: sheet.id, applicationID: applicationID)
        return true
    }

    var isFieldEditorFocused: Bool {
        if isTextEditing { return true }
        if editSession?.isEditing == true { return true }
        if let responder = NSApplication.shared.keyWindow?.firstResponder, responder is NSTextView {
            return true
        }
        return false
    }

    // Unified key handler for NSEvent
    func consumes(keyDown event: NSEvent) -> Bool {
        guard !isFieldEditorFocused else { return false }
        if let window = event.window {
            if window.attachedSheet != nil || window.sheetParent != nil {
                return false
            }
            if window.firstResponder is NSTextView {
                return false
            }
        }

        let flags = event.modifierFlags.intersection([.command, .option, .control, .shift])

        // Cmd-C
        if flags == .command && event.charactersIgnoringModifiers?.lowercased() == "c" {
            return handleCopy()
        }

        // Cmd-A (Select All rows in table)
        if flags == .command && event.charactersIgnoringModifiers?.lowercased() == "a" {
            if focusArea == .table && !entries.isEmpty && editSession?.isEditing != true {
                selectedEntryIDs = Set(entries.map(\.id))
                return true
            }
        }

        // Ctrl-Tab / Ctrl-Shift-Tab
        if (flags == .control || flags == [.control, .shift]) && event.keyCode == 48 {
            return handleTab(shift: flags.contains(.shift), control: true)
        }

        // Tab / Shift-Tab
        if (flags == [] || flags == .shift) && event.keyCode == 48 {
            return handleTab(shift: flags.contains(.shift), control: false)
        }

        // Down / Up Arrow (support Shift for multi-select range)
        if (flags == [] || flags == .shift) && (event.keyCode == 125 || event.keyCode == 126) {
            let extend = flags.contains(.shift)
            return event.keyCode == 125 ? handleDownArrow(extend: extend) : handleUpArrow(extend: extend)
        }

        // Delete / Backspace (keyCode 51, 117)
        if flags == [] && (event.keyCode == 51 || event.keyCode == 117) {
            if focusArea == .table && !selectedEntryIDs.isEmpty && editSession?.isEditing != true {
                onDeleteRequested?()
                return true
            }
            return false
        }

        // Unmodified keys:
        guard flags == [] else { return false }

        // Digits 1-9
        if let chars = event.characters, chars.count == 1,
           let digit = Int(chars), digit >= 1 && digit <= 9 {
            return handleNumberKey(digit)
        }

        switch event.keyCode {
        case 123: // Left Arrow
            return handleLeftArrow()
        case 124: // Right Arrow
            return handleRightArrow()
        case 36:  // Enter
            return handleEnter()
        default:
            return false
        }
    }
}
