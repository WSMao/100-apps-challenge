import AppKit
import SwiftUI

struct HotKeyRecorder: NSViewRepresentable {
    let configuration: HotKeyConfiguration
    let onRecord: (HotKeyConfiguration) -> Void

    func makeNSView(context: Context) -> HotKeyRecorderNSView {
        let view = HotKeyRecorderNSView()
        view.onRecord = onRecord
        view.configuration = configuration
        return view
    }

    func updateNSView(_ nsView: HotKeyRecorderNSView, context: Context) {
        nsView.onRecord = onRecord
        nsView.configuration = configuration
        nsView.needsDisplay = true
    }
}

final class HotKeyRecorderNSView: NSView {
    var configuration = HotKeyConfiguration.defaultValue
    var onRecord: ((HotKeyConfiguration) -> Void)?
    private var isRecording = false

    override var acceptsFirstResponder: Bool { true }

    override func mouseDown(with event: NSEvent) {
        isRecording = true
        window?.makeFirstResponder(self)
        needsDisplay = true
    }

    override func keyDown(with event: NSEvent) {
        guard isRecording else {
            super.keyDown(with: event)
            return
        }

        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        var modifiers: UInt32 = 0
        if flags.contains(.command) { modifiers |= HotKeyModifiers.command }
        if flags.contains(.shift) { modifiers |= HotKeyModifiers.shift }
        if flags.contains(.option) { modifiers |= HotKeyModifiers.option }
        if flags.contains(.control) { modifiers |= HotKeyModifiers.control }

        guard modifiers != 0 else {
            NSSound.beep()
            return
        }

        onRecord?(HotKeyConfiguration(keyCode: UInt32(event.keyCode), modifiers: modifiers))
        isRecording = false
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        let bounds = bounds.insetBy(dx: 1, dy: 1)
        let path = NSBezierPath(roundedRect: bounds, xRadius: 6, yRadius: 6)
        (isRecording ? NSColor.controlAccentColor : NSColor.separatorColor).setStroke()
        path.lineWidth = isRecording ? 2 : 1
        path.stroke()

        let label = isRecording ? "請按下組合鍵…" : HotKeyLabel.string(for: configuration)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .medium),
            .foregroundColor: NSColor.labelColor
        ]
        let size = label.size(withAttributes: attributes)
        label.draw(
            at: NSPoint(x: bounds.midX - size.width / 2, y: bounds.midY - size.height / 2),
            withAttributes: attributes
        )
    }
}

enum HotKeyLabel {
    static func string(for configuration: HotKeyConfiguration) -> String {
        var result = ""
        if configuration.modifiers & HotKeyModifiers.control != 0 { result += "⌃" }
        if configuration.modifiers & HotKeyModifiers.option != 0 { result += "⌥" }
        if configuration.modifiers & HotKeyModifiers.shift != 0 { result += "⇧" }
        if configuration.modifiers & HotKeyModifiers.command != 0 { result += "⌘" }
        result += keyName(configuration.keyCode)
        return result
    }

    static func keyName(_ keyCode: UInt32) -> String {
        switch keyCode {
        case 0...9: ["A", "S", "D", "F", "H", "G", "Z", "X", "C", "V"][Int(keyCode)]
        case 11...17: ["B", "Q", "W", "E", "R", "Y", "T"][Int(keyCode) - 11]
        case 31: "O"
        case 32: "U"
        case 34: "I"
        case 35: "P"
        case 37: "L"
        case 38: "J"
        case 40: "K"
        case 45: "N"
        case 46: "M"
        case 18...29: ["1", "2", "3", "4", "6", "5", "=", "9", "7", "−", "8", "0"][Int(keyCode) - 18]
        case 36: "↩"
        case 76: "⌅"
        case 48: "⇥"
        case 49: "Space"
        case 51: "⌫"
        case 117: "⌦"
        case 53: "Esc"
        case 115: "Home"
        case 119: "End"
        case 116: "⇞"
        case 121: "⇟"
        case 30: "]"
        case 33: "["
        case 39: "'"
        case 41: ";"
        case 42: "\\"
        case 43: ","
        case 44: "/"
        case 47: "."
        case 50: "`"
        case 122: "F1"
        case 120: "F2"
        case 99: "F3"
        case 118: "F4"
        case 96: "F5"
        case 97: "F6"
        case 98: "F7"
        case 100: "F8"
        case 101: "F9"
        case 109: "F10"
        case 103: "F11"
        case 111: "F12"
        case 123: "←"
        case 124: "→"
        case 125: "↓"
        case 126: "↑"
        default: "Key \(keyCode)"
        }
    }
}
