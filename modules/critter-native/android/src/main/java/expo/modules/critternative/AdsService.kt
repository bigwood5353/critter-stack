package expo.modules.critternative

import android.content.pm.ApplicationInfo
import android.provider.Settings
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import org.json.JSONObject

/**
 * Google AdMob for Android. Same contract with the page as iOS:
 *  • Interstitial between games: page sends {type:'showInterstitial'}; window.critterAdDone() is ALWAYS called afterwards.
 *  • Rewarded: {type:'showRewarded', reward}; critterRewarded(reward) only when the whole ad was watched, else critterRewardFailed(msg).
 * Order at launch: Google's consent form where the law needs one (EU/UK) → start the SDK → preload one of each.
 *
 * Google's test ads play while the real ad units below are placeholders, in debuggable builds, and on Google's own
 * pre-launch test devices (Firebase Test Lab), so robots and testers never tap real ads.
 */
class AdsService(private val bridge: GameBridge) {
  companion object {
    // AdMob › Apps › Critter Stack (Android) › Ad units. Replace the XXXX placeholders once the Android app exists in AdMob.
    private const val MY_INTERSTITIAL = "ca-app-pub-4757265288772810/XXXXXXXXXX"   // Critter Stack Android · Between games
    private const val MY_REWARDED = "ca-app-pub-4757265288772810/XXXXXXXXXX"       // Critter Stack Android · Free life, skip or turn
    private const val TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712"
    private const val TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917"
  }

  private val ctx = bridge.context
  private val testMode: Boolean by lazy {
    val debuggable = (ctx.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    val testLab = try { Settings.System.getString(ctx.contentResolver, "firebase.test.lab") == "true" } catch (_: Exception) { false }
    debuggable || testLab || MY_INTERSTITIAL.contains("XXXX") || MY_REWARDED.contains("XXXX")
  }
  private val interstitialUnit get() = if (testMode) TEST_INTERSTITIAL else MY_INTERSTITIAL
  private val rewardedUnit get() = if (testMode) TEST_REWARDED else MY_REWARDED

  private var started = false
  private var sdkReady = false
  private var interstitial: InterstitialAd? = null
  private var rewarded: RewardedAd? = null
  private var loadingInterstitial = false
  private var loadingRewarded = false
  private val consent: ConsentInformation by lazy { UserMessagingPlatform.getConsentInformation(ctx) }

  /** Called once the page has loaded. */
  fun start() {
    if (started) return
    started = true
    if (testMode) bridge.call("critterAdTestMode", true)   // testers see an ad early and often
    gatherConsent {
      MobileAds.initialize(ctx) {
        bridge.main.post { sdkReady = true; loadInterstitial(); loadRewarded() }
      }
    }
  }

  fun handle(type: String, body: JSONObject) {
    when (type) {
      "showInterstitial" -> showInterstitial()
      "showRewarded" -> showRewarded(body.optString("reward", "skip"))
      "privacyOptions" -> bridge.activity?.let { UserMessagingPlatform.showPrivacyOptionsForm(it) { } }   // Settings › "Ad privacy choices"
    }
  }

  private fun gatherConsent(done: () -> Unit) {
    val activity = bridge.activity ?: run { done(); return }
    consent.requestConsentInfoUpdate(activity, ConsentRequestParameters.Builder().build(), {
      UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { bridge.main.post(done) }
    }, { bridge.main.post(done) })
  }

  private val canRequestAds get() = sdkReady && consent.canRequestAds()

  private fun loadInterstitial() {
    if (!canRequestAds || loadingInterstitial || interstitial != null) return
    loadingInterstitial = true
    InterstitialAd.load(ctx, interstitialUnit, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
      override fun onAdLoaded(ad: InterstitialAd) { loadingInterstitial = false; interstitial = ad }
      override fun onAdFailedToLoad(error: LoadAdError) { loadingInterstitial = false; interstitial = null }
    })
  }

  private fun loadRewarded() {
    if (!canRequestAds) { bridge.call("critterAdsReady", false); return }
    if (loadingRewarded || rewarded != null) return
    loadingRewarded = true
    RewardedAd.load(ctx, rewardedUnit, AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
      override fun onAdLoaded(ad: RewardedAd) { loadingRewarded = false; rewarded = ad; bridge.call("critterAdsReady", true) }
      override fun onAdFailedToLoad(error: LoadAdError) {
        loadingRewarded = false; rewarded = null; bridge.call("critterAdsReady", false)
        bridge.main.postDelayed({ loadRewarded() }, 60_000)   // no fill: try again in a minute
      }
    })
  }

  private fun showInterstitial() {
    val ad = interstitial
    val activity = bridge.activity
    if (ad == null || activity == null) { bridge.call("critterAdDone"); loadInterstitial(); return }
    interstitial = null
    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
      override fun onAdDismissedFullScreenContent() { bridge.call("critterAdDone"); loadInterstitial() }
      override fun onAdFailedToShowFullScreenContent(error: AdError) { bridge.call("critterAdDone"); loadInterstitial() }
    }
    ad.show(activity)
  }

  private fun showRewarded(reward: String) {
    val ad = rewarded
    val activity = bridge.activity
    if (ad == null || activity == null) {
      bridge.call("critterRewardFailed", "No ad is available right now. Try again in a bit.")
      loadRewarded(); return
    }
    rewarded = null
    var earned = false
    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
      override fun onAdDismissedFullScreenContent() {
        if (earned) bridge.call("critterRewarded", reward) else bridge.call("critterRewardFailed", "Watch the whole ad to get the reward.")
        loadRewarded()
      }
      override fun onAdFailedToShowFullScreenContent(error: AdError) {
        bridge.call("critterRewardFailed", "That ad couldn't play. Try again in a bit.")
        loadRewarded()
      }
    }
    ad.show(activity) { earned = true }   // AdMob confirms the whole ad was watched
  }
}
