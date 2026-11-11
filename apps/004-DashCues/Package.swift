// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DashCues",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "DashCues", targets: ["DashCues"]),
        .library(name: "DashCuesCore", targets: ["DashCuesCore"])
    ],
    targets: [
        .target(
            name: "DashCuesCore",
            path: "Sources/DashCuesCore"
        ),
        .executableTarget(
            name: "DashCues",
            dependencies: ["DashCuesCore"],
            path: "Sources/DashCues"
        ),
        .testTarget(
            name: "DashCuesTests",
            dependencies: ["DashCuesCore"],
            path: "Tests/DashCuesTests"
        )
    ]
)
