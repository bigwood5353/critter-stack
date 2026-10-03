import ExpoModulesCore
import UIKit
import AVFoundation

/// The Expo module the app's JavaScript talks to. It hands everything to GameBridge on the main thread.
///   JS → native: start(), pageReady(), appState(state), handle(name, type, json)
///   native → JS: the "critterCall" event {fn, args}; the app runs window.<fn>(args) in the game page.
public class CritterNativeModule: Module {
    @MainActor private var bridge: GameBridge?

    public func definition() -> ModuleDefinition {
        Name("CritterNative")
        Events("critterCall")

        Function("start") {
            Task { @MainActor [weak self] in self?.withBridge { $0.start() } }
        }
        Function("pageReady") {
            Task { @MainActor [weak self] in self?.withBridge { $0.pageReady() } }
        }
        Function("appState") { (state: String) in
            Task { @MainActor [weak self] in self?.withBridge { $0.appState(state) } }
        }
        Function("handle") { (name: String, type: String, json: String) in
            Task { @MainActor [weak self] in self?.withBridge { $0.handle(name: name, type: type, json: json) } }
        }
    }

    @MainActor private func withBridge(_ body: (GameBridge) -> Void) {
        if bridge == nil { bridge = GameBridge(module: self) }
        if let bridge { body(bridge) }
    }

    /// Sends window.<fn>(args) to the page (through the app's JavaScript).
    func sendCall(_ fn: String, _ argsJSON: String) {
        sendEvent("critterCall", ["fn": fn, "args": argsJSON])
    }

    @MainActor var currentViewController: UIViewController? {
        if let vc = appContext?.utilities?.currentViewController() { return vc }
        let root = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first?.rootViewController
        var top = root
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

/// Routes messages from the game page to the native services and calls back into the page.
/// Same job as the plain-Swift shell's GameBridge, so the services (Game Center, App Store, iCloud, ads…) are unchanged.
///
/// Page → app:  {name, msg:{type, ...}} where name is gameCenter, store, ads, haptics, notify, cloud or share
/// App → page:  critterPurchased(id), critterRestored([ids]), critterPrices({id: price}), critterPurchaseFailed(msg),
///              critterBoardLoaded({...}), critterFinalRank({...}), critterNotifyResult(bool),
///              critterCloudBackup(json, force), critterCloudSaved(at), critterCloudDeleted(),
///              critterAdDone(), critterAdsReady(bool), critterRewarded(kind), critterRewardFailed(msg),
///              critterAppState("interrupted")
@MainActor
final class GameBridge {
    private weak var module: CritterNativeModule?
    private var started = false

    lazy var gameCenter = GameCenterService(bridge: self)
    lazy var store = StoreService(bridge: self)
    lazy var ads = AdsService(bridge: self)
    let haptics = HapticsService()
    lazy var notifications = NotificationService(bridge: self)
    let widget = WidgetService()
    lazy var cloud = CloudService(bridge: self)

    init(module: CritterNativeModule) { self.module = module }

    func start() {
        guard !started else { return }
        started = true
        // .ambient: sounds respect the silent switch and mix with the player's own music or podcasts
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        gameCenter.authenticate()
        store.start()
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
            Task { @MainActor in self?.call("critterAppState", "interrupted") }   // phone call, Siri, alarm: pause the game
        }
    }

    func pageReady() {
        start()
        store.sendPrices()
        cloud.start()          // offers an iCloud backup to the page (fresh installs restore automatically)
        ads.start()            // consent → tracking prompt → AdMob; tells the page when a rewarded ad is ready
    }

    func appState(_ state: String) {
        if state == "active" { gameCenter.flushPending() }   // retry scores saved while offline
    }

    func handle(name: String, type: String, json: String) {
        guard let data = json.data(using: .utf8),
              let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        switch name {
        case "gameCenter": gameCenter.handle(type: type, body: body)
        case "store":      store.handle(type: type, body: body)
        case "ads":        ads.handle(type: type, body: body)
        case "haptics":    haptics.handle(type: type, body: body)
        case "notify":     notifications.handle(type: type, body: body)
        case "widget":     widget.handle(type: type, body: body)
        case "cloud":      cloud.handle(type: type, body: body)
        case "share":      shareImage(body)
        default: break
        }
    }

    /// Calls window.<fn>(<json args>) in the page.
    func call(_ fn: String, _ args: Any...) {
        let json = args.map { arg -> String in
            if let data = try? JSONSerialization.data(withJSONObject: arg, options: [.fragmentsAllowed]),
               let s = String(data: data, encoding: .utf8) { return s }
            return "null"
        }.joined(separator: ",")
        module?.sendCall(fn, json)
    }

    var rootViewController: UIViewController? { module?.currentViewController }

    /// "Share my rank": the page sends a PNG as a data URL; show the iOS share sheet (Messages, Instagram, Save Image…).
    private func shareImage(_ body: [String: Any]) {
        guard let dataURL = body["dataURL"] as? String, let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let image = UIImage(data: data), let root = rootViewController else { return }
        var items: [Any] = [image]
        if let text = body["text"] as? String { items.append(text) }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {           // iPad: anchor the popover mid-screen
            pop.sourceView = root.view
            pop.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        root.present(sheet, animated: true)
    }
}
