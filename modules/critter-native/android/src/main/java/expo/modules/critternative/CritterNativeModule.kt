package expo.modules.critternative

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/**
 * The Expo module the app's JavaScript talks to (Android side). Same surface as the iOS module:
 *   JS → native: start(), pageReady(), appState(state), handle(name, type, json)
 *   native → JS: the "critterCall" event {fn, args}; the app runs window.<fn>(args) in the game page.
 */
class CritterNativeModule : Module() {
  private var bridge: GameBridge? = null
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("CritterNative")
    Events("critterCall")

    Function("start") { onMain { it.start() } }
    Function("pageReady") { onMain { it.pageReady() } }
    Function("appState") { state: String -> onMain { it.appState(state) } }
    Function("handle") { name: String, type: String, json: String -> onMain { it.handle(name, type, json) } }

    OnDestroy { bridge?.destroy(); bridge = null }
  }

  private fun onMain(body: (GameBridge) -> Unit) {
    main.post {
      val ctx = appContext.reactContext ?: return@post
      val b = bridge ?: GameBridge(this, ctx.applicationContext).also { bridge = it }
      body(b)
    }
  }

  /** Sends window.<fn>(args) to the page (through the app's JavaScript). */
  fun sendCall(fn: String, argsJSON: String) {
    sendEvent("critterCall", mapOf("fn" to fn, "args" to argsJSON))
  }

  val activity: Activity? get() = appContext.currentActivity
  val permissions get() = appContext.permissions
}

/**
 * Routes messages from the game page to the native services and calls back into the page.
 *
 * Page → app: {name, msg:{type, ...}} where name is store, ads, haptics, notify or share.
 * App → page: critterPurchased(id), critterRestored([ids]), critterPrices({id: price}), critterPurchaseFailed(msg),
 *             critterNotifyResult(bool), critterAdDone(), critterAdsReady(bool), critterAdTestMode(bool),
 *             critterRewarded(kind), critterRewardFailed(msg)
 * Rankings on Android don't go through native code: the page talks to the shared Critter Stack board directly.
 */
class GameBridge(private val module: CritterNativeModule, val context: Context) {
  private var started = false
  val main = Handler(Looper.getMainLooper())

  private val store by lazy { StoreService(this) }
  private val ads by lazy { AdsService(this) }
  private val haptics by lazy { HapticsService(context) }
  private val notifications by lazy { NotificationService(this) }

  val activity: Activity? get() = module.activity
  val permissions get() = module.permissions

  fun start() {
    if (started) return
    started = true
    store.start()
  }

  fun pageReady() {
    start()
    store.sendPrices()
    ads.start()          // consent form where the law needs one → AdMob; tells the page when a rewarded ad is ready
  }

  fun appState(state: String) {
    if (state == "active") store.refreshPending()   // purchases that finished while the app was away
  }

  fun handle(name: String, type: String, json: String) {
    val body = try { JSONObject(json) } catch (e: Exception) { return }
    when (name) {
      "store" -> store.handle(type, body)
      "ads" -> ads.handle(type, body)
      "haptics" -> haptics.handle(type, body)
      "notify" -> notifications.handle(type, body)
      "share" -> ShareService.shareImage(this, body)
    }
  }

  /** Calls window.<fn>(<json args>) in the page. Safe to call from any thread. */
  fun call(fn: String, vararg args: Any?) {
    val json = args.joinToString(",") { toJson(it) }
    main.post { module.sendCall(fn, json) }
  }

  fun destroy() { store.destroy() }

  companion object {
    fun toJson(v: Any?): String = when (v) {
      null -> "null"
      is String -> JSONObject.quote(v)
      is Boolean, is Number -> v.toString()
      is Map<*, *> -> JSONObject(v.mapKeys { it.key.toString() }).toString()
      is Collection<*> -> JSONArray(v).toString()
      is JSONObject, is JSONArray -> v.toString()
      else -> JSONObject.quote(v.toString())
    }
  }
}
