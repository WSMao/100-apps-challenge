import SwiftUI

/// 低刺激夜間主題色彩系統 (OLED 護眼規範)
enum SleepTheme {
    // 基礎背景色
    static let background = Color(hex: "080B11")       // 深邃暗夜黑
    static let surface = Color(hex: "121824")          // 第一層卡片背景
    static let surfaceSecondary = Color(hex: "1A2336") // 互動卡片/按鈕背景
    static let border = Color(hex: "23304A")            // 細膩邊框線
    
    // 重點提示與強調色 (低飽和、柔和發光)
    static let accent = Color(hex: "E5C07B")            // 月光柔金 (主強調色)
    static let moonGlow = Color(hex: "F3E5AB")          // 月華淡白
    static let lavender = Color(hex: "A388EE")          // 夢境微紫
    static let calmTeal = Color(hex: "56B6C2")          // 寧靜海洋藍
    static let success = Color(hex: "73DACA")           // 放鬆薄荷綠
    static let warning = Color(hex: "E06C75")           // 溫和警示紅
    
    // 文字色彩
    static let textPrimary = Color(hex: "EDF2F7")       // 主要文字
    static let textSecondary = Color(hex: "8A99AD")     // 次要輔助文字
    static let textTertiary = Color(hex: "526079")      // 暗淡文字
    
    // 漸層色
    static let bedtimeGradient = LinearGradient(
        colors: [Color(hex: "131B2E"), Color(hex: "080B11")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let moonCardGradient = LinearGradient(
        colors: [Color(hex: "1E283F"), Color(hex: "121824")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

