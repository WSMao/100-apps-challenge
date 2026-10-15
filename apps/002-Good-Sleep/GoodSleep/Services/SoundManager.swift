import Foundation
import AVFoundation

/// 助眠微音效與環境聲景管理器
@MainActor
final class SoundManager: ObservableObject {
    static let shared = SoundManager()
    
    @Published var isPlaying: Bool = false
    @Published var currentSound: SoundType? = nil
    @Published var volume: Float = 0.6
    @Published var isAlarmRinging: Bool = false
    
    private var audioEngine: AVAudioEngine?
    private var noiseNode: AVAudioSourceNode?
    private var alarmPlayer: AVAudioPlayer?
    
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
    
    init() {
        // 延遲至真正播放音效時才在背景啟用 Session，避免主線程 UI 凍結警告 (Hang Risk)
    }
    
    private func activateAudioSession() {
        Task.detached(priority: .userInitiated) {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
            } catch {
                print("音訊 Session 啟用失敗: \(error.localizedDescription)")
            }
        }
    }
    
    /// 切換播放/暫停助眠音效 (基於 CoreAudio 合成粉紅噪音/低頻濾波)
    func toggleSound(_ type: SoundType) {
        if isPlaying && currentSound == type {
            stop()
        } else {
            play(type)
        }
    }
    
    func play(_ type: SoundType) {
        stop()
        currentSound = type
        isPlaying = true
        activateAudioSession()
        
        // 透過 AVAudioEngine 即時合成音訊，無需依賴龐大 mp3 外部資源
        startNoiseEngine(type: type)
    }
    
    func stop() {
        if let engine = audioEngine, engine.isRunning {
            engine.stop()
            engine.reset()
        }
        audioEngine = nil
        noiseNode = nil
        isPlaying = false
        currentSound = nil
        
        Task.detached(priority: .background) {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            } catch {
                print("音訊 Session 釋放失敗: \(error.localizedDescription)")
            }
        }
    }
    
    /// 開始播放晨間鬧鐘響鈴 (預設循環響鈴直到使用者關閉或貪睡)
    func startAlarmMelody(loop: Bool = true) {
        stop() // 停止白噪音
        isAlarmRinging = true
        
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            print("鬧鐘 Session 啟用失敗: \(error.localizedDescription)")
        }
        
        let url = Bundle.main.url(forResource: "alarm_melody", withExtension: "caf") ??
                  Bundle.main.url(forResource: "alarm_melody", withExtension: "wav")
        
        if let soundURL = url {
            do {
                alarmPlayer = try AVAudioPlayer(contentsOf: soundURL)
                alarmPlayer?.numberOfLoops = loop ? -1 : 0
                alarmPlayer?.volume = 1.0
                alarmPlayer?.prepareToPlay()
                alarmPlayer?.play()
            } catch {
                print("鬧鐘播放器建立失敗: \(error.localizedDescription)")
            }
        }
    }
    
    /// 停止鬧鐘響鈴
    func stopAlarmMelody() {
        isAlarmRinging = false
        alarmPlayer?.stop()
        alarmPlayer = nil
    }
    
    private func startNoiseEngine(type: SoundType) {
        let engine = AVAudioEngine()
        let sampleRate = 44100.0
        
        // 依據不同類型調整低頻係數
        let factor: Float
        switch type {
        case .rain: factor = 0.08
        case .ocean: factor = 0.05
        case .wind: factor = 0.03
        case .whiteNoise: factor = 0.12
        }
        
        var lastOut: Float = 0.0
        
        let sourceNode = AVAudioSourceNode { _, _, frameCount, audioBufferList -> OSStatus in
            let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
            for frame in 0..<Int(frameCount) {
                // 產生平滑低通白/粉紅噪音
                let white = Float.random(in: -1.0...1.0)
                lastOut = (lastOut + (0.02 * white)) / 1.02
                let sample = (lastOut * factor) * self.volume
                
                for buffer in ablPointer {
                    let buf: UnsafeMutableBufferPointer<Float> = UnsafeMutableBufferPointer(buffer)
                    buf[frame] = sample
                }
            }
            return noErr
        }
        
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
        engine.attach(sourceNode)
        engine.connect(sourceNode, to: engine.mainMixerNode, format: format)
        
        do {
            try engine.start()
            self.audioEngine = engine
            self.noiseNode = sourceNode
        } catch {
            print("音訊引擎啟動失敗: \(error.localizedDescription)")
            self.isPlaying = false
        }
    }
}

