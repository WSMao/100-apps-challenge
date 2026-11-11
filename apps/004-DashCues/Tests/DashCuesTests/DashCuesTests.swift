import XCTest
@testable import DashCuesCore

final class DashCuesUnitAndIntegrationTests: XCTestCase {
    @MainActor
    func testAllCoreSubsystemsAndSelfTests() throws {
        try ShortcutStoreSelfTest.run()
    }
}
