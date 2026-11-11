import AppKit
import Foundation
import SwiftUI

/// Layout helper calculating visible tabs and overflow menu tabs.
struct TabOverflowLayout {
    let visibleSheets: [AppSheet]
    let overflowSheets: [AppSheet]

    init(sheets: [AppSheet], maxVisible: Int, selectedID: String?) {
        guard sheets.count > maxVisible, maxVisible > 0 else {
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
    var isPinnedWindow = false

    private weak var store: ShortcutStore?
    let applicationID: String
    private weak var editSession: KeyValueEditSession?
    let clipboardWriter: (String) -> Bool

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
            guard selectedRowIndex < entries.count else { return false }
            let entryID = entries[selectedRowIndex].id
            expandedRowIDs.insert(entryID)
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
            guard selectedRowIndex < entries.count else { return false }
            let entryID = entries[selectedRowIndex].id
            if expandedRowIDs.contains(entryID) {
                expandedRowIDs.remove(entryID)
                return true
            } else {
                focusArea = isPinnedWindow ? .tabs : .sidebar
                return true
            }
        }
    }

    // Down Arrow
    func handleDownArrow() -> Bool {
        guard !isTextEditing else { return false }
        switch focusArea {
        case .sidebar:
            return false
        case .tabs:
            if entries.isEmpty {
                return false
            }
            focusArea = .table
            selectedRowIndex = 0
            selectedColumn = columnOrder.first ?? .key
            return true
        case .table:
            if selectedRowIndex + 1 < entries.count {
                selectedRowIndex += 1
            }
            return true
        }
    }

    // Up Arrow
    func handleUpArrow() -> Bool {
        guard !isTextEditing else { return false }
        switch focusArea {
        case .sidebar:
            return false
        case .tabs:
            return false
        case .table:
            if selectedRowIndex > 0 {
                selectedRowIndex -= 1
                return true
            } else {
                focusArea = .tabs
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
        guard !isTextEditing, focusArea == .table, selectedRowIndex < entries.count else { return false }
        let entry = entries[selectedRowIndex]
        let text = selectedColumn == .key ? entry.key : entry.value
        return clipboardWriter(text)
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
        if let responder = NSApplication.shared.keyWindow?.firstResponder, responder is NSTextView {
            return true
        }
        return false
    }

    // Unified key handler for NSEvent
    func consumes(keyDown event: NSEvent) -> Bool {
        guard !isFieldEditorFocused else { return false }

        let flags = event.modifierFlags.intersection([.command, .option, .control, .shift])

        // Cmd-C
        if flags == .command && event.charactersIgnoringModifiers?.lowercased() == "c" {
            return handleCopy()
        }

        // Ctrl-Tab / Ctrl-Shift-Tab
        if (flags == .control || flags == [.control, .shift]) && event.keyCode == 48 {
            return handleTab(shift: flags.contains(.shift), control: true)
        }

        // Tab / Shift-Tab
        if (flags == [] || flags == .shift) && event.keyCode == 48 {
            return handleTab(shift: flags.contains(.shift), control: false)
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
        case 125: // Down Arrow
            return handleDownArrow()
        case 126: // Up Arrow
            return handleUpArrow()
        case 36:  // Enter
            return handleEnter()
        default:
            return false
        }
    }
}
