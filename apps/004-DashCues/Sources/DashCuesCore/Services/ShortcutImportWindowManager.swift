import AppKit
import Combine
import SwiftUI

@MainActor
final class ShortcutImportWindowManager: NSObject, ObservableObject, NSWindowDelegate {
    private var window: NSWindow?
    @Published private(set) var isPresented: Bool = false

    private weak var parentWindow: NSWindow?
    private var didBecomeKeyObserver: Any?

    override init() {
        super.init()
        didBecomeKeyObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.didBecomeKeyNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            MainActor.assumeIsolated {
                guard let self, self.isPresented, let win = self.window else { return }
                if let activatedWin = notification.object as? NSWindow,
                   activatedWin === self.parentWindow,
                   activatedWin !== win {
                    NSSound.beep()
                    win.makeKeyAndOrderFront(nil)
                }
            }
        }
    }

    deinit {
        if let observer = didBecomeKeyObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    func show(
        application: ShortcutApplication,
        store: ShortcutStore,
        clipboardWriter: @escaping (String) -> Bool,
        initialSheetID: String?,
        parentWindow: NSWindow?,
        onSuccess: @escaping (String) -> Void,
        onError: @escaping (String) -> Void
    ) {
        self.parentWindow = parentWindow

        if let existing = window {
            existing.makeKeyAndOrderFront(nil)
            isPresented = true
            return
        }

        let importSheet = ShortcutImportSheet(
            application: application,
            store: store,
            clipboardWriter: clipboardWriter,
            initialSheetID: initialSheetID,
            onSuccess: { [weak self] message in
                onSuccess(message)
                self?.close()
            },
            onError: onError,
            onDismiss: { [weak self] in
                self?.close()
            }
        )

        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 880, height: 600),
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        newWindow.title = "匯入快捷鍵"
        newWindow.titleVisibility = .hidden
        newWindow.titlebarAppearsTransparent = true
        newWindow.isMovableByWindowBackground = true
        newWindow.minSize = NSSize(width: 800, height: 520)
        newWindow.level = .floating
        newWindow.isReleasedWhenClosed = false
        newWindow.delegate = self

        newWindow.standardWindowButton(.closeButton)?.isHidden = true
        newWindow.standardWindowButton(.miniaturizeButton)?.isHidden = true
        newWindow.standardWindowButton(.zoomButton)?.isHidden = true

        newWindow.contentViewController = NSHostingController(rootView: importSheet)
        newWindow.centerInVisibleFrame()

        self.window = newWindow
        self.isPresented = true

        newWindow.makeKeyAndOrderFront(nil)
    }

    func bringToFront() {
        guard let window, window.isVisible else { return }
        window.makeKeyAndOrderFront(nil)
    }

    func close() {
        window?.orderOut(nil)
        window = nil
        isPresented = false
        parentWindow?.makeKeyAndOrderFront(nil)
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        close()
        return true
    }
}
