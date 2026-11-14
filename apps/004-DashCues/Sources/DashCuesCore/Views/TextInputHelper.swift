import AppKit

/// Checks whether any editable text input (NSTextView or NSTextField) currently has focus with a cursor in the window.
@MainActor
func isTextInputActive(in window: NSWindow? = nil) -> Bool {
    let targetWindow = window ?? NSApplication.shared.keyWindow ?? NSApplication.shared.mainWindow
    let responder = targetWindow?.firstResponder ?? NSApplication.shared.keyWindow?.firstResponder
    if let textView = responder as? NSTextView {
        return textView.isEditable
    }
    if let textField = responder as? NSTextField {
        return textField.isEditable
    }
    if let text = responder as? NSText {
        return text.isEditable
    }
    return false
}
