import Foundation
import AVFoundation

/// 助眠微音效與環境聲景管理器 (基於穩定高品質 AVAudioPlayer 與內建自然聲景合成)
@MainActor
final class SoundManager: NSObject, ObservableObject, AVAudioPlayerDelegate {
    static let shared = SoundManager()
    
    @Published var isPlaying: Bool = false
    @Published var currentSound: SoundType? = nil
    @Published var volume: Float = 0.6 {
        didSet {
            soundPlayer?.volume = volume
        }
    }
    @Published var isAlarmRinging: Bool = false
    @Published var isShowingWakeUpPrompt: Bool = false
    @Published var previewingRingtoneID: String? = nil
    
    // 定時器相關狀態
    @Published var activeTimerOption: SleepTimerOption = .off
    @Published var remainingTimerSeconds: Int = 0
    private var timerTargetDate: Date? = nil
    private var countdownTimer: Timer?
    private var fadeInTimer: Timer?
    
    private var soundPlayer: AVAudioPlayer?
    private var alarmPlayer: AVAudioPlayer?
    
    // 記憶體中快取已合成的 WAV 音訊 Data，避免重複生成
    private var audioDataCache: [SoundType: Data] = [:]
    
    enum SoundType: String, CaseIterable, Identifiable {
        case rain = "雨夜窗台"
        case ocean = "寧靜潮汐"
        case wind = "深山晚風"
        case whiteNoise = "溫柔白噪"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .rain: return "cloud.rain.fill"
            case .ocean: return "water.waves"
            case .wind: return "wind"
            case .whiteNoise: return "waveform.path"
            }
        }
        
        var subtitle: String {
            switch self {
            case .rain: return "沙沙規律雨聲，安撫過載神經"
            case .ocean: return "週期性潮水湧動，同步平穩呼吸"
            case .wind: return "低頻微風吹拂，營造避風港氛圍"
            case .whiteNoise: return "遮蔽突發環境雜音，保護深睡"
            }
        }
    }
    
    enum SleepTimerOption: Equatable, Identifiable {
        case off
        case minutes(Int)
        case endOfTrack
        
        var id: String {
            switch self {
            case .off: return "off"
            case .minutes(let m): return "\(m)"
            case .endOfTrack: return "end_of_track"
            }
        }
        
        var title: String {
            switch self {
            case .off: return "關閉計時"
            case .minutes(let m): return "\(m) 分鐘"
            case .endOfTrack: return "內容結束時停止"
            }
        }
    }
    
    override init() {
        super.init()
        _ = RingtoneLibraryManager.shared
    }
    
    var remainingTimerFormatted: String {
        guard activeTimerOption != .off else { return "" }
        if case .endOfTrack = activeTimerOption {
            return "本輪結束"
        }
        let m = remainingTimerSeconds / 60
        let s = remainingTimerSeconds % 60
        return String(format: "%02d:%02d", m, s)
    }
    
    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("音訊 Session 啟用失敗: \(error.localizedDescription)")
        }
    }
    
    /// 切換播放/暫停助眠音效
    func toggleSound(_ type: SoundType) {
        if isPlaying && currentSound == type {
            togglePlayPause()
        } else if !isPlaying && currentSound == type {
            togglePlayPause()
        } else {
            play(type)
        }
    }
    
    func play(_ type: SoundType) {
        stopRingtonePreview()
        // 若切換不同聲音，重置播放器
        if let player = soundPlayer {
            player.stop()
        }
        soundPlayer = nil
        setupAudioSession()
        
        currentSound = type
        isPlaying = true
        
        // 取得快取或即時合成聲景 WAV 音訊
        let data: Data
        if let cached = audioDataCache[type] {
            data = cached
        } else {
            data = SoundGenerator.createWavData(for: type)
            audioDataCache[type] = data
        }
        
        do {
            let player = try AVAudioPlayer(data: data)
            player.delegate = self
            if case .endOfTrack = activeTimerOption {
                player.numberOfLoops = 0
            } else {
                player.numberOfLoops = -1 // 無限平滑循環播放
            }
            player.volume = volume
            player.prepareToPlay()
            player.play()
            self.soundPlayer = player
            
            // 若原本已設定分鐘計時器，繼續倒數
            if case .minutes = activeTimerOption, remainingTimerSeconds > 0 {
                if timerTargetDate == nil {
                    timerTargetDate = Date().addingTimeInterval(TimeInterval(remainingTimerSeconds))
                }
                startCountdownTimer()
            }
        } catch {
            print("助眠音效播放失敗: \(error.localizedDescription)")
            self.isPlaying = false
            self.currentSound = nil
        }
    }
    
    /// 播放 / 暫停切換
    func togglePlayPause() {
        guard currentSound != nil else { return }
        if isPlaying {
            soundPlayer?.pause()
            isPlaying = false
            countdownTimer?.invalidate()
            timerTargetDate = nil
        } else {
            soundPlayer?.play()
            isPlaying = true
            if case .minutes = activeTimerOption, remainingTimerSeconds > 0 {
                timerTargetDate = Date().addingTimeInterval(TimeInterval(remainingTimerSeconds))
                startCountdownTimer()
            }
        }
    }
    
    /// 上一首
    func playPrevious() {
        guard let current = currentSound,
              let index = SoundType.allCases.firstIndex(of: current) else {
            if let first = SoundType.allCases.first { play(first) }
            return
        }
        let prevIndex = (index - 1 + SoundType.allCases.count) % SoundType.allCases.count
        play(SoundType.allCases[prevIndex])
    }
    
    /// 下一首
    func playNext() {
        guard let current = currentSound,
              let index = SoundType.allCases.firstIndex(of: current) else {
            if let first = SoundType.allCases.first { play(first) }
            return
        }
        let nextIndex = (index + 1) % SoundType.allCases.count
        play(SoundType.allCases[nextIndex])
    }
    
    /// 完全停止播放並隱藏迷你播放器
    func stop() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        timerTargetDate = nil
        activeTimerOption = .off
        remainingTimerSeconds = 0
        
        if let player = soundPlayer {
            player.stop()
        }
        soundPlayer = nil
        isPlaying = false
        currentSound = nil
    }
    
    /// 設定睡眠定時器
    func setSleepTimer(_ option: SleepTimerOption) {
        activeTimerOption = option
        countdownTimer?.invalidate()
        countdownTimer = nil
        timerTargetDate = nil
        
        switch option {
        case .off:
            remainingTimerSeconds = 0
            soundPlayer?.numberOfLoops = -1
        case .minutes(let minutes):
            remainingTimerSeconds = minutes * 60
            timerTargetDate = Date().addingTimeInterval(TimeInterval(minutes * 60))
            soundPlayer?.numberOfLoops = -1
            if isPlaying {
                startCountdownTimer()
            }
        case .endOfTrack:
            remainingTimerSeconds = 0
            soundPlayer?.numberOfLoops = 0 // 播放完本輪就停止
        }
    }
    
    private func startCountdownTimer() {
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                if let target = self.timerTargetDate {
                    let diff = Int(target.timeIntervalSinceNow)
                    if diff > 0 {
                        self.remainingTimerSeconds = diff
                    } else {
                        self.remainingTimerSeconds = 0
                        self.stop()
                    }
                } else if self.remainingTimerSeconds > 0 {
                    self.remainingTimerSeconds -= 1
                } else {
                    self.stop()
                }
            }
        }
    }
    
    // MARK: - AVAudioPlayerDelegate
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if player === self.alarmPlayer {
                self.previewingRingtoneID = nil
            } else {
                self.stop()
            }
        }
    }
    
    // MARK: - 喚醒鬧鈴播放、重複循環與 15 秒漸進喚醒 (Fade-in)
    
    /// 在「設定鬧鈴」面板中試聽指定鈴聲（支援無限重複播放與漸進喚醒預覽，不觸發全螢幕響鈴視窗）
    func toggleRingtonePreview(id: String, fileName: String, gentleFadeIn: Bool) {
        if previewingRingtoneID == id {
            stopRingtonePreview()
        } else {
            stop()
            stopRingtonePreview()
            previewingRingtoneID = id
            playAlarmAudioFile(fileName: fileName, loop: true, gentleFadeIn: gentleFadeIn)
        }
    }
    
    /// 停止鈴聲試聽
    func stopRingtonePreview() {
        guard previewingRingtoneID != nil else { return }
        previewingRingtoneID = nil
        fadeInTimer?.invalidate()
        fadeInTimer = nil
        alarmPlayer?.stop()
        alarmPlayer = nil
    }
    
    /// 開始播放晨間鬧鐘響鈴（觸發全螢幕響鈴視窗並無限重複播放）
    func startAlarmMelody(
        fileName: String? = nil,
        loop: Bool = true,
        gentleFadeIn: Bool? = nil
    ) {
        stop()
        stopRingtonePreview()
        isShowingWakeUpPrompt = false
        isAlarmRinging = true
        
        let currentSetting = Self.loadStoredAlarmSetting()
        let targetFileName = fileName ?? currentSetting.selectedSoundFileName
        let useFadeIn = gentleFadeIn ?? currentSetting.isGentleFadeInEnabled
        
        playAlarmAudioFile(fileName: targetFileName, loop: loop, gentleFadeIn: useFadeIn)
    }
    
    /// 僅停止鬧鐘鈴聲音訊（保留全螢幕視窗以顯示「起床打卡 / 略過」畫面）
    func stopAlarmAudioOnly() {
        previewingRingtoneID = nil
        fadeInTimer?.invalidate()
        fadeInTimer = nil
        alarmPlayer?.stop()
        alarmPlayer = nil
    }
    
    /// 「滑動來停止」後切換至晨間喚醒打卡提示畫面（含【起床打卡】與【略過】）
    func transitionToWakeUpPrompt() {
        stopAlarmAudioOnly()
        isShowingWakeUpPrompt = true
        if !isAlarmRinging {
            isAlarmRinging = true
        }
    }
    
    /// 完全停止鬧鐘響鈴並關閉全螢幕視窗
    func stopAlarmMelody() {
        stopAlarmAudioOnly()
        isShowingWakeUpPrompt = false
        isAlarmRinging = false
    }
    
    private func playAlarmAudioFile(fileName: String, loop: Bool, gentleFadeIn: Bool) {
        RingtoneLibraryManager.synthesizeBuiltInRingtonesIfNeeded()
        
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            print("鬧鐘 Session 啟用失敗: \(error.localizedDescription)")
        }
        
        guard let soundURL = RingtoneLibraryManager.resolveSoundURL(fileName: fileName) else {
            return
        }
        
        do {
            let player = try AVAudioPlayer(contentsOf: soundURL)
            player.delegate = self
            player.numberOfLoops = loop ? -1 : 0 // -1 代表無限平滑重複播放
            player.volume = gentleFadeIn ? 0.08 : 1.0
            player.prepareToPlay()
            player.play()
            self.alarmPlayer = player
            
            fadeInTimer?.invalidate()
            if gentleFadeIn {
                // 15 秒漸進式溫和喚醒：每 0.25 秒遞增一次（共 60 步，從 8% 平滑爬升至 100%）
                let stepIncrement: Float = (1.0 - 0.08) / 60.0
                fadeInTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                    Task { @MainActor [weak self] in
                        guard let self = self, let activePlayer = self.alarmPlayer, activePlayer.isPlaying else {
                            self?.fadeInTimer?.invalidate()
                            self?.fadeInTimer = nil
                            return
                        }
                        let nextVol = min(1.0, activePlayer.volume + stepIncrement)
                        activePlayer.volume = nextVol
                        if nextVol >= 1.0 {
                            self.fadeInTimer?.invalidate()
                            self.fadeInTimer = nil
                        }
                    }
                }
            }
        } catch {
            print("鬧鐘播放器建立失敗: \(error.localizedDescription)")
        }
    }
    
    private static func loadStoredAlarmSetting() -> AlarmSetting {
        if let data = UserDefaults.standard.data(forKey: "goodsleep.alarm.v1"),
           let setting = try? JSONDecoder().decode(AlarmSetting.self, from: data) {
            return setting
        }
        return .default
    }
}

// MARK: - 高品質立體聲助眠聲景生成器 (純 Swift 記憶體合成標準 16-bit PCM WAV)
private enum SoundGenerator {
    static func createWavData(for type: SoundManager.SoundType) -> Data {
        let sampleRate: Double = 22050.0
        let duration: Double = 60.0 // 擴展為 60 秒完整長度立體聲聲景
        let totalSamples = Int(sampleRate * duration)
        
        var left = [Float](repeating: 0.0, count: totalSamples)
        var right = [Float](repeating: 0.0, count: totalSamples)
        
        switch type {
        case .rain:
            generateRain(left: &left, right: &right, total: totalSamples, sampleRate: sampleRate)
        case .ocean:
            generateOcean(left: &left, right: &right, total: totalSamples, sampleRate: sampleRate)
        case .wind:
            generateWind(left: &left, right: &right, total: totalSamples, sampleRate: sampleRate)
        case .whiteNoise:
            generateWhiteNoise(left: &left, right: &right, total: totalSamples, sampleRate: sampleRate)
        }
        
        // 頭尾平滑餘弦交叉淡入淡出 (Crossfade 2.0 秒)，徹底消除循環邊界爆音與重複感
        let fadeSamples = Int(sampleRate * 2.0)
        for i in 0..<fadeSamples {
            let t = Float(i) / Float(fadeSamples)
            let fadeOut = 0.5 * (1.0 + cos(Float.pi * t))
            let fadeIn = 1.0 - fadeOut
            
            let tailIdx = totalSamples - fadeSamples + i
            let mergedL = left[tailIdx] * fadeOut + left[i] * fadeIn
            let mergedR = right[tailIdx] * fadeOut + right[i] * fadeIn
            
            left[i] = mergedL
            left[tailIdx] = mergedL
            right[i] = mergedR
            right[tailIdx] = mergedR
        }
        
        return encodeWav(left: left, right: right, sampleRate: Int(sampleRate))
    }
    
    // 雨夜窗台：粉紅噪音基底 + 隨機雨滴輕擊 + 緩慢雨勢變化
    private static func generateRain(left: inout [Float], right: inout [Float], total: Int, sampleRate: Double) {
        var lastL: Float = 0.0
        var lastR: Float = 0.0
        let swellPeriod = sampleRate * 28.0
        
        for i in 0..<total {
            let whiteL = Float.random(in: -1.0...1.0)
            let whiteR = Float.random(in: -1.0...1.0)
            lastL = (lastL * 0.86) + (whiteL * 0.14)
            lastR = (lastR * 0.86) + (whiteR * 0.14)
            
            // 雨勢微動態起伏
            let intensity = Float(0.75 + 0.25 * sin(Double(i) / swellPeriod * 2.0 * .pi))
            
            var dropL: Float = 0.0
            var dropR: Float = 0.0
            if Int.random(in: 0...90) == 0 {
                let dropVal = Float.random(in: -0.16...0.16)
                dropL = dropVal
                dropR = dropVal * Float.random(in: 0.6...1.2)
            }
            
            left[i] = ((lastL * 0.65) * intensity + dropL) * 0.72
            right[i] = ((lastR * 0.65) * intensity + dropR) * 0.72
        }
    }
    
    // 寧靜潮汐：深層褐噪 + 多重諧波潮湧起伏 (自然大浪與碎波)
    private static func generateOcean(left: inout [Float], right: inout [Float], total: Int, sampleRate: Double) {
        var brownL: Float = 0.0
        var brownR: Float = 0.0
        let period1 = sampleRate * 9.5   // 主要潮浪週期 ~9.5秒
        let period2 = sampleRate * 14.8  // 次要深層暗湧 ~14.8秒
        let period3 = sampleRate * 24.0  // 長週期潮汐呼吸 ~24秒
        
        for i in 0..<total {
            let whiteL = Float.random(in: -1.0...1.0)
            let whiteR = Float.random(in: -1.0...1.0)
            brownL = (brownL + (0.045 * whiteL)) / 1.045
            brownR = (brownR + (0.045 * whiteR)) / 1.045
            
            let phase1 = Double(i) / period1 * 2.0 * .pi
            let phase2 = Double(i) / period2 * 2.0 * .pi
            let phase3 = Double(i) / period3 * 2.0 * .pi
            
            let wave1 = pow(sin(phase1), 2.0)
            let wave2 = 0.5 * (1.0 + sin(phase2))
            let wave3 = 0.5 * (1.0 + sin(phase3))
            
            let surge = Float(0.25 + 0.45 * wave1 + 0.20 * wave2 + 0.10 * wave3)
            
            left[i] = brownL * surge * 1.6
            right[i] = brownR * surge * (0.92 + 0.08 * Float(wave2)) * 1.6
        }
    }
    
    // 深山晚風：低頻雙重濾波 + 緩慢多層次山谷微風起伏
    private static func generateWind(left: inout [Float], right: inout [Float], total: Int, sampleRate: Double) {
        var lowL: Float = 0.0
        var lowR: Float = 0.0
        let period1 = sampleRate * 12.0
        let period2 = sampleRate * 21.0
        let period3 = sampleRate * 37.0
        
        for i in 0..<total {
            let whiteL = Float.random(in: -1.0...1.0)
            let whiteR = Float.random(in: -1.0...1.0)
            lowL = (lowL * 0.94) + (whiteL * 0.06)
            lowR = (lowR * 0.94) + (whiteR * 0.06)
            
            let gust1 = 0.5 + 0.5 * sin(Double(i) / period1 * 2.0 * .pi)
            let gust2 = 0.5 + 0.5 * sin(Double(i) / period2 * 2.0 * .pi)
            let gust3 = 0.5 + 0.5 * sin(Double(i) / period3 * 2.0 * .pi)
            
            let totalGust = Float(0.35 + 0.35 * gust1 + 0.20 * gust2 + 0.10 * gust3)
            left[i] = lowL * totalGust * 2.3
            right[i] = lowR * (0.8 + 0.2 * totalGust) * 2.3
        }
    }
    
    // 溫柔白噪：柔和全頻深層遮蔽聲，去除刺耳高頻，平穩持久
    private static func generateWhiteNoise(left: inout [Float], right: inout [Float], total: Int, sampleRate: Double) {
        var smoothL: Float = 0.0
        var smoothR: Float = 0.0
        let driftPeriod = sampleRate * 30.0
        
        for i in 0..<total {
            let whiteL = Float.random(in: -1.0...1.0)
            let whiteR = Float.random(in: -1.0...1.0)
            smoothL = (smoothL * 0.75) + (whiteL * 0.25)
            smoothR = (smoothR * 0.75) + (whiteR * 0.25)
            
            // 輕微立體聲呼吸漂移，防止聽覺麻木疲乏
            let panDrift = Float(0.95 + 0.05 * sin(Double(i) / driftPeriod * 2.0 * .pi))
            left[i] = smoothL * 0.35 * panDrift
            right[i] = smoothR * 0.35 * (2.0 - panDrift)
        }
    }
    
    // 將 Float PCM 樣本編碼為標準 44-byte RIFF/WAVE 二進位資料
    private static func encodeWav(left: [Float], right: [Float], sampleRate: Int) -> Data {
        let numChannels = 2
        let bitsPerSample = 16
        let totalSamples = left.count
        let subchunk2Size = totalSamples * numChannels * 2
        let chunkSize = 36 + subchunk2Size
        let byteRate = sampleRate * numChannels * (bitsPerSample / 8)
        let blockAlign = numChannels * (bitsPerSample / 8)
        
        var data = Data()
        data.reserveCapacity(44 + subchunk2Size)
        
        // "RIFF"
        data.append(contentsOf: [0x52, 0x49, 0x46, 0x46])
        data.append(contentsOf: withUnsafeBytes(of: UInt32(chunkSize).littleEndian) { Array($0) })
        // "WAVE"
        data.append(contentsOf: [0x57, 0x41, 0x56, 0x45])
        
        // "fmt "
        data.append(contentsOf: [0x66, 0x6D, 0x74, 0x20])
        data.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: UInt16(numChannels).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: UInt32(byteRate).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: UInt16(blockAlign).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: UInt16(bitsPerSample).littleEndian) { Array($0) })
        
        // "data"
        data.append(contentsOf: [0x64, 0x61, 0x74, 0x61])
        data.append(contentsOf: withUnsafeBytes(of: UInt32(subchunk2Size).littleEndian) { Array($0) })
        
        for i in 0..<totalSamples {
            let leftClamped = max(-1.0, min(1.0, left[i]))
            let rightClamped = max(-1.0, min(1.0, right[i]))
            let leftInt = Int16(leftClamped * 32767.0)
            let rightInt = Int16(rightClamped * 32767.0)
            data.append(contentsOf: withUnsafeBytes(of: leftInt.littleEndian) { Array($0) })
            data.append(contentsOf: withUnsafeBytes(of: rightInt.littleEndian) { Array($0) })
        }
        
        return data
    }
}
