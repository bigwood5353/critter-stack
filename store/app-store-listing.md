# Critter Stack: App Store listing

Paste these into App Store Connect › your app › App Store tab. Character limits are checked.
Live now: **1.0.1**. The metadata below is for the **next version (1.0.2)**; see "How to apply it" at the end.

| Field | Text | Length / limit |
|---|---|---|
| **Name** | Critter Stack: Block Puzzle | 27 / 30 |
| **Subtitle** | Cute animals, falling blocks | 28 / 30 |
| **Keywords** | `line,clear,drop,tile,brick,classic,stacker,brain,daily,relax,zoo,pet,cat,dog,frog,kawaii,offline` | 96 / 100 |
| **Primary category** | Games › Puzzle | |
| **Secondary category** | Games › Casual | |
| **Age rating** | 4+ (answer the questionnaire; see `app-privacy-labels.md`) | |

Was (1.0 – 1.0.1): Name "Critter Stack: Animal Puzzle", subtitle "Stack cute animals, clear rows", keywords
`block,blocks,falling,brain,daily,casual,relax,zoo,pets,frog,cat,dog,kawaii,drop,classic,family`.

**Why this changed**
- "Block puzzle" is the main search for this kind of game, and the old name and subtitle never said "block".
  The name counts most in Apple's search, then the subtitle, then the hidden keywords.
- Apple combines words across the name, subtitle and keywords of one localization, so this set covers
  "block puzzle", "falling blocks", "cute block puzzle", "animal block puzzle", "brick puzzle", "line clear",
  "block stacker", "classic block puzzle" and similar.

**Keyword rules**
- Words in the name and subtitle are already indexed, so don't repeat them in keywords:
  critter, stack, block(s), puzzle, cute, animal(s), falling.
- Singular only (Apple matches plurals); commas with no spaces.
- **Never use "Tetris"** or any other game, brand or company name in any field, including keywords
  (App Review Guideline 2.3.7). The Tetris Company enforces its trademark.

## Spanish (Mexico) localization: a second keyword field for US search

ASO tools report that the US App Store also indexes the **Spanish (Mexico)** localization. Adding it gives
another 100 characters of keywords that count in US searches. Words only combine *within* one localization,
so each field holds complete terms.

| Field | Text | Length / limit |
|---|---|---|
| **Name** | Critter Stack: Block Puzzle | 27 / 30 |
| **Subtitle** | Rompecabezas de animales | 24 / 30 |
| **Keywords** | `tetromino,grid,fit,row,retro,arcade,shape,piece,square,board,cozy,fun,logic,bloques,juego,lineas` | 96 / 100 |

- The subtitle and the last three keywords are Spanish ("animal puzzle", "blocks", "game", "lines") for players in Mexico; the rest are extra English terms for US search.
- Description, promotional text and screenshots: copy the English ones. Mexican players currently see the
  English listing anyway.
- "Tetromino" is a geometry word (a shape made of four squares), not a trademark. Remove it if you'd rather
  stay clear of anything near Tetris.

## Promotional text (170 max · can be changed anytime without a new build)

> New every day: the Daily Stack gives everyone in the world the same 100 critters. Three tries, no skips, pure skill. Can you make the podium?

Promotional text isn't used for search, so it stays about the daily race.

## Description (4,000 max)

Only the first line changed. Apple doesn't search the description, but its AI-generated App Store tags read it,
so the opening says what the game is.

> A cozy block puzzle where every falling piece is a cute animal!
>
> In Critter Stack, every falling shape is a glossy little animal striking a pose: a stretchy dachshund, a sitting frog, a loafing cat, a slithering snake, a pouncing fox, a giraffe with its head in the clouds and a tail-slapping whale. Fill a row and they happily run home. Clear four rows at once and it's a STAMPEDE!
>
> THE DAILY STACK
> Every day at midnight UTC, the whole world gets the same 100 critters. You get three tries and no skips or undos: just skill. Climb the Game Center leaderboard, and if you finish in the top 3 you win tokens and a permanent medal for your nameplate.
>
> FIVE WAYS TO PLAY
> • Petting Zoo: relax and stack as long as you like
> • Challenge: the speed ramps up every 20 seconds
> • Daily Stack: one shared puzzle for everyone, every day
> • Critter Pen: drag three critters into an 8×8 pen and clear rows or columns (spend a Turn to spin one)
> • Puzzles: 62 brain-teasers across six chapters, rated Easy to Expert, with hints
>
> GROW YOUR ZOO
> Every critter you send home counts. Unlock 21 more animals, from a panda and a penguin to a llama, a flamingo and even a dinosaur, then dress them up in party hats, shades, bow ties, crowns, flower crowns, pirate hats, wizard hats and an oversized cowboy hat.
>
> ALWAYS SOMETHING TO CHASE
> • Rare golden critters worth huge bonuses
> • Buddy bonuses when matching animals land side by side
> • 32 stickers to collect, plus Game Center achievements
> • Daily goals and play streaks
> • Weekly leaderboards for the Petting Zoo, Challenge and the Critter Pen
>
> MADE TO FEEL GOOD
> Squishy landings, nervous critters when the stack gets high, sleepy ones that doze off, happy little sounds and gentle haptics. Choose a wooden-pen, garden-hedge or candy-rope frame, and paw-print landing guides. Plays great offline, on iPhone and iPad, with iCloud backup so your zoo follows you to a new device.
>
> Free to play, with optional ads. Every game uses a life; you hold up to 5 and one comes back every 20 minutes, and your first Daily Stack try each day is free. Watch a short ad for a life, or grab a refill, an hour of unlimited play, the ad-free upgrade, the whole zoo, or extra skips, undos and turns in the store. Restore purchases anytime.
>
> Privacy policy: https://woodinteractive.app/critter-stack/privacy
> Terms of use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

## What's New (1.0.2)

Fill in once the 1.0.2 changes are known. If 1.0.2 is only the listing update plus small fixes:

> Bug fixes and smoother performance. Thanks for playing Critter Stack! If you're enjoying it, a rating really helps.

## Screenshots and previews

Files: `store/critter-stack-store-screenshots/` (iPhone 6.3″ required, iPhone 6.9″, iPad 13″, plus an app preview
video for iPhone 886 × 1920 and iPad 1200 × 1600). Upload in this order; only the first three show in search results.

| # | File | Caption now | Caption for 1.0.2 |
|---|---|---|---|
| 1 | `…-1-stack` | Stack the cutest critters | **The cutest block puzzle** |
| 2 | `…-2-stampede` | Clear rows, send them home | **Clear lines, send them home** |
| 3 | `…-3-leaderboards` | Race the world every day | (keep) |
| 4 | `…-4-zoo` | Grow your own zoo | (keep) |
| 5 | `…-5-golden` | Chase golden critters | (keep) |
| 6 | `…-6-modes` | Puzzles, dailies & more | **Block puzzles, dailies & more** |

- Captions are part of the images, so the new ones need the screenshots re-rendered at the same sizes
  (6.3″ 1206 × 2622, 6.9″ 1320 × 2868, iPad 13″ 2064 × 2752).
- Apple's AI tags appear to read screenshots, so "block puzzle" in a caption helps the app get tagged for
  that search.
- Keep the game's own look: animal pieces, wooden pen, paw prints. Don't make screenshots resemble Tetris
  (its colors, layout or logo).

## How to apply it in the next version (1.0.2)

Name, subtitle, keywords, description and screenshots can only change when you submit a new version.
Promotional text can change any time.

**A. Before you start**
1. Have the 1.0.2 build ready (build it as usual with `$env:EXPO_NO_CAPABILITY_SYNC="1"; npx.cmd eas-cli build -p ios --profile production`,
   then `npx.cmd eas-cli submit -p ios --latest`). Bump `version` in `app.json` to `1.0.2` first.
   If there are no code changes yet, the listing can still ship with the next build you make for any reason.
2. Re-render screenshots 1, 2 and 6 with the new captions (optional but recommended).

**B. Create the version**
1. App Store Connect › **Apps** › **Critter Stack**.
2. In the left sidebar, click **+** next to **iOS App** and enter **1.0.2**.

**C. Update the English (U.S.) listing** (version page, with **English (U.S.)** chosen at the top right)
1. **App Information** (left sidebar, under General): change **Name** to `Critter Stack: Block Puzzle` and
   **Subtitle** to `Cute animals, falling blocks`. Set **Secondary category** to **Casual**. Save.
   These fields belong to the app but are only sent with the next version.
2. Back on the **1.0.2** page:
   - **Keywords:** paste `line,clear,drop,tile,brick,classic,stacker,brain,daily,relax,zoo,pet,cat,dog,frog,kawaii,offline`.
   - **Description:** change the first line to `A cozy block puzzle where every falling piece is a cute animal!`.
   - **What's New:** paste the text above.
   - **Previews and Screenshots:** for iPhone 6.3″, iPhone 6.9″ and iPad 13″, delete the old images 1, 2 and 6
     and drag in the re-rendered ones, keeping the order. Keep the app preview videos in the first slot.

**D. Add the Spanish (Mexico) localization**
1. Version page › language menu at the top right (it shows **English (U.S.)**) › **Add Language** ›
   **Spanish (Mexico)**.
2. With Spanish (Mexico) selected: **App Information** › Name `Critter Stack: Block Puzzle`, Subtitle
   `Rompecabezas de animales`. Save.
3. On the 1.0.2 page, still in Spanish (Mexico):
   - **Keywords:** `tetromino,grid,fit,row,retro,arcade,shape,piece,square,board,cozy,fun,logic,bloques,juego,lineas`
   - **Description**, **Promotional Text**, **What's New:** paste the English text.
   - **Screenshots:** upload the same English images (or choose "Use English (U.S.) screenshots" if offered).
   - **Support URL / Marketing URL:** same as English.
4. The privacy policy URL is set once under **App Privacy** and covers all languages.

**E. Attach the build and submit**
1. **Build** › **Add Build** › choose **1.0.2** (the newest number).
2. **Version Release:** automatic or manual.
3. **Add for Review** › **Submit to App Review**.

**F. After it's live**
1. App Store Connect › **App Store** › **App Tags** (or the tags section of the version page): remove any tag
   Apple assigned that doesn't fit, e.g. anything about trivia, word games or kids.
2. Search the App Store (on a phone signed in to a US account, a day or two after release) for
   "block puzzle", "cute block puzzle", "animal block puzzle" and "falling blocks". Expect the longer phrases
   first; the short "block puzzle" only rises with downloads and ratings.
3. Don't change the keywords again for at least 2–3 weeks: ranking takes time to settle, and Analytics
   lags 1–2 days.

## Other fields

- **Support URL:** https://woodinteractive.app/critter-stack/support
- **Marketing URL:** https://woodinteractive.app
- **Privacy Policy URL:** https://woodinteractive.app/critter-stack/privacy
- **Copyright:** © 2026 Matthew Wood
- **App Review contact and notes:** see section 7 of the app README. No sign-in is needed, so leave "Sign-in required" unchecked.
- **Price:** Free. In-app purchases: new ones (e.g. the Turns packs) must be attached to a version the first time they're submitted.
