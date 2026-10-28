import AppKit
import Combine
import SwiftUI

@MainActor
final class PinnedMapWindowManager: NSObject, ObservableObject, NSWindowDelegate {
    private var windows: [String: NSPanel] = [:]
    @Published private(set) var pinnedApplicationIDs = Set<String>()

    func isPinned(applicationID: String) -> Bool {
        pinnedApplicationIDs.contains(applicationID)
    }

    func toggle(application: ShortcutApplication) {
        if isPinned(applicationID: application.id) {
            close(applicationID: application.id)
        } else {
            show(application: application)
        }
    }

    func show(application: ShortcutApplication) {
        if let existingWindow = windows[application.id] {
            existingWindow.contentViewController = NSHostingController(
                rootView: ShortcutMapView(
                    application: application,
                    isPinned: true,
                    onTogglePin: { [weak self] in self?.close(applicationID: application.id) }
                )
            )
            existingWindow.placeInVisibleFrame()
            existingWindow.makeKeyAndOrderFront(nil)
            return
        }

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 380, height: 480),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        panel.title = "\(application.name) 快捷鍵"
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isReleasedWhenClosed = false
        panel.delegate = self
        panel.contentViewController = NSHostingController(
            rootView: ShortcutMapView(
                application: application,
                isPinned: true,
                onTogglePin: { [weak self] in self?.close(applicationID: application.id) }
            )
        )
        windows[application.id] = panel
        pinnedApplicationIDs.insert(application.id)
        panel.centerInVisibleFrame()
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
    }

    func close(applicationID: String) {
        guard let window = windows[applicationID] else { return }
        window.close()
    }

    func windowWillClose(_ notification: Notification) {
        guard let closedWindow = notification.object as? NSWindow else { return }
        guard let applicationID = windows.first(where: { $0.value === closedWindow })?.key else { return }
        windows.removeValue(forKey: applicationID)
        pinnedApplicationIDs.remove(applicationID)
    }
}
