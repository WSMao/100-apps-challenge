import Foundation
import AVFoundation

/// 喚醒鬧鈴音訊庫與自訂音樂匯入轉檔管理器
/// - 自動管理 `<App Container>/Library/Sounds/` 目錄（支援 iOS 26+ AlarmKit、UNNotificationSound 與 AVAudioPlayer 共用）
/// - 內建 4 款純 Swift DSP 合成之無縫循環 `.caf` 舒緩鈴聲
/// - 支援使用者從「檔案 (Files) / iCloud Drive」匯入 `.mp3`、`.m4a`、`.wav`、`.caf`、`.aiff`、`.flac`，自動裁切（≤ 28 秒）、加淡入淡出並轉檔為 `.caf`
@MainActor
final class RingtoneLibraryManager: ObservableObject {
    static let shared = RingtoneLibraryManager()
    
    @Published private(set) var customRingtones: [CustomRingtoneItem] = []
    @Published private(set) var isImporting: Bool = false
    
    private let customRingtonesKey = "goodsleep.customRingtones.v1"
    
    enum ImportError: LocalizedError {
        case accessDenied
        case invalidAudioFormat
        case emptyAudioTrack
        case exportFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .accessDenied:
                return "無法讀取所選取的音樂檔案權限，請確認檔案已下載至本機。"
            case .invalidAudioFormat:
                return "不支援此音訊格式或檔案已損毀，建議選擇 MP3、M4A、WAV 或 CAF 格式。"
            case .emptyAudioTrack:
                return "此音訊檔案長度為 0 秒，無法作為鬧鈴使用。"
            case .exportFailed(let reason):
                return "轉檔為系統鬧鈴格式失敗：\(reason)"
            }
        }
    }
    
    private init() {
        loadCustomRingtones()
        ensureSoundsDirectoryExists()
        Task.detached(priority: .utility) {
            Self.synthesizeBuiltInRingtonesIfNeeded()
        }
    }
    
    // MARK: - Library/Sounds 目錄管理
    
    /// 取得 `<App Container>/Library/Sounds` 目錄 URL（iOS AlarmKit 與 UNNotificationSound 系統級搜尋路徑）
    nonisolated static var librarySoundsDirectoryURL: URL {
        let libraryURL = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
        return libraryURL.appendingPathComponent("Sounds", isDirectory: true)
    }
    
    /// 根據檔名尋找音訊 URL（優先搜尋 `Library/Sounds/`，其次搜尋 `Bundle.main`）
    nonisolated static func resolveSoundURL(fileName: String) -> URL? {
        let soundsDirURL = librarySoundsDirectoryURL.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: soundsDirURL.path) {
            return soundsDirURL
        }
        
        let nsName = fileName as NSString
        let baseName = nsName.deletingPathExtension
        let ext = nsName.pathExtension.isEmpty ? "caf" : nsName.pathExtension
        if let bundleURL = Bundle.main.url(forResource: baseName, withExtension: ext) {
            return bundleURL
        }
        
        // 最後備援：回傳預設內建鐘琴
        return Bundle.main.url(forResource: "alarm_melody", withExtension: "caf") ??
               Bundle.main.url(forResource: "alarm_melody", withExtension: "wav")
    }
    
    private func ensureSoundsDirectoryExists() {
        let dirURL = Self.librarySoundsDirectoryURL
        if !FileManager.default.fileExists(atPath: dirURL.path) {
            try? FileManager.default.createDirectory(at: dirURL, withIntermediateDirectories: true)
        }
    }
    
    // MARK: - 自訂鈴聲持久化與管理
    
    private func loadCustomRingtones() {
        guard let data = UserDefaults.standard.data(forKey: customRingtonesKey),
              let decoded = try? JSONDecoder().decode([CustomRingtoneItem].self, from: data) else {
            self.customRingtones = []
            return
        }
        // 過濾掉實體檔案已不存在的項目
        let soundsDir = Self.librarySoundsDirectoryURL
        self.customRingtones = decoded.filter { item in
            FileManager.default.fileExists(atPath: soundsDir.appendingPathComponent(item.fileName).path)
        }
    }
    
    private func saveCustomRingtones() {
        if let data = try? JSONEncoder().encode(customRingtones) {
            UserDefaults.standard.set(data, forKey: customRingtonesKey)
        }
    }
    
    /// 從使用者在 `fileImporter` 選取的 URL 匯入音訊，自動裁切（≤ 28 秒）、淡入淡出並轉為 `.caf`
    func importCustomAudio(from sourceURL: URL) async throws -> CustomRingtoneItem {
        isImporting = true
        defer { isImporting = false }
        
        ensureSoundsDirectoryExists()
        
        let item = try await Task.detached(priority: .userInitiated) {
            try Self.convertAndStoreCustomAudio(from: sourceURL)
        }.value
        
        customRingtones.insert(item, at: 0)
        saveCustomRingtones()
        return item
    }
    
    /// 刪除指定的自訂鈴聲
    func deleteCustomRingtone(_ item: CustomRingtoneItem) {
        let fileURL = Self.librarySoundsDirectoryURL.appendingPathComponent(item.fileName)
        try? FileManager.default.removeItem(at: fileURL)
        customRingtones.removeAll { $0.id == item.id }
        saveCustomRingtones()
    }
    
    // MARK: - 音訊轉檔與處理 (MP3 / M4A / WAV / FLAC -> Library/Sounds/*.caf)
    
    nonisolated private static func convertAndStoreCustomAudio(from sourceURL: URL) throws -> CustomRingtoneItem {
        let hasSecurityScope = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if hasSecurityScope {
                sourceURL.stopAccessingSecurityScopedResource()
            }
        }
        
        // 先複製至本機暫存目錄，確保 iCloud Drive / 外部 Provider 檔案讀取穩定
        let tempFileName = "import_temp_\(UUID().uuidString).\(sourceURL.pathExtension.isEmpty ? "m4a" : sourceURL.pathExtension)"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(tempFileName)
        defer {
            try? FileManager.default.removeItem(at: tempURL)
        }
        
        do {
            if FileManager.default.fileExists(atPath: tempURL.path) {
                try FileManager.default.removeItem(at: tempURL)
            }
            try FileManager.default.copyItem(at: sourceURL, to: tempURL)
        } catch {
            throw ImportError.accessDenied
        }
        
        let inputFile: AVAudioFile
        do {
            inputFile = try AVAudioFile(forReading: tempURL)
        } catch {
            throw ImportError.invalidAudioFormat
        }
        
        let processingFormat = inputFile.processingFormat
        let sampleRate = processingFormat.sampleRate
        let channels = processingFormat.channelCount
        let totalInputFrames = Int(inputFile.length)
        
        guard totalInputFrames > 0, sampleRate > 0, channels > 0 else {
            throw ImportError.emptyAudioTrack
        }
        
        // 最長截取 28.0 秒（嚴格小於 iOS 系統通知 30 秒上限，同時確保完整音樂段落）
        let maxDurationSeconds: Double = 28.0
        let framesToRead = min(totalInputFrames, Int(sampleRate * maxDurationSeconds))
        
        guard let readBuffer = AVAudioPCMBuffer(
            pcmFormat: processingFormat,
            frameCapacity: AVAudioFrameCount(framesToRead)
        ) else {
            throw ImportError.invalidAudioFormat
        }
        
        do {
            try inputFile.read(into: readBuffer, frameCount: AVAudioFrameCount(framesToRead))
        } catch {
            throw ImportError.invalidAudioFormat
        }
        
        let actualFrames = Int(readBuffer.frameLength)
        guard actualFrames > 0, let floatChannelData = readBuffer.floatChannelData else {
            throw ImportError.emptyAudioTrack
        }
        
        // 將單聲道或雙聲道樣本取出，並處理頭尾柔和淡入淡出（防止重複循環時產生爆音）
        var monoOrLeft = Array(UnsafeBufferPointer(start: floatChannelData[0], count: actualFrames))
        var rightChannel: [Float]
        if channels >= 2 {
            rightChannel = Array(UnsafeBufferPointer(start: floatChannelData[1], count: actualFrames))
        } else {
            rightChannel = monoOrLeft
        }
        
        // 1. 峰值正規化 (Peak Normalization 至 0.88)，避免匯入音訊過小聲或破音
        var maxPeak: Float = 0.001
        for i in 0..<actualFrames {
            let peak = max(abs(monoOrLeft[i]), abs(rightChannel[i]))
            if peak > maxPeak { maxPeak = peak }
        }
        let gain = min(2.5, 0.88 / maxPeak)
        for i in 0..<actualFrames {
            monoOrLeft[i] *= gain
            rightChannel[i] *= gain
        }
        
        // 2. 前段 0.6 秒平滑淡入 + 尾段 0.4 秒平滑淡出，消除 MP3 邊界靜音與爆音
        let fadeInFrames = min(actualFrames / 4, Int(sampleRate * 0.6))
        let fadeOutFrames = min(actualFrames / 4, Int(sampleRate * 0.4))
        
        for i in 0..<fadeInFrames {
            let t = Float(i) / Float(max(1, fadeInFrames))
            let factor = 0.5 * (1.0 - cos(Float.pi * t))
            monoOrLeft[i] *= factor
            rightChannel[i] *= factor
        }
        for i in 0..<fadeOutFrames {
            let t = Float(i) / Float(max(1, fadeOutFrames))
            let factor = 0.5 * (1.0 + cos(Float.pi * t))
            let idx = actualFrames - fadeOutFrames + i
            monoOrLeft[idx] *= factor
            rightChannel[idx] *= factor
        }
        
        // 3. 若使用者匯入的是短音效（例如 < 12 秒），自動重複拼接至約 20~26 秒，確保在任何通知模式下都能重複播放
        let singleDuration = Double(actualFrames) / sampleRate
        let repeatCount = singleDuration < 12.0 ? max(1, min(6, Int(24.0 / max(1.0, singleDuration)))) : 1
        
        var finalLeft = [Float]()
        var finalRight = [Float]()
        finalLeft.reserveCapacity(actualFrames * repeatCount)
        finalRight.reserveCapacity(actualFrames * repeatCount)
        
        for _ in 0..<repeatCount {
            finalLeft.append(contentsOf: monoOrLeft)
            finalRight.append(contentsOf: rightChannel)
        }
        
        // 4. 寫入標準 Core Audio Format (.caf) 16-bit PCM 檔案至 Library/Sounds/
        let uuidShort = UUID().uuidString.prefix(8)
        let outputFileName = "custom_\(uuidShort).caf"
        let outputURL = librarySoundsDirectoryURL.appendingPathComponent(outputFileName)
        
        try writeCAFFile(
            to: outputURL,
            left: finalLeft,
            right: finalRight,
            sampleRate: sampleRate
        )
        
        let rawTitle = sourceURL.deletingPathExtension().lastPathComponent
        let cleanTitle = rawTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "自訂音樂" : rawTitle
        let finalDuration = Double(finalLeft.count) / sampleRate
        
        return CustomRingtoneItem(
            id: "custom.\(uuidShort)",
            displayName: cleanTitle,
            fileName: outputFileName,
            durationSeconds: finalDuration,
            createdAt: Date()
        )
    }
    
    // MARK: - 內建 4 款舒緩鈴聲 DSP 合成 (自動寫入 Library/Sounds/*.caf)
    
    nonisolated static func synthesizeBuiltInRingtonesIfNeeded() {
        let dirURL = librarySoundsDirectoryURL
        if !FileManager.default.fileExists(atPath: dirURL.path) {
            try? FileManager.default.createDirectory(at: dirURL, withIntermediateDirectories: true)
        }
        
        let sampleRate: Double = 44100.0
        let ringtonesVersionKey = "goodsleep.builtInRingtones.v2"
        let isVersionCurrent = UserDefaults.standard.bool(forKey: ringtonesVersionKey)
        
        for ringtone in BuiltInRingtone.allCases where ringtone != .morningChime {
            let targetURL = dirURL.appendingPathComponent(ringtone.fileName)
            if isVersionCurrent && FileManager.default.fileExists(atPath: targetURL.path) {
                continue
            }
            
            let (left, right) = generateSamples(for: ringtone, sampleRate: sampleRate)
            try? writeCAFFile(to: targetURL, left: left, right: right, sampleRate: sampleRate)
        }
        
        UserDefaults.standard.set(true, forKey: ringtonesVersionKey)
    }
    
    nonisolated private static func generateSamples(
        for ringtone: BuiltInRingtone,
        sampleRate: Double
    ) -> ([Float], [Float]) {
        let duration: Double = 16.0
        let totalSamples = Int(sampleRate * duration)
        var left = [Float](repeating: 0.0, count: totalSamples)
        var right = [Float](repeating: 0.0, count: totalSamples)
        
        switch ringtone {
        case .morningChime:
            break
            
        case .singingBowl:
            // 西藏頌缽泛音：432Hz 基頻 + 泛音共振，每 8 秒一次溫柔敲擊與綿長餘韻
            // 在 16 秒的循環中，敲擊安排在 2.0s 與 10.0s（精準 8.0 秒間隔）
            // 透過疊加前一週期敲擊 (-14.0s, -6.0s) 的持續餘波，讓 t=0.0s 與 t=16.0s 的波形、振幅與諧波相位無縫接軌
            let strikeTimes: [Double] = [-14.0, -6.0, 2.0, 10.0]
            for i in 0..<totalSamples {
                let t = Double(i) / sampleRate
                var sampleL: Double = 0.0
                var sampleR: Double = 0.0
                
                for strike in strikeTimes {
                    let dt = t - strike
                    guard dt >= 0 else { continue }
                    let attack = min(1.0, dt / 0.16)
                    let env1 = attack * exp(-dt * 0.32)
                    let env2 = attack * exp(-dt * 0.55)
                    let env3 = attack * exp(-dt * 0.95)
                    
                    // 頻率經過 8.0 秒整數週期精確微調，確保循環接縫處相位零跳變：
                    // 432.0 Hz * 8.0 = 3456 個整數週期
                    // 432.25 Hz * 8.0 = 3458 個整數週期 (雙耳拍頻 0.25Hz，4秒呼吸感)
                    // 864.0 Hz * 8.0 = 6912 個整數週期 (二倍頻)
                    // 1192.5 Hz * 8.0 = 9540 個整數週期 (泛音)
                    let f1L = sin(2.0 * .pi * 432.0 * dt) * env1 * 0.48
                    let f1R = sin(2.0 * .pi * 432.25 * dt) * env1 * 0.48
                    let f2 = sin(2.0 * .pi * 864.0 * dt) * env2 * 0.22
                    let f3 = sin(2.0 * .pi * 1192.5 * dt) * env3 * 0.10
                    
                    sampleL += f1L + f2 + f3
                    sampleR += f1R + f2 * 0.95 + f3
                }
                left[i] = Float(sampleL * 0.75)
                right[i] = Float(sampleR * 0.75)
            }
            
        case .forestBirds:
            // 森林晨曦鳥鳴：柔和晨間和弦底墊 + 清脆自然的雙音滑音鳥鳴
            let birdEvents: [(start: Double, baseFreq: Double, pan: Double)] = [
                (0.6, 1980, 0.3), (1.0, 2240, 0.35),
                (3.2, 1760, 0.7), (3.55, 2090, 0.65), (3.9, 2350, 0.7),
                (6.5, 2100, 0.4), (6.9, 1850, 0.45),
                (9.2, 2020, 0.6), (9.55, 2420, 0.6),
                (12.2, 1880, 0.35), (12.6, 2180, 0.4), (13.0, 2480, 0.45)
            ]
            for i in 0..<totalSamples {
                let t = Double(i) / sampleRate
                // 溫暖晨光和弦底墊 (C4 + E4 + G4 + B4)
                let padEnv = 0.55 + 0.45 * sin(2.0 * .pi * (t / 8.0))
                let pad = (
                    sin(2.0 * .pi * 261.63 * t) * 0.12 +
                    sin(2.0 * .pi * 329.63 * t) * 0.10 +
                    sin(2.0 * .pi * 392.00 * t) * 0.09 +
                    sin(2.0 * .pi * 493.88 * t) * 0.07
                ) * padEnv
                
                var chirpL: Double = 0.0
                var chirpR: Double = 0.0
                for bird in birdEvents {
                    let dt = t - bird.start
                    if dt >= 0 && dt < 0.26 {
                        let norm = dt / 0.26
                        let env = sin(.pi * norm) * exp(-dt * 4.5)
                        // 鳥鳴頻率微幅上揚滑音
                        let instPhase = 2.0 * .pi * (bird.baseFreq * dt + 260.0 * dt * dt)
                        let sig = sin(instPhase) * env * 0.42
                        chirpL += sig * (1.0 - bird.pan * 0.5)
                        chirpR += sig * (0.5 + bird.pan * 0.5)
                    }
                }
                left[i] = Float(pad + chirpL)
                right[i] = Float(pad + chirpR)
            }
            
        case .warmMarimba:
            // 溫暖木琴琶音：F 大調五聲音階圓潤木質共鳴琶音
            let notes: [Double] = [349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 587.33, 523.25]
            let stepDuration = 0.5 // 每 0.5 秒一顆音符，共 32 拍 (16 秒)
            for i in 0..<totalSamples {
                let t = Double(i) / sampleRate
                var sampleL: Double = 0.0
                var sampleR: Double = 0.0
                
                let currentStep = Int(t / stepDuration)
                for step in max(0, currentStep - 3)...currentStep {
                    let noteStart = Double(step) * stepDuration
                    let dt = t - noteStart
                    guard dt >= 0 && dt < 1.6 else { continue }
                    
                    let freq = notes[step % notes.count]
                    let attack = min(1.0, dt / 0.012)
                    // 木琴音色：基頻溫暖延音 + 4 倍頻木槌敲擊瞬態
                    let fundamental = sin(2.0 * .pi * freq * dt) * exp(-dt * 3.2)
                    let woodHarmonic = sin(2.0 * .pi * (freq * 4.0) * dt) * exp(-dt * 18.0) * 0.28
                    let sig = attack * (fundamental + woodHarmonic) * 0.45
                    
                    let pan = (step % 2 == 0) ? 0.85 : 1.0
                    sampleL += sig * pan
                    sampleR += sig * (1.85 - pan)
                }
                left[i] = Float(sampleL)
                right[i] = Float(sampleR)
            }
            
        case .crystalMusicBox:
            // 星光水晶音樂盒：清澈高頻分解和弦與夢幻泛音餘韻
            let melody: [Double] = [
                783.99, 987.77, 1174.66, 1567.98,
                1479.98, 1174.66, 987.77, 783.99,
                659.25, 783.99, 987.77, 1318.51,
                1174.66, 987.77, 783.99, 587.33
            ]
            let stepDuration = 1.0 // 每秒一顆清脆音符，共 16 秒
            for i in 0..<totalSamples {
                let t = Double(i) / sampleRate
                var sampleL: Double = 0.0
                var sampleR: Double = 0.0
                
                let currentStep = Int(t / stepDuration)
                for step in max(0, currentStep - 3)...currentStep {
                    let noteStart = Double(step) * stepDuration
                    let dt = t - noteStart
                    guard dt >= 0 && dt < 2.8 else { continue }
                    
                    let freq = melody[step % melody.count]
                    let attack = min(1.0, dt / 0.008)
                    let f1 = sin(2.0 * .pi * freq * dt) * exp(-dt * 1.65)
                    let f2 = sin(2.0 * .pi * (freq * 2.0) * dt) * exp(-dt * 3.8) * 0.25
                    let f3 = sin(2.0 * .pi * (freq * 3.0) * dt) * exp(-dt * 7.5) * 0.10
                    let sig = attack * (f1 + f2 + f3) * 0.38
                    
                    sampleL += sig * 0.95
                    sampleR += sig * 0.95
                }
                left[i] = Float(sampleL)
                right[i] = Float(sampleR)
            }
        }
        
        // 頭尾 0.25 秒餘弦交叉淡入淡出 (Crossfade)，確保無限循環播放時 100% 零接縫
        let fadeSamples = Int(sampleRate * 0.25)
        for i in 0..<fadeSamples {
            let ratio = Float(i) / Float(fadeSamples)
            let fadeOut = 0.5 * (1.0 + cos(Float.pi * ratio))
            let fadeIn = 1.0 - fadeOut
            let tailIdx = totalSamples - fadeSamples + i
            
            let mergedL = left[tailIdx] * fadeOut + left[i] * fadeIn
            let mergedR = right[tailIdx] * fadeOut + right[i] * fadeIn
            left[i] = mergedL
            left[tailIdx] = mergedL
            right[i] = mergedR
            right[tailIdx] = mergedR
        }
        
        return (left, right)
    }
    
    // MARK: - Core Audio Format (.caf) 檔案寫入器
    
    nonisolated private static func writeCAFFile(
        to outputURL: URL,
        left: [Float],
        right: [Float],
        sampleRate: Double
    ) throws {
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try? FileManager.default.removeItem(at: outputURL)
        }
        
        let frameCount = min(left.count, right.count)
        guard let processingFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 2,
            interleaved: false
        ),
        let pcmBuffer = AVAudioPCMBuffer(
            pcmFormat: processingFormat,
            frameCapacity: AVAudioFrameCount(frameCount)
        ),
        let channelData = pcmBuffer.floatChannelData else {
            throw ImportError.exportFailed("無法建立 PCM 音訊緩衝區")
        }
        
        pcmBuffer.frameLength = AVAudioFrameCount(frameCount)
        let leftPtr = channelData[0]
        let rightPtr = channelData[1]
        
        for i in 0..<frameCount {
            leftPtr[i] = max(-1.0, min(1.0, left[i]))
            rightPtr[i] = max(-1.0, min(1.0, right[i]))
        }
        
        let cafSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 2,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false
        ]
        
        do {
            let outputFile = try AVAudioFile(
                forWriting: outputURL,
                settings: cafSettings,
                commonFormat: .pcmFormatFloat32,
                interleaved: false
            )
            try outputFile.write(from: pcmBuffer)
        } catch {
            throw ImportError.exportFailed(error.localizedDescription)
        }
    }
}
