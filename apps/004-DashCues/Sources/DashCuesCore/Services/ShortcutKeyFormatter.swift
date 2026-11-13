import AppKit

enum ShortcutKeyFormatter {
    // Device-dependent modifier masks (low 16 bits of NSEvent.modifierFlags.rawValue)
    // from Carbon / IOKit Events.h
    static let NX_DEVICELCTLKEYMASK: UInt = 1 << 0   // 0x0001
    static let NX_DEVICERCTLKEYMASK: UInt = 1 << 13  // 0x2000
    static let NX_DEVICELSHIFTKEYMASK: UInt = 1 << 1 // 0x0002
    static let NX_DEVICERSHIFTKEYMASK: UInt = 1 << 2 // 0x0004
    static let NX_DEVICELCMDKEYMASK: UInt = 1 << 3   // 0x0008
    static let NX_DEVICERCMDKEYMASK: UInt = 1 << 4   // 0x0010
    static let NX_DEVICELALTKEYMASK: UInt = 1 << 5   // 0x0020
    static let NX_DEVICERALTKEYMASK: UInt = 1 << 6   // 0x0040

    static func modifierSymbols(_ flags: NSEvent.ModifierFlags) -> [String] {
        var symbols: [String] = []
        let raw = flags.rawValue

        if flags.contains(.control) {
            if (raw & NX_DEVICERCTLKEYMASK) != 0 {
                symbols.append("RCtrl")
            } else {
                symbols.append("⌃")
            }
        }
        if flags.contains(.option) {
            if (raw & NX_DEVICERALTKEYMASK) != 0 {
                symbols.append("ROpt")
            } else {
                symbols.append("⌥")
            }
        }
        if flags.contains(.shift) {
            if (raw & NX_DEVICERSHIFTKEYMASK) != 0 {
                symbols.append("RShift")
            } else {
                symbols.append("⇧")
            }
        }
        if flags.contains(.command) {
            if (raw & NX_DEVICERCMDKEYMASK) != 0 {
                symbols.append("RCmd")
            } else {
                symbols.append("⌘")
            }
        }
        return symbols
    }

    static func displaySymbol(for key: String) -> String {
        switch key {
        case "LCmd": return "⌘ʟ"
        case "RCmd": return "⌘ʀ"
        case "LCtrl": return "⌃ʟ"
        case "RCtrl": return "⌃ʀ"
        case "LOpt": return "⌥ʟ"
        case "ROpt": return "⌥ʀ"
        case "LShift": return "⇧ʟ"
        case "RShift": return "⇧ʀ"
        default: return key
        }
    }

    static func keys(keyCode: UInt16, flags: NSEvent.ModifierFlags, characters: String?) -> [String] {
        modifierSymbols(flags) + [keyName(keyCode: keyCode, characters: characters)]
    }

    private static func keyName(keyCode: UInt16, characters: String?) -> String {
        let name = HotKeyLabel.keyName(UInt32(keyCode))
        if name.hasPrefix("Key "), let first = characters?.uppercased().first {
            return String(first)
        }
        return name
    }
}
