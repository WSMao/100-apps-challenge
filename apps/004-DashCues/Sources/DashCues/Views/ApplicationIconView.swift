import AppKit
import SwiftUI

@MainActor
enum ApplicationIconProvider {
    private static var cache: [String: NSImage] = [:]

    /// The real icon of the installed app with this bundle ID, or nil if it isn't installed.
    static func icon(bundleIdentifier: String) -> NSImage? {
        guard !bundleIdentifier.isEmpty else { return nil }
        if let cached = cache[bundleIdentifier] { return cached }
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier) else {
            return nil
        }
        let image = NSWorkspace.shared.icon(forFile: url.path)
        cache[bundleIdentifier] = image
        return image
    }

    static func invalidate(bundleIdentifier: String) {
        cache[bundleIdentifier] = nil
    }
}

/// Shows the app's real icon, falling back to its SF Symbol.
struct ApplicationIconView: View {
    let application: ShortcutApplication
    var size: CGFloat = 16

    var body: some View {
        if let image = ApplicationIconProvider.icon(bundleIdentifier: application.bundleIdentifier) {
            Image(nsImage: image)
                .resizable()
                .interpolation(.high)
                .frame(width: size, height: size)
        } else {
            Image(systemName: application.symbolName)
                .font(.system(size: size * 0.8))
                .foregroundStyle(.tint)
                .frame(width: size, height: size)
        }
    }
}
