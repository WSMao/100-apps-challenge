import Carbon
import Foundation

@MainActor
final class GlobalHotKeyManager {
    private let onTrigger: () -> Void
    private var eventHandler: EventHandlerRef?
    private var hotKey: EventHotKeyRef?
    private var registeredConfiguration: HotKeyConfiguration?

    init(onTrigger: @escaping () -> Void) throws {
        self.onTrigger = onTrigger
        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: OSType(kEventHotKeyPressed)
        )
        let context = Unmanaged.passUnretained(self).toOpaque()
        let installStatus = InstallEventHandler(
            GetApplicationEventTarget(),
            { _, _, userData in
                guard let userData else { return noErr }
                let manager = Unmanaged<GlobalHotKeyManager>.fromOpaque(userData).takeUnretainedValue()
                DispatchQueue.main.async {
                    manager.onTrigger()
                }
                return noErr
            },
            1,
            &eventType,
            context,
            &eventHandler
        )
        guard installStatus == noErr else {
            throw GlobalHotKeyError.registrationFailed(installStatus)
        }
    }

    func register(_ configuration: HotKeyConfiguration) throws {
        if registeredConfiguration == configuration {
            return
        }
        let identifier = EventHotKeyID(signature: OSType(0x44434854), id: 1)
        var newHotKey: EventHotKeyRef?
        let status = RegisterEventHotKey(
            UInt32(configuration.keyCode),
            configuration.modifiers,
            identifier,
            GetApplicationEventTarget(),
            0,
            &newHotKey
        )
        guard status == noErr else {
            throw GlobalHotKeyError.registrationFailed(status)
        }
        unregister()
        hotKey = newHotKey
        registeredConfiguration = configuration
    }

    func unregister() {
        if let hotKey {
            UnregisterEventHotKey(hotKey)
            self.hotKey = nil
        }
        registeredConfiguration = nil
    }

    deinit {
        if let hotKey {
            UnregisterEventHotKey(hotKey)
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
        }
    }
}

enum GlobalHotKeyError: LocalizedError {
    case registrationFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .registrationFailed(let status):
            "無法註冊全域快捷鍵（系統錯誤碼 \(status)）。請選擇其他組合鍵後重試。"
        }
    }
}
