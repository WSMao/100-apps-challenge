// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DashCues",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "DashCues", targets: ["DashCues"])
    ],
    targets: [
        .executableTarget(name: "DashCues")
    ]
)
