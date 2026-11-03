# Critter Stack shared rankings

A small Cloudflare Worker with a D1 database at **https://scores.woodinteractive.app**. It keeps one worldwide board per mode and period that every platform shares:

| Board | Period | Notes |
|---|---|---|
| `daily` | each UTC day | best of 3 tries per phone |
| `classic` (Petting Zoo) | Monday 00:00 UTC to Monday | |
| `challenge` | weekly | |
| `puzzle` (Critter Pen) | weekly | |

- **Android** uses it from its first release.
- **iPhone** keeps Game Center until version 1.1 switches it over.

The game side is the "shared Critter Stack board" block in `web/critter-stack.html` (`BOARD_CLIENT`).

## What it stores

- A random id per phone, made by the game. It is not a hardware id or advertising id.
- A secret per phone, so nobody else can post as that phone.
- The name the player typed.
- The player's platform (ios or android).
- The best score per board.

Nothing else is stored. Finished boards are deleted after 60 days.

## Deploy (once). Easiest: ask Claude Code on the PC to do it

In the project folder, tell Claude Code: **"Deploy the rankings service by following server/scores/README.md."** You'll only need to click **Allow** in the browser when Cloudflare asks.

To do it by hand instead, run these in PowerShell:

```
cd "C:\Users\mwood\OneDrive\Claude App Code\critter-stack\server\scores"
npx.cmd wrangler login
npx.cmd wrangler d1 create critter-stack-scores
```

1. `wrangler login` opens a browser. Sign in to Cloudflare and click **Allow**.
2. `d1 create` prints a `database_id`. Paste it into `wrangler.toml`, replacing `REPLACE_WITH_DATABASE_ID`.
3. Then run:

```
npx.cmd wrangler d1 execute critter-stack-scores --remote --file=schema.sql
npx.cmd wrangler deploy
```

4. Check that it works: open https://scores.woodinteractive.app/v1/health. It should show `{"ok":true}`. The address can take a few minutes to start working after the first deploy.

## Updating later

After changing `src/index.js`, run `npx.cmd wrangler deploy` again. A schema change needs a new SQL file run with `d1 execute`. Never re-run `d1 create`.

## Tests (no Cloudflare needed)

```
node test/run.mjs
```

This runs the Worker against Node's built-in SQLite.

## Moderation

To hide a player with an offensive name or impossible scores, run this in the Cloudflare dashboard (**D1 › critter-stack-scores › Console**):

```
UPDATE players SET banned = 1 WHERE name = 'TheName';
```

## Cost

Workers and D1 free plans cover this easily: 100,000 requests a day, and 5 GB of storage.
