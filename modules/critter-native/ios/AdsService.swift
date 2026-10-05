import UIKit
import AppTrackingTransparency
#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif
#if canImport(UserMessagingPlatform)
import UserMessagingPlatform
#endif

/// Ads for Critter Stack, using Google AdMob (Google Mobile Ads SDK 12 and Google's User Messaging Platform).
///
/// Two kinds of ads:
///  • Interstitial between games. The page sends {type:'showInterstitial'} and waits for window.critterAdDone().
///    critterAdDone is ALWAYS called: when the ad closes, when it fails, or when no ad is loaded.
///  • Rewarded ("watch an ad for +1 life, skip or undo", up to 5 a day). The page sends {type:'showRewarded', reward}.
///    window.critterRewarded(reward) is called only when AdMob reports the reward was earned (the whole ad was watched);
///    window.critterRewardFailed(message) is called if no ad is ready or the player closes it early.
///
/// The page shows its "watch an ad" buttons only after window.critterAdsReady(true). If the SDK is not in the project,
/// that never happens: no ad buttons, no interstitials, and nothing is given away for free.
///
/// Order at launch (Google's and Apple's rules): consent form where the law needs one (EU/UK) → App Tracking
/// Transparency prompt → start the SDK → preload one interstitial and one rewarded ad.
@MainActor
final class AdsService: NSObject {
    private unowned let bridge: GameBridge

    // Ad unit IDs from AdMob › Apps › Critter Stack › Ad units. Debug builds always use Google's test units.
    // Release builds (TestFlight and the App Store) use the real ones. Add your iPhone under AdMob › Settings › Test devices.
    private static let myInterstitialUnit = "ca-app-pub-4757265288772810/6644443084"   // Critter Stack · Between games
    private static let myRewardedUnit     = "ca-app-pub-4757265288772810/3311702737"   // Critter Stack · Free life, skip or undo
    private static let testInterstitial  = "ca-app-pub-3940256099942544/4411468910"
    private static let testRewarded      = "ca-app-pub-3940256099942544/1712485313"
    #if DEBUG
    private let interstitialUnit = AdsService.testInterstitial
    private let rewardedUnit     = AdsService.testRewarded
    #else
    private let interstitialUnit = AdsService.myInterstitialUnit.contains("XXXX") ? AdsService.testInterstitial : AdsService.myInterstitialUnit
    private let rewardedUnit     = AdsService.myRewardedUnit.contains("XXXX") ? AdsService.testRewarded : AdsService.myRewardedUnit
    #endif

    private var started = false

    init(bridge: GameBridge) { self.bridge = bridge }

    #if canImport(GoogleMobileAds)
    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var pendingReward: String?
    private var rewardEarned = false
    private var showingRewarded = false

    /// Called once the page has loaded (GameBridge.pageReady).
    func start() {
        guard !started else { return }
        started = true
        gatherConsent { [weak self] in
            guard let self else { return }
            self.requestTracking {
                MobileAds.shared.start { _ in
                    Task { @MainActor in
                        self.loadInterstitial()
                        self.loadRewarded()
                    }
                }
            }
        }
    }

    func handle(type: String, body: [String: Any]) {
        switch type {
        case "showInterstitial":
            guard let ad = interstitial, let root = bridge.rootViewController else {
                bridge.call("critterAdDone"); loadInterstitial(); return
            }
            ad.fullScreenContentDelegate = self
            ad.present(from: root.presentedViewController ?? root)
        case "showRewarded":
            let reward = (body["reward"] as? String) ?? "skip"
            guard let ad = rewarded, let root = bridge.rootViewController else {
                bridge.call("critterRewardFailed", "No ad is available right now. Try again in a bit.")
                loadRewarded(); return
            }
            pendingReward = reward; rewardEarned = false; showingRewarded = true
            ad.fullScreenContentDelegate = self
            ad.present(from: root.presentedViewController ?? root) { [weak self] in
                self?.rewardEarned = true       // AdMob confirms the whole ad was watched
            }
        case "privacyOptions":                  // Settings › "Ad privacy choices" (required for EU/UK players)
            #if canImport(UserMessagingPlatform)
            if let root = bridge.rootViewController {
                ConsentForm.presentPrivacyOptionsForm(from: root) { _ in }
            }
            #endif
        default: break
        }
    }

    private func loadInterstitial() {
        guard canRequestAds else { return }
        InterstitialAd.load(with: interstitialUnit, request: Request()) { [weak self] ad, _ in
            Task { @MainActor in self?.interstitial = ad }
        }
    }

    private func loadRewarded() {
        guard canRequestAds else { bridge.call("critterAdsReady", false); return }
        RewardedAd.load(with: rewardedUnit, request: Request()) { [weak self] ad, _ in
            Task { @MainActor in
                guard let self else { return }
                self.rewarded = ad
                self.bridge.call("critterAdsReady", ad != nil)
                if ad == nil {       // no fill: try again in a minute
                    try? await Task.sleep(nanoseconds: 60_000_000_000)
                    self.loadRewarded()
                }
            }
        }
    }

    private var canRequestAds: Bool {
        #if canImport(UserMessagingPlatform)
        return ConsentInformation.shared.canRequestAds
        #else
        return true
        #endif
    }

    /// EU/UK (and other regions that need it): shows Google's consent form the first time. Elsewhere it returns at once.
    private func gatherConsent(_ done: @escaping () -> Void) {
        #if canImport(UserMessagingPlatform)
        ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] _ in
            Task { @MainActor in
                guard let root = self?.bridge.rootViewController else { done(); return }
                ConsentForm.loadAndPresentIfRequired(from: root) { _ in
                    Task { @MainActor in done() }
                }
            }
        }
        #else
        done()
        #endif
    }

    /// Apple's "Allow tracking?" prompt. Asked once, after consent and before the first ad. Critter Stack works the same either way.
    private func requestTracking(_ done: @escaping () -> Void) {
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { done(); return }
        // iOS only shows the prompt while the app is active; a short delay lets the launch finish first
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            ATTrackingManager.requestTrackingAuthorization { _ in
                Task { @MainActor in done() }
            }
        }
    }
    #else
    // Google Mobile Ads isn't in the project: no ads, and the page keeps its "watch an ad" buttons hidden.
    func start() { bridge.call("critterAdsReady", false) }
    func handle(type: String, body: [String: Any]) {
        switch type {
        case "showInterstitial": bridge.call("critterAdDone")
        case "showRewarded": bridge.call("critterRewardFailed", "Ads aren't available in this build.")
        default: break
        }
    }
    #endif
}

#if canImport(GoogleMobileAds)
extension AdsService: FullScreenContentDelegate {
    nonisolated func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        Task { @MainActor in self.finished(ad) }
    }
    nonisolated func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        Task { @MainActor in self.finished(ad, failed: true) }
    }

    private func finished(_ ad: FullScreenPresentingAd, failed: Bool = false) {
        if ad is RewardedAd || showingRewarded {
            showingRewarded = false
            if rewardEarned, let reward = pendingReward { bridge.call("critterRewarded", reward) }
            else { bridge.call("critterRewardFailed", failed ? "That ad couldn't play. Try again in a bit." : "Watch the whole ad to get the reward.") }
            pendingReward = nil; rewardEarned = false
            rewarded = nil; loadRewarded()                  // each ad plays once; get the next one ready
        } else {
            bridge.call("critterAdDone")                    // the game waits for this before the next round
            interstitial = nil; loadInterstitial()
        }
    }
}
#endif
