import Foundation

/// 睡前避坑與儀式檢核項目
struct ChecklistItem: Identifiable, Codable, Equatable {
    var id: String
    var title: String
    var subtitle: String
    var iconName: String
    var isCompleted: Bool
    var category: Category
    
    enum Category: String, Codable, CaseIterable {
        case avoidance = "避坑防範" // 避免刺激物/藍光
        case environment = "環境調節" // 燈光/溫度
        case mind = "放鬆靜心"       // 呼吸/伸展
    }
    
    static var defaultItems: [ChecklistItem] {
        [
            ChecklistItem(
                id: "caffeine",
                title: "午後停止攝取咖啡因",
                subtitle: "咖啡因半衰期約 6-8 小時，避免影響深層睡眠波",
                iconName: "cup.and.saucer.fill",
                isCompleted: false,
                category: .avoidance
            ),
            ChecklistItem(
                id: "screens",
                title: "睡前 1 小時遠離藍光螢幕",
                subtitle: "關閉手機平板或開啟夜覽，降低視網膜神經刺激",
                iconName: "iphone.slash",
                isCompleted: false,
                category: .avoidance
            ),
            ChecklistItem(
                id: "lighting",
                title: "臥室調為微光或全暗",
                subtitle: "低色溫暖黃光能促進人體松果體自然分泌褪黑激素",
                iconName: "lamp.table.fill",
                isCompleted: false,
                category: .environment
            ),
            ChecklistItem(
                id: "temperature",
                title: "調節涼爽室溫 (約 20-22°C)",
                subtitle: "核心體溫微降有助於神經系統更快切換至入睡模式",
                iconName: "thermometer.snowflake",
                isCompleted: false,
                category: .environment
            ),
            ChecklistItem(
                id: "mind_calm",
                title: "睡前 3 分鐘深呼吸或放鬆伸展",
                subtitle: "放下今日未完成的煩惱，告訴大腦『現在是休息時間』",
                iconName: "wind",
                isCompleted: false,
                category: .mind
            )
        ]
    }
}

