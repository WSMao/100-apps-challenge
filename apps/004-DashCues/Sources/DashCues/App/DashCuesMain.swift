import AppKit
import Darwin

@main
enum DashCuesMain {
    @MainActor
    static func main() {
        if CommandLine.arguments.contains("--self-test") {
            do {
                try ShortcutStoreSelfTest.run()
                return
            } catch {
                fputs("DashCues self-test failed: \(error.localizedDescription)\n", stderr)
                exit(EXIT_FAILURE)
            }
        }

        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        application.run()
    }
}
