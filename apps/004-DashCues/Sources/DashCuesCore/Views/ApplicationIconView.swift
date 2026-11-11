import AppKit
import SwiftUI

@MainActor
enum ApplicationIconProvider {
    private static var cache: [String: NSImage] = [:]

    /// The real icon of the installed app with this bundle ID, or nil if it isn't installed.
    static func icon(bundleIdentifier: String) -> NSImage? {
        if ProcessInfo.processInfo.environment["DASHCUES_UI_TESTING"] == "1" {
            return nil
        }
        guard !bundleIdentifier.isEmpty else { return nil }
        if let cached = cache[bundleIdentifier] { return cached }
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier) else {
            return nil
        }
        let image = NSWorkspace.shared.icon(forFile: url.path)
        cache[bundleIdentifier] = image
        return image
    }

    private static var customCache: [String: NSImage] = [:]

    /// Pre-scales a custom icon to 2x the display size so small icons stay sharp.
    static func customIcon(data: Data, pointSize: CGFloat) -> NSImage? {
        let key = "\(data.hashValue)-\(Int(pointSize))"
        if let cached = customCache[key] { return cached }
        guard let source = NSImage(data: data) else { return nil }
        let pixels = max(1, Int((pointSize * 2).rounded()))
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
        ) else { return source }
        rep.size = NSSize(width: pointSize, height: pointSize)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSGraphicsContext.current?.imageInterpolation = .high
        source.draw(in: NSRect(origin: .zero, size: rep.size))
        NSGraphicsContext.restoreGraphicsState()
        let image = NSImage(size: rep.size)
        image.addRepresentation(rep)
        customCache[key] = image
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
        if let data = application.customIconData,
                  let image = ApplicationIconProvider.customIcon(data: data, pointSize: size) {
            Image(nsImage: image)
                .resizable()
                .interpolation(.high)
                .frame(width: size, height: size)
        } else if let image = ApplicationIconProvider.icon(bundleIdentifier: application.bundleIdentifier) {
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
