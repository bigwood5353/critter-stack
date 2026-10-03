import GameKit

/// Game Center: sign-in, score submission (all-time + recurring boards), rankings, final ranks, achievements.
///
/// App Store Connect setup (see README):
///   Classic leaderboards (all-time): com.critterstack.classic, .challenge, .daily, .pen
///   Recurring leaderboards:          com.critterstack.daily.today (1 day), com.critterstack.classic.week,
///                                    com.critterstack.challenge.week, com.critterstack.pen.week (7 days, start on a Monday)
///   Achievements:                    com.critterstack.ach.<sticker id>  (one per sticker, 32 total)
@MainActor
final class GameCenterService: NSObject, GKGameCenterControllerDelegate {
    private unowned let bridge: GameBridge
    private var signedIn: Bool { GKLocalPlayer.local.isAuthenticated }

    init(bridge: GameBridge) { self.bridge = bridge }

    func authenticate() {
        GKLocalPlayer.local.authenticateHandler = { [weak self] vc, _ in
            guard let self else { return }
            if let vc { self.bridge.rootViewController?.present(vc, animated: true) }
            if GKLocalPlayer.local.isAuthenticated { self.flushPending() }   // send anything saved while offline
        }
    }

    func handle(type: String, body: [String: Any]) {
        switch type {
        case "submitScore":
            guard let id = body["leaderboardID"] as? String, let score = body["score"] as? Int else { return }
            submit(Pending(kind: "score", id: id, score: score, context: body["context"] as? Int ?? 0, at: Date()))

        case "loadBoard":
            guard let id = body["leaderboardID"] as? String else { return }
            loadBoard(id)

        case "loadFinalRank":
            guard let id = body["leaderboardID"] as? String, let key = body["key"] as? String else { return }
            loadFinalRank(id, key: key)

        case "reportAchievement":
            guard let id = body["achievementID"] as? String else { return }
            submit(Pending(kind: "achievement", id: id, score: 0, context: 0, at: Date()))

        case "showLeaderboard":
            let id = body["leaderboardID"] as? String
            let vc = id.map { GKGameCenterViewController(leaderboardID: $0, playerScope: .global, timeScope: .allTime) }
                ?? GKGameCenterViewController(state: .leaderboards)
            vc.gameCenterDelegate = self
            bridge.rootViewController?.present(vc, animated: true)

        default: break
        }
    }

    /// Top 10 of the current period, plus the player's own entry. Score context carries each player's flair.
    private func loadBoard(_ id: String) {
        guard signedIn else {
            bridge.call("critterBoardLoaded", ["leaderboardID": id, "error": "signedOut"]); return
        }
        GKLeaderboard.loadLeaderboards(IDs: [id]) { [weak self] boards, _ in
            guard let self, let board = boards?.first else { return }
            board.loadEntries(for: .global, timeScope: .allTime, range: NSRange(location: 1, length: 10)) { local, entries, total, _ in
                Task { @MainActor in
                    let me = GKLocalPlayer.local.gamePlayerID
                    var rows: [[String: Any]] = (entries ?? []).map { e in
                        ["rank": e.rank, "name": e.player.displayName, "score": e.score, "context": e.context,
                         "me": e.player.gamePlayerID == me]
                    }
                    if let local, !rows.contains(where: { ($0["me"] as? Bool) == true }) {
                        rows.append(["rank": local.rank, "name": local.player.displayName, "score": local.score,
                                     "context": local.context, "me": true])
                    }
                    var payload: [String: Any] = ["leaderboardID": id, "total": total, "entries": rows]
                    if let local { payload["player"] = ["rank": local.rank, "score": local.score] }
                    self.bridge.call("critterBoardLoaded", payload)
                }
            }
        }
    }

    /// Where the player finished on the most recent finished occurrence of a recurring board.
    /// Game Center only keeps the immediately previous occurrence, so the page asks as soon as a period ends.
    private func loadFinalRank(_ id: String, key: String) {
        guard signedIn else { return }
        GKLeaderboard.loadLeaderboards(IDs: [id]) { [weak self] boards, _ in
            guard let self, let board = boards?.first else { return }
            board.loadPreviousOccurrence { prev, _ in
                guard let prev else { return }
                prev.loadEntries(for: .global, timeScope: .allTime, range: NSRange(location: 1, length: 1)) { local, _, total, _ in
                    Task { @MainActor in
                        self.bridge.call("critterFinalRank", ["key": key, "rank": local?.rank ?? 0, "total": total])
                    }
                }
            }
        }
    }

    // MARK: Offline queue
    // A score set on the subway (or before signing in) is saved and sent the next time Game Center is reachable.
    // Recurring boards only accept a score while its period is open, so anything older than 8 days is dropped.

    struct Pending: Codable { var kind: String; var id: String; var score: Int; var context: Int; var at: Date }
    private let pendingKey = "gcPending"
    private var pending: [Pending] {
        get { (UserDefaults.standard.data(forKey: pendingKey)).flatMap { try? JSONDecoder().decode([Pending].self, from: $0) } ?? [] }
        set { UserDefaults.standard.set(try? JSONEncoder().encode(Array(newValue.suffix(200))), forKey: pendingKey) }
    }

    private func submit(_ item: Pending) {
        guard signedIn else { pending.append(item); return }
        send(item) { [weak self] ok in if !ok { self?.pending.append(item) } }
    }

    private func send(_ item: Pending, done: @escaping @MainActor (Bool) -> Void) {
        if item.kind == "achievement" {
            let a = GKAchievement(identifier: item.id)
            a.percentComplete = 100
            a.showsCompletionBanner = true
            GKAchievement.report([a]) { error in Task { @MainActor in done(error == nil) } }
        } else {
            GKLeaderboard.submitScore(item.score, context: item.context, player: GKLocalPlayer.local,
                                      leaderboardIDs: [item.id]) { error in Task { @MainActor in done(error == nil) } }
        }
    }

    /// Called after sign-in and whenever the app comes back to the foreground.
    func flushPending() {
        guard signedIn else { return }
        let cutoff = Date().addingTimeInterval(-8 * 24 * 3600)
        let items = pending.filter { $0.kind == "achievement" || $0.at > cutoff }
        pending = []
        for item in items {
            send(item) { [weak self] ok in if !ok { self?.pending.append(item) } }
        }
    }

    nonisolated func gameCenterViewControllerDidFinish(_ vc: GKGameCenterViewController) {
        Task { @MainActor in vc.dismiss(animated: true) }
    }
}
