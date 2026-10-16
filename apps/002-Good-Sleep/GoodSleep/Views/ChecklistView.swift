import SwiftUI

/// 睡前主題專區：睡眠引導、好睡清單與科學入睡
struct ChecklistView: View {
    @ObservedObject var store: SleepStore
    @StateObject private var soundManager = SoundManager.shared
    
    // 主題折疊/展開狀態（預設全數為 fold 狀態）
    @State private var expandedTopics: Set<SleepTopic> = []
    
    // 「睡眠引導」子分類（白噪音 vs 冥想引導）
    @State private var selectedGuidanceCategory: GuidanceCategory = .whiteNoise
    
    // 「科學入睡」彈出視窗選中的文章與閱讀字體大小偏好
    @State private var selectedArticle: ScienceArticle? = nil
    @State private var articleFontSize: ArticleFontSize = .medium
    
    // 記錄已讀文章集合
    @State private var readArticleIds: Set<String> = []
    
    // 文章閱讀字體大小設定 (S / M / L)
    enum ArticleFontSize: String, CaseIterable {
        case small = "S"
        case medium = "M"
        case large = "L"
        
        var titleSize: CGFloat {
            switch self {
            case .small: return 18
            case .medium: return 21
            case .large: return 24
            }
        }
        
        var sectionHeadingSize: CGFloat {
            switch self {
            case .small: return 14
            case .medium: return 16
            case .large: return 18.5
            }
        }
        
        var bodySize: CGFloat {
            switch self {
            case .small: return 13.5
            case .medium: return 15.5
            case .large: return 18.0
            }
        }
        
        var lineSpacing: CGFloat {
            switch self {
            case .small: return 4.5
            case .medium: return 6.5
            case .large: return 8.5
            }
        }
    }
    
    // 主題分類枚舉
    enum SleepTopic: String, CaseIterable, Identifiable {
        case sleepGuidance = "睡眠引導"
        case sleepChecklist = "好睡清單"
        case scienceSleep = "科學入睡"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .sleepGuidance: return "sparkles"
            case .sleepChecklist: return "checklist"
            case .scienceSleep: return "book.closed.fill"
            }
        }
        
        var subtitle: String {
            switch self {
            case .sleepGuidance: return "助眠白噪音與冥想呼吸引導"
            case .sleepChecklist: return "5 項睡前黃金避坑檢核清單"
            case .scienceSleep: return "史丹佛醫學與咖啡因代謝研究"
            }
        }
    }
    
    enum GuidanceCategory: String, CaseIterable, Identifiable {
        case whiteNoise = "白噪音"
        case meditation = "冥想引導"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .whiteNoise: return "waveform"
            case .meditation: return "figure.mind.and.body"
            }
        }
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                SleepTheme.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 16) {
                        // 頂部間距與微提示
                        HStack {
                            Text("睡前引導專區")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(SleepTheme.textTertiary)
                            Spacer()
                            Text("點選主題展開")
                                .font(.system(size: 12))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                        
                        // 三大主題折疊/展開卡片
                        VStack(spacing: 14) {
                            ForEach(SleepTopic.allCases) { topic in
                                topicCard(for: topic)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 24)
                    }
                }
                
                // MARK: - 科學入睡文章彈出視窗 (致中顯示，點擊邊緣 Margin 關閉)
                if let article = selectedArticle {
                    ZStack {
                        // 半透明暗色背景 (點擊 Margin 即關閉視窗)
                        Color.black.opacity(0.68)
                            .ignoresSafeArea()
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.22)) {
                                    selectedArticle = nil
                                }
                            }
                        
                        // 致中彈出卡片 (留有邊距 Margin)
                        articleModalCard(for: article)
                            .padding(.horizontal, 22)
                            .padding(.vertical, 32)
                            .transition(.scale(scale: 0.92).combined(with: .opacity))
                    }
                    .zIndex(999)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
    
    // MARK: - 主題卡片容器 (支援 Fold / Unfold)
    private func topicCard(for topic: SleepTopic) -> some View {
        let isExpanded = expandedTopics.contains(topic)
        
        return VStack(alignment: .leading, spacing: 0) {
            // 卡片標題點擊列 (Header)
            Button {
                withAnimation(.easeInOut(duration: 0.26)) {
                    if isExpanded {
                        expandedTopics.remove(topic)
                    } else {
                        expandedTopics.insert(topic)
                    }
                }
            } label: {
                HStack(spacing: 14) {
                    // 主題圖示
                    ZStack {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(isExpanded ? SleepTheme.accent.opacity(0.18) : SleepTheme.surfaceSecondary)
                            .frame(width: 44, height: 44)
                        
                        Image(systemName: topic.icon)
                            .font(.system(size: 20))
                            .foregroundColor(isExpanded ? SleepTheme.accent : SleepTheme.textSecondary)
                    }
                    
                    // 標題與簡介
                    VStack(alignment: .leading, spacing: 3) {
                        Text(topic.rawValue)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(isExpanded ? SleepTheme.accent : SleepTheme.textPrimary)
                        
                        Text(topic.subtitle)
                            .font(.system(size: 12))
                            .foregroundColor(SleepTheme.textSecondary)
                    }
                    
                    Spacer()
                    
                    // 右側狀態與箭頭指示
                    HStack(spacing: 8) {
                        statusBadge(for: topic)
                        
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(isExpanded ? SleepTheme.accent : SleepTheme.textTertiary)
                    }
                }
                .padding(16)
                .background(SleepTheme.surface)
            }
            .buttonStyle(.plain)
            
            // 展開內容 (Unfolded Content)
            if isExpanded {
                VStack(alignment: .leading, spacing: 14) {
                    Divider()
                        .background(SleepTheme.border)
                        .padding(.horizontal, 16)
                    
                    Group {
                        switch topic {
                        case .sleepGuidance:
                            guidanceTopicContent
                        case .sleepChecklist:
                            checklistTopicContent
                        case .scienceSleep:
                            scienceTopicContent
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
                .background(SleepTheme.surface)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(isExpanded ? SleepTheme.accent.opacity(0.3) : Color.white.opacity(0.04), lineWidth: 1)
        )
    }
    
    // MARK: - 主題右側狀態小標籤
    @ViewBuilder
    private func statusBadge(for topic: SleepTopic) -> some View {
        switch topic {
        case .sleepGuidance:
            if soundManager.isPlaying {
                HStack(spacing: 4) {
                    Circle()
                        .fill(SleepTheme.success)
                        .frame(width: 6, height: 6)
                    Text("播放中")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(SleepTheme.success)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(SleepTheme.success.opacity(0.12))
                .clipShape(Capsule())
            }
        case .sleepChecklist:
            let completed = store.checklist.filter { $0.isCompleted }.count
            let total = store.checklist.count
            Text("\(completed)/\(total)")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(completed == total && total > 0 ? SleepTheme.success : SleepTheme.accent)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(SleepTheme.surfaceSecondary)
                .clipShape(Capsule())
        case .scienceSleep:
            let count = ScienceArticle.allArticles.count
            Text("\(count) 篇專題")
                .font(.system(size: 11))
                .foregroundColor(SleepTheme.textTertiary)
        }
    }
    
    // MARK: - 主題 1: 睡眠引導 (含白噪音與冥想引導)
    private var guidanceTopicContent: some View {
        VStack(alignment: .leading, spacing: 14) {
            // 子分類切換器 (白噪音 / 冥想引導)
            HStack(spacing: 8) {
                ForEach(GuidanceCategory.allCases) { category in
                    let isSelected = selectedGuidanceCategory == category
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedGuidanceCategory = category
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: category.icon)
                                .font(.system(size: 12))
                            Text(category.rawValue)
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundColor(isSelected ? SleepTheme.background : SleepTheme.textSecondary)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(isSelected ? SleepTheme.accent : SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            
            if selectedGuidanceCategory == .whiteNoise {
                // 白噪音子分類內容
                whiteNoiseSubcategoryView
            } else {
                // 冥想引導子分類內容
                meditationSubcategoryView
            }
        }
    }
    
    // 白噪音細分子區塊
    private var whiteNoiseSubcategoryView: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("🌙 助眠微音效 (低頻白噪音)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(SleepTheme.textSecondary)
                Spacer()
                if soundManager.isPlaying {
                    Button("停止播放") {
                        soundManager.stop()
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(SleepTheme.warning)
                }
            }
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(SoundManager.SoundType.allCases) { sound in
                    let isCurrent = (soundManager.currentSound == sound && soundManager.isPlaying)
                    Button {
                        soundManager.toggleSound(sound)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sound.icon)
                                .font(.system(size: 16))
                                .foregroundColor(isCurrent ? SleepTheme.accent : SleepTheme.textSecondary)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(sound.rawValue)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(isCurrent ? SleepTheme.accent : SleepTheme.textPrimary)
                                Text(isCurrent ? "播放中..." : "點擊播放")
                                    .font(.system(size: 10))
                                    .foregroundColor(isCurrent ? SleepTheme.success : SleepTheme.textTertiary)
                            }
                            Spacer()
                        }
                        .padding(10)
                        .background(isCurrent ? SleepTheme.accent.opacity(0.12) : SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(isCurrent ? SleepTheme.accent.opacity(0.4) : Color.clear, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
    
    // 冥想引導細分子區塊 (含 4-7-8 呼吸互動器與漸進式放鬆)
    private var meditationSubcategoryView: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("🧘 睡前放鬆與身心調息")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(SleepTheme.textSecondary)
            
            // 4-7-8 呼吸練習器
            BreathingCard()
            
            // 身體掃描與思緒放空指南
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundColor(SleepTheme.accent)
                        .font(.system(size: 12))
                    Text("漸進式身體掃描（Body Scan）")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(SleepTheme.textPrimary)
                }
                
                Text("從前額、咬合肌、雙肩到雙腳，隨呼氣將各部位重力完全交託給床墊。思緒浮現時不加評判，像看待夜空微雲般溫和目送它飄過。")
                    .font(.system(size: 12))
                    .foregroundColor(SleepTheme.textSecondary)
                    .lineSpacing(3)
            }
            .padding(12)
            .background(SleepTheme.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }
    
    // MARK: - 主題 2: 好睡清單 (保留環境調解、放鬆心情、避坑規範 3 組細分類)
    private var checklistTopicContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(ChecklistItem.Category.allCases, id: \.self) { category in
                let items = store.checklist.filter { $0.category == category }
                if !items.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(category.rawValue)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(SleepTheme.accent)
                            Spacer()
                            Text("\(items.filter { $0.isCompleted }.count)/\(items.count)")
                                .font(.system(size: 11))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                        
                        VStack(spacing: 8) {
                            ForEach(items) { item in
                                ChecklistRow(item: item) {
                                    store.toggleChecklistItem(id: item.id)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - 主題 3: 科學入睡 (展示實用科研卡片，右下角手勢圖示，點擊彈出視窗)
    private var scienceTopicContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(ScienceArticle.allArticles) { article in
                articlePreviewCard(for: article)
            }
        }
    }
    
    // 文章預覽卡片（右下角帶有手勢圖示，不往下展開，點擊彈出置中視窗）
    private func articlePreviewCard(for article: ScienceArticle) -> some View {
        let isRead = readArticleIds.contains(article.id)
        
        return Button {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) {
                selectedArticle = article
            }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                // 標籤列
                HStack(spacing: 8) {
                    Text(article.badge)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(SleepTheme.accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(SleepTheme.accent.opacity(0.12))
                        .clipShape(Capsule())
                    
                    Text(article.source)
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.textTertiary)
                    
                    Spacer()
                    
                    if isRead {
                        HStack(spacing: 3) {
                            Image(systemName: "checkmark.circle.fill")
                            Text("已讀")
                        }
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(SleepTheme.success)
                    }
                }
                
                // 標題與簡介
                VStack(alignment: .leading, spacing: 5) {
                    Text(article.title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(SleepTheme.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    
                    Text(article.summary)
                        .font(.system(size: 12))
                        .foregroundColor(SleepTheme.textSecondary)
                        .lineSpacing(3)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                
                // 底端資訊與右下角手的圖示
                HStack {
                    Text(article.readingTime)
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.textTertiary)
                    
                    Spacer()
                    
                    // 右下角「手的圖示」，提示可點開閱讀
                    HStack(spacing: 4) {
                        Image(systemName: "hand.tap.fill")
                            .font(.system(size: 13))
                        Text("點擊閱讀")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(SleepTheme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(SleepTheme.accent.opacity(0.1))
                    .clipShape(Capsule())
                }
                .padding(.top, 2)
            }
            .padding(14)
            .background(SleepTheme.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - 彈出式文章全螢幕致中閱讀卡片
    private func articleModalCard(for article: ScienceArticle) -> some View {
        let isRead = readArticleIds.contains(article.id)
        
        return VStack(alignment: .leading, spacing: 0) {
            // 頂部控制列 (標籤與關閉按鈕)
            HStack {
                HStack(spacing: 6) {
                    Text(article.badge)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(SleepTheme.accent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(SleepTheme.accent.opacity(0.14))
                        .clipShape(Capsule())
                    
                    Text(article.readingTime)
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.textTertiary)
                }
                
                Spacer()
                
                // 字體大小 S / M / L 切換器 (間距 6，尺寸 30x28，字級 11pt)
                HStack(spacing: 6) {
                    ForEach(ArticleFontSize.allCases, id: \.self) { size in
                        let isSelected = articleFontSize == size
                        Button {
                            withAnimation(.easeInOut(duration: 0.16)) {
                                articleFontSize = size
                            }
                        } label: {
                            Text(size.rawValue)
                                .font(.system(size: 11, weight: isSelected ? .bold : .semibold))
                                .foregroundColor(isSelected ? SleepTheme.background : SleepTheme.textSecondary)
                                .frame(width: 30, height: 28)
                                .background(isSelected ? SleepTheme.accent : SleepTheme.surfaceSecondary)
                                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                                        .stroke(isSelected ? SleepTheme.accent : Color.white.opacity(0.08), lineWidth: 1)
                                )
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
            
            Divider()
                .background(SleepTheme.border)
            
            // 文章可捲動內文區塊
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // 大標題
                    VStack(alignment: .leading, spacing: 6) {
                        Text(article.title)
                            .font(.system(size: articleFontSize.titleSize, weight: .bold))
                            .foregroundColor(SleepTheme.textPrimary)
                            .lineSpacing(4)
                        
                        Text(article.source)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(SleepTheme.accent)
                    }
                    
                    // 摘要區塊
                    Text(article.summary)
                        .font(.system(size: articleFontSize.bodySize))
                        .foregroundColor(SleepTheme.textPrimary)
                        .lineSpacing(articleFontSize.lineSpacing)
                        .padding(12)
                        .background(SleepTheme.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    
                    // 三大核心段落
                    ForEach(article.sections) { section in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(SleepTheme.accent)
                                    .frame(width: 5, height: 5)
                                Text(section.title)
                                    .font(.system(size: articleFontSize.sectionHeadingSize, weight: .semibold))
                                    .foregroundColor(SleepTheme.accent)
                            }
                            
                            Text(section.content)
                                .font(.system(size: articleFontSize.bodySize))
                                .foregroundColor(SleepTheme.textSecondary)
                                .lineSpacing(articleFontSize.lineSpacing)
                        }
                    }
                }
                .padding(18)
            }
            .frame(maxHeight: 460)
            
            Divider()
                .background(SleepTheme.border)
            
            // 底部操作按鈕
            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if isRead {
                            readArticleIds.remove(article.id)
                        } else {
                            readArticleIds.insert(article.id)
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: isRead ? "checkmark.circle.fill" : "circle")
                        Text(isRead ? "已閱讀" : "標記為已讀")
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(isRead ? SleepTheme.success : SleepTheme.accent)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 14)
                    .background(isRead ? SleepTheme.success.opacity(0.12) : SleepTheme.surfaceSecondary)
                    .clipShape(Capsule())
                }
                
                Spacer()
                
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedArticle = nil
                    }
                } label: {
                    Text("完成關閉")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(SleepTheme.background)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 16)
                        .background(SleepTheme.accent)
                        .clipShape(Capsule())
                }
            }
            .padding(14)
        }
        .background(SleepTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(SleepTheme.accent.opacity(0.25), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.6), radius: 30, x: 0, y: 15)
        // 阻止點擊卡片內部傳遞到底層遮罩
        .onTapGesture { }
    }
}

// MARK: - 科學入睡文章數據模型 (包含 2 篇精選科研專題)
struct ScienceArticle: Identifiable, Equatable {
    let id: String
    let badge: String
    let source: String
    let readingTime: String
    let title: String
    let summary: String
    let sections: [SectionItem]
    
    struct SectionItem: Identifiable, Equatable {
        let id = UUID()
        let title: String
        let content: String
    }
    
    static var allArticles: [ScienceArticle] {
        [
            ScienceArticle(
                id: "core_temp",
                badge: "🔬 生理降溫",
                source: "史丹佛大學睡眠醫學中心",
                readingTime: "約 2 分鐘閱讀",
                title: "史丹佛睡眠研究：核心體溫降溫法觸發褪黑激素",
                summary: "入睡並非強制關機，而是依賴人體核心體溫下降 1°C 觸發褪黑激素分泌。掌握降溫坡度，能顯著縮短 36% 入睡時間。",
                sections: [
                    SectionItem(
                        title: "1. 核心體溫與睡意觸發機制",
                        content: "史丹佛大學睡眠醫學中心（Stanford Sleep Center）研究證實，順利入睡的關鍵生理信號，是核心體溫（Core Body Temperature）自然微降 0.8～1.0°C。人體生物鐘會在就寢前引導微血管向四肢末端散熱，此降溫過程會同步刺激大腦松果體進入褪黑激素分泌高峰。"
                    ),
                    SectionItem(
                        title: "2. 睡前 90 分鐘「人造降溫坡度」",
                        content: "研究指出，在睡前 90 分鐘洗約 40°C 溫水澡（或足浴 15 分鐘）效果顯著。熱水能迅速擴張體表微血管，當回到 20～22°C 涼爽臥室時，微血管加速散熱，體溫在 90 分鐘內形成自然降溫陡坡，臨床顯示能縮短 36% 入睡潛伏期。"
                    ),
                    SectionItem(
                        title: "3. 涼爽避風港與睡眠維持",
                        content: "臥室環境維持在 19～21°C，並拉上 100% 遮光簾。微涼環境能讓夜間體溫維持在理想低谷，大幅減少後半夜因燥熱產生的微覺醒，保護深層睡眠連續性。"
                    )
                ]
            ),
            ScienceArticle(
                id: "sleep_cycles",
                badge: "🌙 週期節律",
                source: "國際睡眠生理學研究 (Sleep Medicine Reviews)",
                readingTime: "約 2 分鐘閱讀",
                title: "90 分鐘睡眠週期：如何精準設定喚醒時間告別昏沈？",
                summary: "人體一個完整睡眠週期約 90 分鐘（淺睡 ➔ 深睡 ➔ REM）。在週期交替的淺睡期醒來，神經慣性最低。建議以 7.5 小時 (5 週期) 或 9 小時 (6 週期) 為基準規劃鬧鐘。",
                sections: [
                    SectionItem(
                        title: "1. 睡眠週期的生理架構",
                        content: "人類睡眠並非單純一條直線，而是由「非快速動眼期（NREM：N1 入睡、N2 淺睡、N3 深慢波排毒）」與「快速動眼期（REM：大腦記憶整理與情緒修復）」交替組成。從淺睡漸入深睡再回到快速動眼期，每輪平均歷時 90 分鐘。"
                    ),
                    SectionItem(
                        title: "2. 為什麼鬧鐘響時會感到「大腦當機」？",
                        content: "如果在深層慢波睡眠期（N3）被鬧鐘強行震醒，大腦會處於嚴重的「睡眠慣性（Sleep Inertia）」狀態。此時前額葉皮質血液灌流不足，神經突觸間腺苷殘存，需要花 30～60 分鐘才能恢復清晰思維。"
                    ),
                    SectionItem(
                        title: "3. 90 分鐘黃金倍數實踐法",
                        content: "將目標睡眠時間以 90 分鐘的倍數規劃：最理想的睡眠為 7.5 小時（5 個週期）或 9 小時（6 個週期）。例如設定明早 07:00 喚醒，建議在 23:30（7.5 小時前）就寢熄燈，讓鬧鐘精準落在淺睡交替點，一醒來即神清氣爽。"
                    )
                ]
            ),
            ScienceArticle(
                id: "caffeine_halflife",
                badge: "☕️ 代謝科學",
                source: "臨床睡眠醫學期刊 (JCSM)",
                readingTime: "約 2.5 分鐘閱讀",
                title: "咖啡因半衰期真相：睡前多久必須停止攝入？",
                summary: "咖啡因平均半衰期長達 5～7 小時，四分之一衰期更達 10～12 小時。即使「喝完依然睡得著」，深層慢波睡眠仍會被無聲削減高達 30%。",
                sections: [
                    SectionItem(
                        title: "1. 腺苷受體的「假裝清醒」假象",
                        content: "大腦清醒時會持續累積「腺苷（Adenosine）」製造睡眠壓力。咖啡因分子結構與腺苷極為相似，會霸佔大腦 A1 與 A2A 腺苷受體，阻斷疲憊信號傳遞。但腺苷並未消失，一旦咖啡因在深夜被肝臟酵素分解，殘存的腺苷會引發劇烈反撲，導致睡眠極易驚醒或多夢。"
                    ),
                    SectionItem(
                        title: "2. 驚人的半衰期與四分之一衰期",
                        content: "人體內咖啡因的「半衰期（Half-life）」平均為 5～7 小時，而「四分之一衰期（Quarter-life）」長達 10～12 小時。若你在下午 4 點喝了一杯含有 200mg 咖啡因的拿鐵，到了半夜 12 點入睡時，腦內仍留存約 50～60mg 咖啡因——等同於睡前直接灌下一整罐提神飲料！"
                    ),
                    SectionItem(
                        title: "3. 科研建議：睡前 8～10 小時停止攝入",
                        content: "美國睡眠醫學會（AASM）研究證實，睡前 6 小時攝取咖啡因會使整夜睡眠總量減少超過 1 小時，並嚴重破壞負責大腦排毒修復的「深層慢波睡眠」。專家建議：若預計晚上 11 點就寢，最後一口咖啡因應落在「午後 1 點至 2 點（睡前 9～10 小時）」，留給肝臟 CYP1A2 酵素充足代謝時間。"
                    )
                ]
            )
        ]
    }
}

// MARK: - 互動式 4-7-8 呼吸小卡片
private struct BreathingCard: View {
    @State private var isActive: Bool = false
    @State private var phase: Phase = .ready
    @State private var secondsRemaining: Int = 4
    @State private var timer: Timer? = nil
    @State private var completedCycles: Int = 0
    
    enum Phase: String {
        case ready = "準備放鬆"
        case inhale = "吸氣 (4秒)"
        case hold = "屏息 (7秒)"
        case exhale = "吐氣 (8秒)"
        
        var duration: Int {
            switch self {
            case .ready: return 0
            case .inhale: return 4
            case .hold: return 7
            case .exhale: return 8
            }
        }
        
        var prompt: String {
            switch self {
            case .ready: return "放鬆肩膀，專注鼻腔自然氣流"
            case .inhale: return "緩慢深吸氣，感受腹部隆起"
            case .hold: return "平靜止息，安撫神經系統"
            case .exhale: return "由嘴唇溫柔慢吐氣，排空壓力"
            }
        }
        
        var scale: CGFloat {
            switch self {
            case .ready: return 1.0
            case .inhale: return 1.25
            case .hold: return 1.25
            case .exhale: return 0.95
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                // 呼吸圓環
                ZStack {
                    Circle()
                        .stroke(SleepTheme.accent.opacity(0.15), lineWidth: 5)
                        .frame(width: 72, height: 72)
                    
                    Circle()
                        .fill(SleepTheme.accent.opacity(isActive ? 0.22 : 0.08))
                        .frame(width: 66, height: 66)
                        .scaleEffect(isActive ? phase.scale : 1.0)
                        .animation(isActive ? .easeInOut(duration: Double(phase.duration)) : .default, value: phase)
                    
                    if isActive {
                        Text("\(secondsRemaining)")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(SleepTheme.accent)
                    } else {
                        Image(systemName: "wind")
                            .font(.system(size: 20))
                            .foregroundColor(SleepTheme.accent)
                    }
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(phase.rawValue)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(SleepTheme.textPrimary)
                        Spacer()
                        if completedCycles > 0 {
                            Text("完成 \(completedCycles) 輪")
                                .font(.system(size: 10))
                                .foregroundColor(SleepTheme.textTertiary)
                        }
                    }
                    
                    Text(phase.prompt)
                        .font(.system(size: 11))
                        .foregroundColor(SleepTheme.textSecondary)
                        .lineLimit(2)
                    
                    Button {
                        toggleBreathing()
                    } label: {
                        Text(isActive ? "暫停引導" : (completedCycles > 0 ? "繼續呼吸" : "開始 4-7-8 呼吸引導"))
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(isActive ? SleepTheme.warning : SleepTheme.background)
                            .padding(.vertical, 5)
                            .padding(.horizontal, 12)
                            .background(isActive ? SleepTheme.surfaceSecondary : SleepTheme.accent)
                            .clipShape(Capsule())
                    }
                    .padding(.top, 2)
                }
            }
        }
        .padding(12)
        .background(SleepTheme.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onDisappear {
            stopTimer()
        }
    }
    
    private func toggleBreathing() {
        if isActive {
            stopTimer()
            isActive = false
        } else {
            isActive = true
            startPhase(.inhale)
        }
    }
    
    private func startPhase(_ newPhase: Phase) {
        phase = newPhase
        secondsRemaining = newPhase.duration
        
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if secondsRemaining > 1 {
                secondsRemaining -= 1
            } else {
                nextPhase()
            }
        }
    }
    
    private func nextPhase() {
        switch phase {
        case .ready, .exhale:
            completedCycles += 1
            startPhase(.inhale)
        case .inhale:
            startPhase(.hold)
        case .hold:
            startPhase(.exhale)
        }
    }
    
    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}
