import UIKit
import UserNotifications
import WidgetKit

// MARK: - Haptics

/// Real Taptic Engine feedback. The page sends {type:'impact', style:'light'|'medium'|'heavy'}
/// or {type:'notification', style:'success'|'warning'|'error'}.
@MainActor
final class HapticsService {
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let note = UINotificationFeedbackGenerator()

    func handle(type: String, body: [String: Any]) {
        let style = body["style"] as? String ?? "light"
        switch type {
        case "impact":
            switch style {
            case "heavy": heavy.impactOccurred()
            case "medium": medium.impactOccurred()
            default: light.impactOccurred()
            }
        case "notification":
            note.notificationOccurred(style == "warning" ? .warning : style == "error" ? .error : .success)
        default: break
        }
    }
}

// MARK: - Daily reminder notifications

/// The page asks for permission only after the player opts in on the Daily stack end screen,
/// then sends the next 7 reminders itself (skipping today once the stack is played).
@MainActor
final class NotificationService {
    private unowned let bridge: GameBridge
    private let center = UNUserNotificationCenter.current()

    init(bridge: GameBridge) { self.bridge = bridge }

    func handle(type: String, body: [String: Any]) {
        switch type {
        case "requestPermission":
            center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                Task { @MainActor in self.bridge.call("critterNotifyResult", granted) }
            }
        case "schedule":
            let items = body["items"] as? [[String: Any]] ?? []
            center.removeAllPendingNotificationRequests()
            for item in items {
                guard let id = item["id"] as? String, let at = item["at"] as? Double else { continue }
                let content = UNMutableNotificationContent()
                content.title = item["title"] as? String ?? "Critter Stack"
                content.body = item["body"] as? String ?? "Today's stack is ready!"
                content.sound = .default
                let date = Date(timeIntervalSince1970: at / 1000)
                let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            }
        case "cancelAll":
            center.removeAllPendingNotificationRequests()
        default: break
        }
    }
}

// MARK: - Home-screen widget data

/// Writes the page's summary into the shared App Group so the widget can show it, then refreshes the widget.
@MainActor
final class WidgetService {
    static let appGroup = "group.com.critterstack.shared"     // must match the App Group capability on both targets
    static let key = "widgetState"

    func handle(type: String, body: [String: Any]) {
        guard type == "update",
              let data = try? JSONSerialization.data(withJSONObject: body),
              let defaults = UserDefaults(suiteName: Self.appGroup) else { return }
        defaults.set(data, forKey: Self.key)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

// MARK: - Ads

// See AdsService.swift (Google AdMob: interstitial between games, rewarded ads for lives, skips and undos).

// MARK: - iCloud backup

/// Keeps one snapshot of the player's progress in iCloud key-value storage, so it survives a new phone or a reinstall.
/// Needs the iCloud capability with "Key-value storage" ticked. Works quietly when the player isn't signed in to iCloud.
/// The page decides what to do with a backup: restore a fresh install automatically, or ask when another device has more.
@MainActor
final class CloudService {
    private unowned let bridge: GameBridge
    private let kvs = NSUbiquitousKeyValueStore.default
    private var started = false
    private static let backupKey = "critterBackup"
    private static let atKey = "critterBackupAt"

    init(bridge: GameBridge) { self.bridge = bridge }

    func start() {
        if !started {
            started = true
            // another device saved a newer backup while this app is running
            NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                                   object: kvs, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.offer(force: false) }
            }
            kvs.synchronize()
        }
        offer(force: false)
    }

    func handle(type: String, body: [String: Any]) {
        switch type {
        case "save":
            guard let json = body["json"] as? String else { return }
            // iCloud key-value storage allows 1 MB in total; a Critter Stack snapshot is normally well under 100 KB
            guard json.utf8.count < 900_000 else { return }
            let at = (body["at"] as? Double) ?? Date().timeIntervalSince1970 * 1000
            kvs.set(json, forKey: Self.backupKey)
            kvs.set(at, forKey: Self.atKey)
            kvs.synchronize()
            bridge.call("critterCloudSaved", at)
        case "delete":                 // "Delete backup" in Settings (the page also turns backups off)
            kvs.removeObject(forKey: Self.backupKey)
            kvs.removeObject(forKey: Self.atKey)
            kvs.synchronize()
            bridge.call("critterCloudDeleted")
        case "load":
            kvs.synchronize()
            offer(force: true)          // "Restore from iCloud" in Settings: always show what's there
        default: break
        }
    }

    private func offer(force: Bool) {
        if let json = kvs.string(forKey: Self.backupKey) {
            bridge.call("critterCloudBackup", json, force)
        } else if force {
            bridge.call("critterCloudBackup", NSNull(), true)
        }
    }
}
