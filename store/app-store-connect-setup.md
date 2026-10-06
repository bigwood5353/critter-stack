> **Note:** this guide was written for the earlier plain-Xcode version. With Expo you can skip sections 1, 2 and 4 (Xcode, fonts, adding the ad SDK); the build handles them. Sections 3 (App Store Connect), 5 (privacy), 6 (testing checklist) and 7 (review notes) still apply.

# Critter Stack: iPhone and iPad app

This folder is the native iOS app that wraps the game. The game page (`CritterStack/Web/index.html`) provides the gameplay. The Swift code adds what only an app can do: Game Center, StoreKit 2 purchases and Restore, real haptics, daily reminder notifications, a home-screen widget, and correct audio behavior.

> **Status:** written carefully against Apple's current APIs (iOS 17+, Xcode 16), but **not compiled or run yet**. It was written without a Mac. Expect a few small fixes the first time you build.

## What's here

| File | What it does |
|---|---|
| `CritterStack/CritterStackApp.swift` | App entry. Sets the audio session (respects the silent switch) and tells the game when the app goes to the background or comes back. Handles taps on the widget. |
| `CritterStack/GameWebView.swift` | Shows the game. Turns off browser behavior: bounce, pinch zoom, link previews and back-swipe. Reloads itself if iOS clears it from memory. |
| `CritterStack/GameBridge.swift` | Passes messages between the game and the native services. Pauses the game when a phone call or Siri interrupts. |
| `CritterStack/GameCenterService.swift` | Sign-in, score submission, daily/weekly rankings, final podium ranks, achievements, and the Game Center screen. |
| `CritterStack/StoreService.swift` | StoreKit 2 purchases, prices in the player's own currency, purchases completed outside the app, and Restore Purchases. |
| `CritterStack/Services.swift` | Haptics, daily reminders, widget data and **iCloud backup**. |
| `CritterStack/AdsService.swift` | Google AdMob: interstitials between games and rewarded ads, with the consent form and tracking prompt. No ads (and no free rewards) until the SDK is added. |
| `CritterWidget/CritterWidget.swift` | Home-screen widget (small and medium): Daily Stack number, tries left, rank, streak, crest and medal. |
| `prepare-web.sh` | Copies the game into the app, switches off dev tools and uses the bundled font. |
| `game-center-achievements.csv` | All 32 achievements, with IDs, titles, descriptions and points (totalling 1,000). |

## 1. Create the Xcode project (about 20 minutes)

1. Xcode › **File › New › Project › iOS › App**. Product name **CritterStack**, Interface **SwiftUI**, Language **Swift**. Bundle ID, for example, **com.critterstack.app**.
2. Delete the generated `ContentView.swift` and `CritterStackApp.swift`, then drag in the `.swift` files from `CritterStack/`.
3. Drag the **`Web` folder** into the project and choose **"Create folder references"**. The folder must show **blue**, not yellow, so `Web/index.html` and `Web/fonts/` keep their paths inside the app.
4. **General › Minimum Deployments:** iOS 17.0. Supported destinations: iPhone and iPad.
5. **Signing & Capabilities** (app target): add **Game Center**, **In-App Purchase**, **App Groups** and **iCloud**.
   - App Groups: create `group.com.critterstack.shared`.
   - iCloud: tick only **Key-value storage**. Nothing else is needed.
6. **Widget:** File › New › Target › **Widget Extension**, named `CritterWidget`. Untick "Include Live Activity" and "Include Configuration App Intent". Replace its generated Swift file with `CritterWidget/CritterWidget.swift`. Give this target the **same App Group**.
7. **Info tab › URL Types:** add one with URL Schemes `critterstack`, so tapping the widget opens the Daily rankings.
8. **Orientation:** iPhone portrait only; iPad all four orientations (the game has an iPad landscape layout).
9. **Launch screen (Info tab):** under `UILaunchScreen`, set `UIColorName` to a color asset named `LaunchLavender` (#F2ECFF, the menu background) and `UIImageName` to your logo asset. This gives a native launch with no white flash.

## 2. Fonts (offline play)

1. Download Fredoka from <https://fonts.google.com/specimen/Fredoka> (**Get font › Download all**).
2. From the zip, take `Fredoka-VariableFont_wdth,wght.ttf` and rename it **`Fredoka.ttf`**. Also keep **`OFL.txt`**.
3. Put both in `CritterStack/Web/fonts/`.
4. Every time the game changes, run:
   ```bash
   ./prepare-web.sh path/to/critter-stack.html
   ```
   This writes `Web/index.html` with dev tools off and Google Fonts replaced by the bundled font.

## 3. App Store Connect setup

**Agreements first:** under Business, sign the **Paid Apps** agreement and fill in tax and banking. In-app purchases won't load until that's done.

### In-app purchases (Monetization › In-App Purchases)

| Product ID | Type | Price |
|---|---|---|
| com.critterstack.skips5 / .skips15 / .skips40 | Consumable | $0.99 / $1.99 / $3.99 |
| com.critterstack.undos5 / .undos15 / .undos40 | Consumable | $0.99 / $1.99 / $3.99 |
| com.critterstack.lives5 | Consumable (refill: +5 lives) | $0.99 |
| com.critterstack.lives1h | Consumable (1 hour of unlimited lives) | $1.99 |
| com.critterstack.noads | Non-Consumable | $4.99 |
| com.critterstack.zoo | Non-Consumable | $3.99 |
| com.critterstack.bundle | Non-Consumable | $9.99 |

Lives are tracked by the game itself (5 max, one back every 20 minutes), so the unlimited hour is a consumable, not a subscription.

Each one needs a display name, a description and a review screenshot (a screenshot of the Store screen works).

### Game Center (Services › Game Center)

**All-time leaderboards:** `com.critterstack.classic` (display name **Petting Zoo**; the ID keeps its old name, which players never see), `.challenge`, `.daily`, `.pen`. Use score format **Integer**, sort **High to Low**, and score submission type **Best Score**.

**Recurring leaderboards:**

| ID | Starts | Duration | Restarts |
|---|---|---|---|
| com.critterstack.daily.today | any day at **00:00 UTC** | 1 day | every day |
| com.critterstack.classic.week | a **Monday at 00:00 UTC** | 7 days | weekly |
| com.critterstack.challenge.week | same | 7 days | weekly |
| com.critterstack.pen.week | same | 7 days | weekly |

**Achievements:** enter the 32 rows from `game-center-achievements.csv`. Each also needs a 512×512 image; the sticker emoji on a colored circle is fine.

> **Reset time:** the game already runs the Daily Stack and every board on **universal time (UTC)**. A new stack opens at 00:00 UTC, which is 8 PM US Eastern in summer and 7 PM in winter, and weekly boards turn over Monday 00:00 UTC. The start times in App Store Connect must match exactly, or the podiums won't line up with what players see. App Store Connect asks for the start in your own time zone, so enter the local time that equals 00:00 UTC.

## 4. Ads (Google AdMob)

The ad code is written: `CritterStack/AdsService.swift`. It shows an interstitial between games and rewarded ads for +1 life, skip or undo (up to 5 a day), with Google's consent form and Apple's tracking prompt in the right order. **Until the SDK is added the app simply has no ads.** The "watch an ad" buttons stay hidden, and nothing is given away for free.

1. **AdMob account:** create an account at admob.google.com and add an iOS app (you can link it to the App Store listing later). Create two ad units:
   - one **Interstitial**
   - one **Rewarded**. Any reward amount is fine; the game decides the reward.
2. **Paste your IDs:**
   - Put both ad unit IDs into `AdsService.swift`, in the `#else` (release) lines marked `TODO`.
   - Debug builds already use Google's test ads, so you can test safely.
3. **Add the SDK:** File › Add Package Dependencies › `https://github.com/googleads/swift-package-manager-google-mobile-ads`. Add **GoogleMobileAds**, and also **GoogleUserMessagingPlatform** from `https://github.com/googleads/swift-package-manager-google-user-messaging-platform`.
   - The code targets **SDK version 12** (type names like `InterstitialAd`, `RewardedAd`, `MobileAds`). If Xcode suggests `GAD…` names instead, you have version 11. Update the package, or ask me to switch the names.
4. **Info.plist:** add these keys:
   - `GADApplicationIdentifier`: your AdMob **app** ID (ca-app-pub-…~…), not an ad unit ID.
   - `NSUserTrackingUsageDescription`: "Lets us show ads that fit your interests. Critter Stack works the same either way."
   - `SKAdNetworkItems`: Google's list. Copy it from AdMob's iOS "Get started" page.
5. **Consent form:** in AdMob › Privacy & messaging, create a **European regulations (GDPR)** message for iOS and publish it. That is the consent form shown to EU/UK players. Settings in the game has an **Ad privacy choices** button so they can change it later.
6. **Content rating:** in AdMob › Blocking controls, set the maximum ad content rating to **G** (general audiences).
7. **Test on a device:** start a few games until an interstitial appears (the first 8 games are ad-free; after that one plays about every 3 games of at least 45 seconds, never closer than 3 minutes apart). Then watch a rewarded ad from the Store or the out-of-lives screen. Close one early and check that it gives nothing.

## 5. Privacy

- **Privacy policy URL:** required. A one-page site is enough. Name AdMob, Game Center and Apple in-app purchases, and say that progress is stored on the device.
- **App Privacy labels:** match AdMob's published disclosure. Typically Device ID, Advertising Data, Product Interaction, Coarse Location and Diagnostics are "used for third-party advertising" and "linked to identity: no". Purchase history is used for app functionality.
- **Age rating:** answer the questionnaire honestly (cartoon content, in-app purchases, ads). Expect **4+**.
- **Category:** Games › Puzzle, plus Games › Family if you like. **Not the Kids category**, since Kids apps can't use tracking ads.

## 6. Testing checklist (before TestFlight)

- [ ] **StoreKit testing in Xcode:** File › New › File › **StoreKit Configuration File**, synced from App Store Connect, then selected in the scheme (Run › Options). Buy each product; kill and relaunch; delete and reinstall, then **Restore purchases**.
- [ ] Sandbox purchases on a real device with a Sandbox Apple ID (Settings › App Store › Sandbox Account).
- [ ] Game Center sign-in, score appears on the board, **View in Game Center**, and an achievement banner appears.
- [ ] **Airplane mode:** fresh install, then play the Petting Zoo, the Daily Stack and the pen. Fonts must look right, with no errors or blank screens.
- [ ] **Silent switch on:** no game sounds. With Music playing, game sounds mix in without stopping the music.
- [ ] **Interruptions:** during a game, take a call, trigger Siri and swipe to the home screen. The game should pause each time.
- [ ] **Widget:** add it to the home screen, play a Daily try, and check the widget updates. After midnight it says "New stack is ready!" Tapping it opens the Daily rankings.
- [ ] **Reminder:** finish a Daily Stack, tap **Remind me**, and allow notifications. Check that tomorrow's reminder arrives and that none arrives once you've already played that day.
- [ ] **iPad:** portrait, both landscapes, and Split View at half and one-third width.
- [ ] No bounce, zoom or text-selection menus anywhere except the name boxes.
- [ ] Settings no longer shows the Developer tools (`prepare-web.sh` switched them off).
- [ ] **iCloud backup:** play a few games, send the app to the background, then delete and reinstall. It should restore by itself with "Welcome back! Your zoo was restored from iCloud".
- [ ] **Two devices, same Apple ID:** play more on device B, then open device A. A should ask "Progress found in iCloud" and show both summaries side by side.
- [ ] **Countdown:** the menu's Daily row, the Rankings screen and the "all 3 tries" card all count down to 00:00 UTC. When it hits zero, the new stack appears without restarting the app.

## 7. App Review notes (paste into App Store Connect › App Review Information)

> Critter Stack is a puzzle game for iPhone and iPad. Native integrations:
> • Game Center: sign-in, all-time and recurring (daily and weekly) leaderboards, and 32 achievements
> • StoreKit 2 in-app purchases (consumable skip, undo and life packs; No Ads, Zoo and Bundle unlocks), with Restore Purchases in the Store screen and in Settings
> • A WidgetKit home-screen widget showing today's Daily Stack, tries left, streak and rank
> • Opt-in local notifications for the daily puzzle (requested only after the player chooses "Remind me")
> • Taptic Engine haptics, and an ambient audio session that respects the silent switch and pauses for calls
> The game is fully playable offline, and no account is required.
> To test purchases, use the Store screen (🛍️ on the main menu). Restore Purchases is at the bottom of the Store.

Keep the notes **accurate**. Describe what the app does, and don't claim it's built with SpriteKit or similar. If a reviewer asks how it's built, answer honestly. Apple's concern is whether the app delivers a real, app-like experience, and the features above are what show that.

## Known limits to plan for

- **iCloud backup keeps one snapshot per Apple ID** (the most recent device to save). When two devices disagree, the player picks one; progress is not merged. Purchases never depend on the backup, since Restore Purchases brings them back from the App Store.
- The backup covers progress, scores, settings, your name, and the last week of Daily Stack bests. Players who aren't signed in to iCloud, or who switch iCloud off for Critter Stack in Settings, simply keep progress on the device.
- **Game Center keeps only the most recent finished period.** The game asks for the final rank as soon as a board ends. If a player skips opening the app for over a day (or over a week for weekly boards), that period's prize can't be verified and is skipped.
- **Web view storage:** keep `websiteDataStore = .default()` (already set). Don't switch to a non-persistent store, or progress resets on every launch.
