# Critter Stack: handoff

Read this first. It describes how the project works and where it stands, so a new chat can pick up without the old one.
How to set up a machine or account is in `SETUP.md`. How the code fits together is in `README.md`.

_Last updated: 2 November 2026._

---

## 1. What this is

**Critter Stack** is a cute animal falling-block puzzle game for iPhone and iPad, with an Android version in progress.
- **Built by:** Matt (Matthew Wood), a solo developer in Northern Virginia.
- **Studio:** Wood Interactive.
- **Status:** heading to its first App Store release (1.0).

The game is a single HTML file, `web/critter-stack.html`, of about 4,000 lines of plain JS, CSS and canvas, with no framework. It runs in a WebView inside a small Expo/React Native app. A local Swift module (`modules/critter-native`) gives the page native services: Game Center, App Store purchases, AdMob ads, haptics, notifications, sharing and iCloud backup.

Matt is not a game designer, and he's good at puzzle games, so he isn't a good benchmark for difficulty. He works on a **Windows PC with no Mac**. All iOS builds run in Expo's cloud (EAS).

## 2. IDs and accounts

| Thing | Value |
|---|---|
| Bundle ID | `com.critterstack.app` |
| Expo account / project | `bigwood53` · project ID `82a776c7-3625-4f4c-a466-0b9144691cbf` |
| GitHub | `bigwood5353/critter-stack`, branch `main` |
| App Store Connect app ID | `6818896969` (also in `eas.json` › submit) |
| Matt's project folder | `C:\Users\mwood\OneDrive\Claude App Code\critter-stack` |
| Website | https://woodinteractive.app (Cloudflare Pages, one deployment for every game) |
| Support email | support@woodinteractive.app |
| AdMob app ID | `ca-app-pub-4757265288772810~2725290088` (in `app.json`) |
| AdMob units | Interstitial `…/6644443084`, Rewarded `…/3311702737` (in `AdsService.swift`) |
| Live preview of the game | https://claude.ai/artifact/3QH8TfithTb4LuBYTqw5qh (Matt's private artifact) |
| Launch checklist | https://claude.ai/artifact/FH9FMK7dxngge521dx1d1t (Matt ticks items himself) |

**Secrets never go in chat or GitHub.** That includes the `.p8` App Store Connect key, Apple and AdMob passwords, and payment details. `.gitignore` blocks `*.p8`, `*.p12` and `*.mobileprovision`.

## 3. How work flows

1. **Claude edits** `web/critter-stack.html`, and Swift or config files when needed, and tests in a headless browser (see §7).
2. **Claude delivers** a zip with the repo's folder paths. If the chat is linked to Matt's PC, Claude can write the files into the project folder directly.
3. **Matt unzips** it over the project folder, and **Claude Code on his PC commits and pushes** to `main`.
4. **Matt builds from PowerShell**, using the iCloud-safe command in §5.
5. **Submit to TestFlight:**
   - Matt runs `npx.cmd eas-cli submit -p ios --latest`.
   - Or Claude runs it in an EAS sandbox through the Expo MCP: `sandbox_create` (LINUX, MEDIUM, gitRef main) → `npm i -g eas-cli@latest` → `eas submit -p ios --profile production --id <buildId> --non-interactive` → `sandbox_stop`.

Each build regenerates `web/game.ts` from the HTML in its post-install step. Nobody needs to rebuild it locally. The build also bundles the Fredoka font and turns `DEV` off.

## 4. ⚠️ Lessons that cost hours (read before touching builds)

- **iCloud vs Expo capability sync.**
  - iCloud backup uses only `com.apple.developer.ubiquity-kvstore-identifier`, the key-value store, with no container.
  - Expo's capability sync only recognises iCloud through container IDs. So on every `eas build` or `eas credentials` run, it **switched iCloud OFF** on the App ID, and the build failed with "Provisioning profile … doesn't include the iCloud capability".
  - **Fix:** always build with `EXPO_NO_CAPABILITY_SYNC=1`. Never "fix" it by removing the entitlement.
  - Builds Claude starts through the Expo MCP (`build_run`) may still sync, so let Matt start builds from PowerShell.
- **PowerShell blocks `npx`** (scripts disabled). Always use `npx.cmd`.
- **Stale provisioning profile:** if a build error names a profile with an old date, delete that profile in the Apple Developer site under Profiles (or with `eas credentials`) so a fresh one is generated.
- **The `build_submit` MCP tool conflicts.** Use the sandbox `eas submit` route instead.
- **Expo "Service Unavailable" or "lost connection to the worker"** are transient. Just rebuild.
- **The website is ONE Cloudflare deployment.** Each upload replaces everything, so always upload the combined zip with both games, `index.html`, `favicon.png` and **`app-ads.txt`**. If `app-ads.txt` goes missing, AdMob can't verify the ads.
- **Never call `location.reload()` or `web.current.reload()` in the app.** The page is bundled HTML with `ORIGIN` as its address, so a WebKit reload fetches https://critterstack.app/ from the internet (not a real site) and shows "Error loading page… -1003". The page asks the app with `post('app',{type:'reload'})`, and `App.tsx` remounts the WebView (`reloadGame`). This was the 1.0 bug where a fresh install with an iCloud backup showed a white error screen.
- **Never change `ORIGIN` in `App.tsx` after release.** It would wipe players' saved progress, which lives in WebView localStorage under that origin.
- **Never use "Tetris"** or any other game or brand name in store text.
- **TestFlight plays Google's TEST ads; the App Store build plays real ones.** `AdsService.swift` detects TestFlight (sandbox receipt) and switches units automatically, and also calls `critterAdTestMode` so testers get an ad after 1 game (then every 2, 30 s apart). Real ads barely fill before launch, and testers tapping real ads can get the AdMob account flagged. Nothing to change at release.

- **Android uses the shared rankings service, not Game Center.** `App.tsx` gives Android the services `board, store, ads, haptics, notify, share, app`; the page's `BOARD_CLIENT` talks to https://scores.woodinteractive.app (Cloudflare Worker + D1, code in `server/scores`). iPhone still uses Game Center until 1.1; its native code is untouched.
- **1.0 is live (approved 2 Nov 2026).** 1.0.1 (app.json version 1.0.1) fixes: iCloud-restore error screen, Settings › Done freezing the menu animals, the daily reminder when notifications are blocked (opens Settings), adds a ⭐ Rate button, and the 🎯 Today button's red dot now counts what's left (daily goal + Daily Stack) and disappears when both are done.

## 5. Build commands (Matt, PowerShell, in the project folder)

```
$env:EXPO_NO_CAPABILITY_SYNC="1"; npx.cmd eas-cli build -p ios --profile production
npx.cmd eas-cli submit -p ios --latest
$env:EXPO_NO_CAPABILITY_SYNC="1"; npx.cmd eas-cli credentials -p ios
```

Android (no capability switch needed):
```
npx.cmd eas-cli build -p android --profile production     # .aab for Google Play
npx.cmd eas-cli build -p android --profile android-test   # .apk for a phone or emulator
```

Build numbers auto-increment remotely. Build **16** was the first to pass with iCloud, on 6 October.

## 6. Where things stand (10 October 2026)

**Done and in the repo** (pushed up to commit `da37931` or later):
- Tester fixes:
  - The critter keeps falling while you hold it.
  - Flicks register at the edges of the board.
  - No iOS magnifier bubble on the board.
  - Next shows "Last one!" when the Daily Stack runs out.
  - Fever glow toned down and explained.
  - "Skip" link fixed.
  - Capitalization is Daily Stack, Critter Pen, Petting Zoo.
  - "How to play" wording everywhere.
  - The tutorial ends on the menu with Petting Zoo highlighted.
- **Name:** the Game Center nickname is used when signed in. A name box shows only when signed out, with a note that leaderboards need Game Center. There's no first-launch name screen.
- **Puzzles:** 62 puzzles in 6 chapters. 2 teach the basics; the other 60 were regenerated on a steep curve. Each is rated 1–5 paws (Easy, Medium, Tricky, Hard, Expert), measured by how often a sensible random player solves it. A yellow ✓ means it was solved without a hint. The generator is in Claude's old scratchpad only and isn't in the repo.
- **Lives:** solving a puzzle refunds its life. That's intended; Matt said keep it.
- **iCloud backup** is back on (entitlement plus `'cloud'` in `SERVICES`).

**Delivered as `critter-stack-turns.zip`.** Confirm with Matt that it's pushed and built:
- **Turns** (Critter Pen only), meant to drive revenue:
  - Everyone starts with 3.
  - Tap a tray critter twice to spend one. That critter is then unlocked and spins with each tap until it's placed. Frogs (O) can't turn.
  - When nothing fits as it's facing but a turned critter would, a **Stuck!** screen offers Use a turn, Get turns, ▶ Free turn (ad) and End game. It comes back if the player closes the store without a turn.
  - The ↻ chip next to the score opens the store.
  - Matt chose no per-game limit. Pay-to-win on the weekly Pen board is OK with him.
- **New purchases:** `com.critterstack.turns5` / `turns15` / `turns40` at $0.99 / $1.99 / $3.99, consumable. They're added to `StoreService.swift`. Their review screenshot is `store/iap-review-turns.png`.
- **Logo:** the menu logo auto-shrinks so "Critter / Stack" always stays on two lines.
- **Zoo previews:** each shape shows its 4 animals. Locked ones can be tapped to preview, and locked accessories preview too.

**Delivered as `critter-stack-ads-testflight.zip` (10 Oct):** TestFlight test ads (see §4). Also carries the logo shrink, Zoo previews and the Stuck!-returns-after-store fix, which were missing from GitHub `main`/build 18. Turns and its 3 purchases are live in build 18; all 14 purchases and Game Center are attached to 1.0.

**Still to do before release:**
1. Matt: create the 3 Turns purchases in App Store Connect, upload the review screenshot, and attach all **14** purchases to version 1.0.
2. Push the turns zip, build, and test in TestFlight:
   - Turns: buy, watch the ad, Stuck! screen.
   - iCloud: back up, delete the app, reinstall, restore.
   - Game Center nickname.
   - Zoo previews.
3. **Re-shoot the 6 App Store screenshots** from the new build, for iPhone 6.9″ and iPad 13″. The current set shows old UI (stars, "Rules"). Order: stack, stampede, leaderboards, zoo, golden, modes.
4. Matt: version page.
   - Game Center: tick it and attach all 8 leaderboards and 32 achievements. They go live with 1.0; no separate submission.
   - Paste the listing text from `store/app-store-listing.md`.
   - Age rating comes out 4+, answering yes to ads.
   - Add the App Review notes.
   - Copyright is "© 2026 Matthew Wood", or the LLC name if the account is under it.
5. Matt: re-upload the website if the support page changed. Use `woodinteractive-site-combined.zip`, the latest one with "turns" in the support FAQ.
6. Submit for review.

**1.0 is LIVE on the App Store (approved 2 Nov 2026, automatic release).** iPhone builds are allowed again.

**In the 1.1 bundle (2 Nov, not yet built):**
- **Menu animals froze after Settings (bug in 1.0).** The Done button kept the previous visit's close step (`fn:closeSettings` was read before it was reassigned), so it showed a stale copy of the menu whose animation had stopped, or did nothing on the first visit. Fixed with `fn:()=>closeSettings()`. Menu animations now also sleep while covered and wake in `showOverlay` (`liveCanvas`/`wakeCanvases`), not stopping for good after 10 s. Test: `tools/tparade.cjs`.
- **⭐ Rate Critter Stack** in Settings. It opens the App Store review page (`?action=write-review`) or Google Play, through the `app` service: `openURL` (store links only) and `openSettings` in App.tsx. iOS now also has `app`.
- **Notifications blocked:** native code answers `critterNotifyResult(false, "denied")` when only the phone's Settings can fix it. The game shows "Notifications are off" with an **Open Settings** button, not "No problem".
- Sound respects the Silent switch by design (Matt confirmed it works). A "play in Silent mode" option is a possible 1.1 extra.
- Still to add before shipping 1.1: switch the iPhone rankings to the shared board (add `'board'` for iOS, keep Game Center achievements), deploy `server/scores`, and update the iPhone App Privacy answers for the scores service.

**Android (started 22 Oct; Matt has no Android phone):**
- Done and tested:
  - Native module `modules/critter-native/android`: Play Billing 8 (consume packs, acknowledge unlocks, pending purchases, restore), AdMob + UMP (test ads until real Android units are set, also in debuggable and Firebase Test Lab builds), haptics, reminders (AlarmManager), share sheet, Play in-app review.
  - Config plugin `plugins/withCritterAndroid.js` (AdMob app ID, portrait on phones), adaptive icon, `android-test` APK profile.
  - Back button (`window.critterBack`), safe-area padding, Google Play wording.
  - Compiled with Gradle in an EAS sandbox (assembleRelease OK).
  - Browser tests: all 10 old tests, plus `tools/tandroid.mjs` (22 checks, including that iPhone never calls the board).
  - Rankings service tests: `server/scores/test/run.mjs`, 22 checks.
- Not yet run on a real Android device or emulator. EAS cloud simulators are waitlisted for this account, and the sandbox has no KVM. Use Play internal testing and the pre-launch report.
- Still to do:
  1. Deploy the rankings service (`server/scores/README.md`).
  2. Matt: AdMob Android app + 2 units, then put the IDs in `app.json` (`withCritterAndroid`) and `AdsService.kt`.
  3. Matt: Play Console organization account once the D-U-N-S arrives (`store/google-play-setup.md`).
  4. Android screenshots (≤2:1) and a 1024×500 feature graphic.
  5. Support page Android answers (Google account restore, Android backup, no Game Center).
  6. iPhone 1.1: switch rankings to the shared board (add `'board'`, drop Game Center leaderboards from the page path, keep achievements), and update the iPhone privacy labels for the scores service.

**Ideas parked for later (1.1+):**
- Home-screen widget. The Swift code exists, but it needs an app extension.
- In-game All Time leaderboard switch.
- Consider whether Turns should go in the Everything bundle.

## 7. Testing the game (no device needed)

`tools/` has a Playwright harness:
- `python3 tools/mktest.py` builds `tools/test.html` and `tools/test-rel.html` from the game, with a `window.__t` hook into game state: `cur`, `grid`, `tray`, `pen`, `PR`, `newGame`, `newPen`, `newLevel`, `place`, `openStore`, `showZoo` and more.
- Run tests from inside `tools/`, for example `node tsmoke.js`.
- Each test prints `ERR []` when there are no page errors.
- Useful tests: `tsmoke` (start/play), `twel` (first-run tutorial), `tflick` (flick drop), `tpaws` (replays all 62 puzzle solutions), `tturn` and `tstuck`/`tstuck2` (Turns), `tzoo`, `tname`, `tstore`.
- Synthetic `setPointerCapture` errors in tests are harmless.
- **Overlay buttons ignore clicks in the first ~300 ms** after they appear (misclick guard). Wait before clicking in tests.

After a change, also check `node --check` on the extracted `<script>` blocks.

## 8. Matt's preferences

- Plain-language steps. He's not a developer, but he's quick.
- He prefers being told exactly which button to click.
- He often sends notes from testers in batches. Fix them all, test, and deliver one zip.
- He wants revenue features: ads every 3 games after the first 8, reward ads (max 5 a day) and purchases.
- Recommend, then let him decide. Keep it short.
