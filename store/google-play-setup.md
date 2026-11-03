# Critter Stack on Google Play: setup checklist

The Android app is built from the same project as the iPhone app (Expo/EAS). These are the one-time steps in Google's consoles, in order.

## 1. Google Play developer account (after the LLC's D-U-N-S number arrives)

1. Go to https://play.google.com/console/signup and choose **Organization**.
2. Use the LLC's exact legal name, its address and its D-U-N-S number (the same one Apple uses). The fee is $25, one time.
3. Organization accounts skip the "12 testers for 14 days" rule that new personal accounts have.
4. Google verifies the organization, which can take a few days.

## 2. AdMob: add the Android app (can be done now)

1. Go to AdMob › **Apps › Add app** › Android › "Is the app listed on a supported app store?" **No** (you link it after launch) › name it **Critter Stack**.
2. Create two ad units:
   - **Interstitial**, named "Between games".
   - **Rewarded**, named "Free life, skip or turn".
3. Send Claude these three IDs:
   - the **App ID**, which looks like `ca-app-pub-4757265288772810~…`
   - the two **ad unit IDs**, which look like `…/…`

They go into `app.json` (the `admobAppId` setting of `./plugins/withCritterAndroid`) and into `AdsService.kt`. Until then the Android app plays Google's test ads.

## 3. Create the app in Play Console

**All apps › Create app**:
- Name: **Critter Stack: Animal Puzzle**
- Language: English (US)
- App or game: **Game**
- Free

Tick the declarations.

## 4. In-app products (Monetize › Products › In-app products)

Create these 14 products with these exact IDs. Prices match the App Store, and Google converts them to other currencies.

| Product ID | Name | Price (USD) |
|---|---|---|
| com.critterstack.skips5 / skips15 / skips40 | 5 / 15 / 40 Skips | same as App Store |
| com.critterstack.undos5 / undos15 / undos40 | 5 / 15 / 40 Undos | same as App Store |
| com.critterstack.turns5 / turns15 / turns40 | 5 / 15 / 40 Turns | $0.99 / $1.99 / $3.99 |
| com.critterstack.lives5 | Life refill | same as App Store |
| com.critterstack.lives1h | 1 hour unlimited lives | same as App Store |
| com.critterstack.noads | No Ads | $4.99 |
| com.critterstack.zoo | Whole Zoo | same as App Store |
| com.critterstack.bundle | Everything bundle | same as App Store |

Google Play has no consumable or non-consumable switch. The app consumes the packs itself and keeps the three unlocks. You need a **payments profile** (merchant account) before you can create products; Play Console walks you through it.

## 5. App content (Policy › App content)

| Section | Answer |
|---|---|
| Privacy policy | https://woodinteractive.app/critter-stack/privacy |
| Ads | **Yes, my app contains ads** |
| App access | All functionality is available without special access |
| Content rating (IARC questionnaire) | Category: **Game, puzzle**. No violence, fear, sexuality, language, drugs or gambling. Users can't interact or exchange content. It shares location? **No**. Digital purchases? **Yes**. Expect **Everyone / PEGI 3**. |
| Target audience | **13 and over** (13–15, 16–17, 18+). If you include under-13s, Google's Families policy applies to ads. Answer that the app is **not** designed for children. |
| Data safety | see below |
| Government app / financial features / health | No |

### Data safety answers

**Does your app collect or share user data?** Yes.

**Is data encrypted in transit?** Yes. **Can users request deletion?** Yes, by email to support@woodinteractive.app.

| Data type | Collected | Shared | Why | Optional? |
|---|---|---|---|---|
| Device or other IDs (advertising ID, by AdMob) | Yes | Yes (Google AdMob) | Advertising, Analytics | Required |
| App interactions (by AdMob) | Yes | Yes | Advertising, Analytics | Required |
| Crash logs, Diagnostics (by AdMob) | Yes | Yes | Analytics | Required |
| Approximate location (by AdMob, from IP address) | Yes | Yes | Advertising | Required |
| Purchase history | Yes | No | App functionality | Required |
| Name (the name a player types for the leaderboards) | Yes | No | App functionality | Optional |
| Other in-app content: game scores (shared rankings) | Yes | No | App functionality | Required |

The rankings service stores a random per-phone id. It isn't the advertising ID or a hardware ID, and Google classes it as "app functionality".

## 6. Store listing (Grow › Store presence › Main store listing)

- **Short description** (80 max): `Stack cute animals, clear rows, and race the world in the Daily Stack.`
- **Full description:** the App Store description from `store/app-store-listing.md`. Replace "iPhone and iPad" with "phones and tablets" and "Game Center leaderboard" with "worldwide leaderboard". Never mention other games' names.
- **App icon:** 512 × 512 PNG, which is `assets/icon.png` resized.
- **Feature graphic:** 1024 × 500. Ask Claude for one.
- **Phone screenshots:** 2–8 images, each side 320–3840 px, no taller than 2:1. The iPhone set is 2.17:1, so it needs an Android set. Ask Claude for one.
- **Tablet screenshots:** optional, but they help discovery.
- **Category:** Puzzle. **Contact email:** support@woodinteractive.app. **Website:** https://woodinteractive.app

## 7. First build and release

1. Build in PowerShell:
   ```
   npx.cmd eas-cli build -p android --profile production
   ```
   This makes an **.aab** signed with a key EAS creates and stores; say **Yes** when it asks to generate one. No `EXPO_NO_CAPABILITY_SYNC` is needed, because that switch is only for iPhone.
2. **Upload the very first .aab by hand.** Play Console › **Testing › Internal testing › Create new release** › upload the file downloaded from the EAS build page. Google requires the first upload to be manual.
3. Add yourself and testers under Internal testing › **Testers**, and open the opt-in link on an Android phone (or skip this if no one has one).
4. Check **Pre-launch report** (it runs automatically on Google's test phones) and **Android vitals** for crashes.
5. **Production › Create new release** › promote the same build › **Send for review**. The first review usually takes a few days.

Later builds can be sent with `npx.cmd eas-cli submit -p android --latest`, once a Google service-account key is set up in EAS (Expo walks you through it).

## Testing without an Android phone

- Claude can install `android-test` builds (`npx.cmd eas-cli build -p android --profile android-test`, which makes an .apk) on an Expo cloud emulator and play through them.
- Google's pre-launch report also runs every uploaded build on real devices.
