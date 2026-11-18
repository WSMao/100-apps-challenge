import AppKit
#if canImport(DashCuesCore)
import DashCuesCore
#endif

@main
enum DashCuesMain {
    @MainActor
    static func main() {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        application.run()
    }
}
