package expo.modules.critternative

import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.android.play.core.review.ReviewManagerFactory
import org.json.JSONObject

/**
 * Google Play Billing. Product IDs match the App Store ones and must be created in Play Console
 * (Monetize › Products › In-app products) with exactly these IDs.
 *   Consumable: skips5/15/40, undos5/15/40, lives5, lives1h, turns5/15/40  → consumed after delivery, so they can be bought again
 *   Unlocks:    noads, zoo, bundle                                         → acknowledged once, restored with Restore purchases
 * Google refunds any purchase that isn't consumed or acknowledged within 3 days, so delivery always ends with one of those.
 */
class StoreService(private val bridge: GameBridge) : PurchasesUpdatedListener {
  companion object {
    private const val P = "com.critterstack."
    val consumables = listOf("skips5", "skips15", "skips40", "undos5", "undos15", "undos40",
      "lives5", "lives1h", "turns5", "turns15", "turns40").map { P + it }.toSet()
    val unlocks = listOf("noads", "zoo", "bundle").map { P + it }.toSet()
    val all = consumables + unlocks
  }

  private val client: BillingClient = BillingClient.newBuilder(bridge.context)
    .setListener(this)
    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
    .build()
  private val products = mutableMapOf<String, ProductDetails>()
  private val waiting = mutableListOf<() -> Unit>()
  private var connecting = false
  private val handled = mutableSetOf<String>()   // purchase tokens already being delivered this session

  fun start() = connected { loadProducts(); refreshPending() }

  fun destroy() { try { client.endConnection() } catch (_: Exception) {} }

  /** Runs `then` once Google Play's billing service is connected (reconnecting if it dropped). */
  private fun connected(then: () -> Unit) {
    if (client.isReady) { then(); return }
    waiting.add(then)
    if (connecting) return
    connecting = true
    client.startConnection(object : BillingClientStateListener {
      override fun onBillingSetupFinished(result: BillingResult) {
        bridge.main.post {
          connecting = false
          val run = waiting.toList(); waiting.clear()
          if (result.responseCode == BillingClient.BillingResponseCode.OK) run.forEach { it() }
        }
      }
      override fun onBillingServiceDisconnected() { bridge.main.post { connecting = false } }
    })
  }

  private fun loadProducts(then: (() -> Unit)? = null) {
    val list = all.map {
      QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.INAPP).build()
    }
    val params = QueryProductDetailsParams.newBuilder().setProductList(list).build()
    client.queryProductDetailsAsync(params) { result, details ->
      bridge.main.post {
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
          details.productDetailsList.forEach { products[it.productId] = it }
          sendPrices()
        }
        then?.invoke()
      }
    }
  }

  /** Local prices ("$0.99", "0,99 €", "₹89") replace the page's placeholder prices. */
  fun sendPrices() {
    if (products.isEmpty()) return
    val prices = products.mapNotNull { (id, d) -> d.oneTimePurchaseOfferDetails?.formattedPrice?.let { id to it } }.toMap()
    if (prices.isNotEmpty()) bridge.call("critterPrices", prices)
  }

  fun handle(type: String, body: JSONObject) {
    when (type) {
      "purchase" -> body.optString("productID").takeIf { it.isNotEmpty() }?.let { id -> connected { purchase(id) } }
      "restore" -> connected { restore() }
      "requestReview" -> requestReview()
    }
  }

  private fun purchase(id: String) {
    val details = products[id]
    if (details == null) {   // prices not loaded yet (or the product isn't live in Play Console)
      loadProducts { if (products[id] != null) purchase(id) else bridge.call("critterPurchaseFailed", "That item isn't available right now") }
      return
    }
    val activity = bridge.activity ?: run { bridge.call("critterPurchaseFailed", "The purchase didn't go through"); return }
    val flow = BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()))
      .build()
    val result = client.launchBillingFlow(activity, flow)
    if (result.responseCode == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) refreshPending()
    else if (result.responseCode != BillingClient.BillingResponseCode.OK) bridge.call("critterPurchaseFailed", "The purchase didn't go through")
  }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    bridge.main.post {
      when (result.responseCode) {
        BillingClient.BillingResponseCode.OK -> purchases?.forEach { deliver(it) }
        BillingClient.BillingResponseCode.USER_CANCELED -> {}
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> refreshPending()
        else -> bridge.call("critterPurchaseFailed", "The purchase didn't go through")
      }
    }
  }

  /** Purchases that were paid but not delivered yet: bought in the background, paid later (cash), or interrupted. */
  fun refreshPending() = connected {
    queryOwned { list -> list.forEach { deliver(it) } }
  }

  private fun queryOwned(done: (List<Purchase>) -> Unit) {
    val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
    client.queryPurchasesAsync(params) { result, list ->
      bridge.main.post { if (result.responseCode == BillingClient.BillingResponseCode.OK) done(list) }
    }
  }

  /** Gives the player what they paid for, exactly once: consumables after Google confirms the consume, unlocks after the acknowledge. */
  private fun deliver(p: Purchase) {
    if (p.purchaseState == Purchase.PurchaseState.PENDING) {
      if (handled.add("pending:" + p.purchaseToken)) bridge.call("critterPurchaseFailed", "Waiting for payment. Your item arrives when it's complete.")
      return
    }
    if (p.purchaseState != Purchase.PurchaseState.PURCHASED) return
    val ids = p.products
    if (ids.any { it in consumables }) {
      if (!handled.add(p.purchaseToken)) return
      client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { r, _ ->
        bridge.main.post {
          if (r.responseCode == BillingClient.BillingResponseCode.OK) ids.forEach { bridge.call("critterPurchased", it) }
          else handled.remove(p.purchaseToken)   // try again next time the app opens
        }
      }
    } else if (!p.isAcknowledged) {
      if (!handled.add(p.purchaseToken)) return
      client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { r ->
        bridge.main.post {
          if (r.responseCode == BillingClient.BillingResponseCode.OK) ids.forEach { bridge.call("critterPurchased", it) }
          else handled.remove(p.purchaseToken)
        }
      }
    }
  }

  /** Restore purchases: report every unlock this Google account owns. */
  private fun restore() {
    queryOwned { list ->
      list.forEach { deliver(it) }
      val owned = list.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }
        .flatMap { it.products }.filter { it in unlocks }.distinct()
      bridge.call("critterRestored", owned)
    }
  }

  /** The page only asks at happy moments; Google Play decides whether the review card actually appears. */
  private fun requestReview() {
    val activity = bridge.activity ?: return
    val manager = ReviewManagerFactory.create(bridge.context)
    manager.requestReviewFlow().addOnCompleteListener { task ->
      if (task.isSuccessful) manager.launchReviewFlow(activity, task.result)
    }
  }
}
