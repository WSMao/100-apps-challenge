import AppKit

enum ShortcutKeyFormatter {
    static func modifierSymbols(_ flags: NSEvent.ModifierFlags) -> [String] {
        var symbols: [String] = []
        if flags.contains(.control) { symbols.append("⌃") }
        if flags.contains(.option) { symbols.append("⌥") }
        if flags.contains(.shift) { symbols.append("⇧") }
        if flags.contains(.command) { symbols.append("⌘") }
        return symbols
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
