import AppKit

@MainActor
extension NSWindow {
    func placeInVisibleFrame(padding: CGFloat = 16) {
        guard let targetScreen = screen ?? NSScreen.main ?? NSScreen.screens.first else { return }
        var frame = self.frame
        var visibleFrame = targetScreen.visibleFrame
        visibleFrame = visibleFrame.insetBy(dx: padding, dy: padding)

        frame.size.width = min(frame.size.width, visibleFrame.width)
        frame.size.height = min(frame.size.height, visibleFrame.height)

        frame.origin.x = min(max(frame.origin.x, visibleFrame.minX), visibleFrame.maxX - frame.width)
        frame.origin.y = min(max(frame.origin.y, visibleFrame.minY), visibleFrame.maxY - frame.height)

        setFrame(frame, display: true)
    }

    func centerInVisibleFrame() {
        guard let targetScreen = screen ?? NSScreen.main ?? NSScreen.screens.first else { return }
        let visibleFrame = targetScreen.visibleFrame
        let frame = NSRect(
            x: visibleFrame.midX - (self.frame.width / 2),
            y: visibleFrame.midY - (self.frame.height / 2),
            width: self.frame.width,
            height: self.frame.height
        )
        setFrame(frame, display: true)
        placeInVisibleFrame()
    }
}
