# Critter Stack: iPhone and iPad app (Expo)

This is the App Store version of Critter Stack. The game is one web page (`web/critter-stack.html`) shown full screen. A small native module (`modules/critter-native`) adds what only an app can do:

- Game Center leaderboards and achievements
- App Store purchases and Restore Purchases
- iCloud backup
- AdMob ads, with Google's consent form and Apple's tracking prompt
- haptics
- daily reminders
- the share sheet

Expo builds it on its own Macs. **You never need a Mac or Xcode.**

> **Not in this version:** the home-screen widget. It needs an extra app extension; planned for 1.1.

## One-time setup (all in a web browser)

### 1. Apple Developer Program
Enroll at <https://developer.apple.com/programs/> ($99/year). Approval can take a day or two.

### 2. Put the code on GitHub
1. Create a free account at <https://github.com> if you don't have one.
2. Click **New repository** and name it `critter-stack`. Private is fine. Don't add a README.
3. On the empty repository page, click **uploading an existing file**. Drag in **everything inside** the `critter-stack` folder from the zip, including the `modules`, `web`, `scripts` and `assets` folders. Then click **Commit changes**.
   - Hidden files like `.gitignore` may not show in your file browser. That's fine.

### 3. Create the Expo project and connect GitHub
1. Sign in at <https://expo.dev>, then choose **Projects › Create a project**. Name it `critter-stack`.
2. Open the project and go to **Project settings › GitHub**. Click **Connect**, install the Expo GitHub app, and choose the `critter-stack` repository.
3. Send Claude:
   - the **project ID**, shown on the project's overview page as a long code like `1a2b3c4d-…`
   - your **Expo username**

   Claude adds them to `app.json` and gives you the updated file to upload to GitHub.

### 4. Let Expo sign and upload for you
1. In App Store Connect (<https://appstoreconnect.apple.com>), go to **Users and Access › Integrations › App Store Connect API**. Click **Generate API Key**, name it "Expo" and give it **Admin** access. Download the `.p8` file (you can only download it once). Note the **Key ID** and **Issuer ID**.
2. In expo.dev, go to **Account settings › Credentials › iOS › App Store Connect API Keys** and add the key.
3. Create the app record: App Store Connect › **Apps › + › New App**.
   - Platform: iOS
   - Name: *Critter Stack: Animal Puzzle*
   - Bundle ID: `com.critterstack.app`. If it isn't in the list yet, the first build registers it; come back afterwards.
   - SKU: `critterstack`
4. Open the new app, then **App Information**. Copy its **Apple ID** (a number). Send it to Claude for `eas.json`.

### 5. First build
Claude starts builds through your Expo connection, reads the logs, and fixes any errors. When a build succeeds it is uploaded to **TestFlight**. Install the **TestFlight** app on your iPhone to play it.

## Before submitting to the App Store

- **Ads:** create the AdMob app and two ad units (Interstitial and Rewarded).
  - Put the ad unit IDs in `modules/critter-native/ios/AdsService.swift` (the lines marked `TODO`).
  - Put your AdMob **app** ID in `app.json` › `GADApplicationIdentifier`. It currently holds Google's test app ID.
  - In AdMob › Privacy & messaging, publish a **European regulations** message.
  - Also copy Google's current `SKAdNetworkItems` list into `app.json`. The list there is a starting point.
- **App Store Connect:** add the 11 in-app purchases, the 8 leaderboards and the 32 achievements. Product IDs, leaderboard IDs and times are in `store/app-store-connect-setup.md` (section 3; ignore its Xcode parts), and all 32 achievements are in `store/game-center-achievements.csv`.
- **Game Center:** in App Store Connect, turn on Game Center for the app version.
- **Privacy:** host the privacy policy and support pages, fill in your contact details, and answer the App Privacy questions (see `store/app-privacy-labels.md`; the pages are in `store/` too).

## Updating the game

The game source is `web/critter-stack.html`. After changing it, run `npm run build-web`, or let the cloud build do it (it runs automatically on every build). This turns off developer tools and embeds the Fredoka font. Then commit to GitHub and start a new build.

> **Never change** `ORIGIN` in `App.tsx` after release. The game's save data is tied to it.

## How it fits together

| File | What it does |
|---|---|
| `App.tsx` | Full-screen web view that shows the game. Passes messages between the page and the native module, and tells the page when the app goes to the background. |
| `web/critter-stack.html` | The game (the same page as the web version). |
| `web/game.ts` | Generated: the game with developer tools off and the font embedded. |
| `scripts/eas-post-install.mjs` | Runs on Expo's build servers: downloads Fredoka (open-source font) and regenerates `web/game.ts`. |
| `modules/critter-native/ios/CritterNativeModule.swift` | The module and its router (GameBridge). |
| `…/GameCenterService.swift` | Sign-in, scores, daily/weekly rankings, podium results, achievements. |
| `…/StoreService.swift` | StoreKit 2 purchases, local prices, Restore Purchases, rating prompt. |
| `…/Services.swift` | Haptics, daily reminders, iCloud backup. |
| `…/AdsService.swift` | AdMob interstitials and rewarded ads, consent form, tracking prompt. |
