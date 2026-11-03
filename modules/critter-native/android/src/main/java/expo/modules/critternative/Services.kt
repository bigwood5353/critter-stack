package expo.modules.critternative

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import expo.modules.interfaces.permissions.PermissionsStatus
import org.json.JSONObject
import java.io.File

// ---------- Haptics ----------

/** The page sends {type:'impact', style:'light'|'medium'|'heavy'} or {type:'notification', style:'success'|'warning'|'error'}. */
class HapticsService(private val ctx: Context) {
  private val vibrator: Vibrator? by lazy {
    if (Build.VERSION.SDK_INT >= 31) ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
    else @Suppress("DEPRECATION") (ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)
  }

  fun handle(type: String, body: JSONObject) {
    val v = vibrator ?: return
    if (!v.hasVibrator()) return
    val style = body.optString("style", "light")
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        val effect = when (type) {
          "notification" -> if (style == "success") VibrationEffect.EFFECT_DOUBLE_CLICK else VibrationEffect.EFFECT_HEAVY_CLICK
          else -> when (style) { "heavy" -> VibrationEffect.EFFECT_HEAVY_CLICK; "medium" -> VibrationEffect.EFFECT_CLICK; else -> VibrationEffect.EFFECT_TICK }
        }
        v.vibrate(VibrationEffect.createPredefined(effect))
      } else {
        val ms = when (style) { "heavy" -> 30L; "medium" -> 18L; else -> 10L }
        v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
      }
    } catch (_: Exception) {}
  }
}

// ---------- Daily reminder notifications ----------

/**
 * The page asks for permission only after the player opts in, then sends the next 7 reminders itself
 * ({type:'schedule', items:[{id, at, title, body}]}). Alarms are cleared by a phone restart; the page sends them
 * again every time the game opens, so at worst a reminder is missed until the next launch.
 */
class NotificationService(private val bridge: GameBridge) {
  private val ctx = bridge.context
  private val prefs by lazy { ctx.getSharedPreferences("critterReminders", Context.MODE_PRIVATE) }

  fun handle(type: String, body: JSONObject) {
    when (type) {
      "requestPermission" -> requestPermission()
      "schedule" -> schedule(body)
      "cancelAll" -> cancelAll()
    }
  }

  /** Answers critterNotifyResult(granted) or critterNotifyResult(false, "denied") when only the phone's Settings can fix it. */
  private fun requestPermission() {
    val enabled = NotificationManagerCompat.from(ctx).areNotificationsEnabled()
    val perms = bridge.permissions
    if (Build.VERSION.SDK_INT < 33 || perms == null) {
      if (enabled) bridge.call("critterNotifyResult", true) else bridge.call("critterNotifyResult", false, "denied"); return
    }
    val askedBefore = prefs.getBoolean("asked", false)
    prefs.edit().putBoolean("asked", true).apply()
    perms.askForPermissions({ result ->
      val granted = result[Manifest.permission.POST_NOTIFICATIONS]?.status == PermissionsStatus.GRANTED
      when {
        granted && NotificationManagerCompat.from(ctx).areNotificationsEnabled() -> bridge.call("critterNotifyResult", true)
        askedBefore -> bridge.call("critterNotifyResult", false, "denied")   // Android stops showing the prompt after a refusal
        else -> bridge.call("critterNotifyResult", false)
      }
    }, Manifest.permission.POST_NOTIFICATIONS)
  }

  private fun pending(id: String, title: String?, text: String?, flags: Int): PendingIntent? {
    val intent = Intent(ctx, ReminderReceiver::class.java).setAction("critter.reminder.$id")
    if (title != null) intent.putExtra("title", title)
    if (text != null) intent.putExtra("body", text)
    return PendingIntent.getBroadcast(ctx, id.hashCode(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun cancelAll() {
    val am = ctx.getSystemService(AlarmManager::class.java) ?: return
    prefs.getStringSet("ids", emptySet())?.forEach { id ->
      pending(id, null, null, PendingIntent.FLAG_NO_CREATE)?.let { am.cancel(it); it.cancel() }
    }
    prefs.edit().putStringSet("ids", emptySet()).apply()
  }

  private fun schedule(body: JSONObject) {
    cancelAll()
    val am = ctx.getSystemService(AlarmManager::class.java) ?: return
    val items = body.optJSONArray("items") ?: return
    val ids = mutableSetOf<String>()
    for (i in 0 until items.length()) {
      val item = items.optJSONObject(i) ?: continue
      val id = item.optString("id").takeIf { it.isNotEmpty() } ?: continue
      val at = item.optDouble("at", 0.0).toLong()
      if (at <= System.currentTimeMillis()) continue
      val pi = pending(id, item.optString("title", "Critter Stack"), item.optString("body", "Today's stack is ready!"),
        PendingIntent.FLAG_UPDATE_CURRENT) ?: continue
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)   // inexact by a few minutes, which is fine for a daily nudge
      ids.add(id)
    }
    prefs.edit().putStringSet("ids", ids).apply()
  }
}

/** Shows the reminder when its alarm fires. Tapping it opens the game. */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
    val channel = "daily"
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(channel) == null) {
      nm.createNotificationChannel(NotificationChannel(channel, "Daily Stack reminder", NotificationManager.IMPORTANCE_DEFAULT))
    }
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val tap = open?.let { PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    val n = NotificationCompat.Builder(context, channel)
      .setSmallIcon(R.drawable.critter_notify)
      .setContentTitle(intent.getStringExtra("title") ?: "Critter Stack")
      .setContentText(intent.getStringExtra("body") ?: "Today's stack is ready!")
      .setAutoCancel(true)
      .setContentIntent(tap)
      .build()
    try { nm.notify(intent.action.hashCode(), n) } catch (_: SecurityException) {}
  }
}

// ---------- Share my rank ----------

/** The page sends a PNG as a data URL; hand it to Android's share sheet (Messages, Instagram, Save to Photos…). */
object ShareService {
  fun shareImage(bridge: GameBridge, body: JSONObject) {
    val activity = bridge.activity ?: return
    val dataURL = body.optString("dataURL")
    val comma = dataURL.indexOf(',')
    if (comma < 0) return
    try {
      val bytes = Base64.decode(dataURL.substring(comma + 1), Base64.DEFAULT)
      val dir = File(activity.cacheDir, "critter_share").apply { mkdirs() }
      val file = File(dir, "critter-stack-rank.png")
      file.writeBytes(bytes)
      val uri = FileProvider.getUriForFile(activity, activity.packageName + ".critter.share", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        body.optString("text").takeIf { it.isNotEmpty() }?.let { putExtra(Intent.EXTRA_TEXT, it) }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(send, null))
    } catch (_: Exception) {}
  }
}
