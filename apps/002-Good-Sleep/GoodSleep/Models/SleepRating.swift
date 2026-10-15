import Foundation

/// 晨間起床精神狀態自評貼圖
enum SleepRating: String, CaseIterable, Codable, Identifiable {
    case refreshed = "refreshed"   // 🤩 精力充沛
    case good = "good"             // 😊 感覺良好
    case tired = "tired"           // 🥱 仍有倦意
    case exhausted = "exhausted"   // 😵 昏沈熊貓眼
    
    var id: String { rawValue }
    
    var emoji: String {
        switch self {
        case .refreshed: return "🤩"
        case .good: return "😊"
        case .tired: return "🥱"
        case .exhausted: return "😵"
        }
    }
    
    var title: String {
        switch self {
        case .refreshed: return "精力充沛"
        case .good: return "感覺良好"
        case .tired: return "略帶倦意"
        case .exhausted: return "昏沈熊貓眼"
        }
    }
    
    var description: String {
        switch self {
        case .refreshed: return "大腦清晰，神清氣爽無負擔"
        case .good: return "睡眠品質穩定，可迅速進入工作狀態"
        case .tired: return "醒來稍微沉重，建議多喝溫水與照光"
        case .exhausted: return "睡眠中斷或時長嚴重不足，今晚提早就寢"
        }
    }
    
    var score: Int {
        switch self {
        case .refreshed: return 100
        case .good: return 80
        case .tired: return 55
        case .exhausted: return 30
        }
    }
}

