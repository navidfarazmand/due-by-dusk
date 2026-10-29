# Due by Dusk mobile architecture (v0.8)

Landscape farm game: Gemini's v0.6.05 farm engine runs the harvest days; Claude's game shell runs everything around them. TypeScript + Vite + Capacitor 8. Android and iOS hold local web assets; no server is needed to play.

## Pieces

- `src/engine/gemini-engine.js`: Gemini's v0.6.05 bundle (Phaser shim, crops, characters, sounds, effects), formatted and patched. It draws the field on `#field`, keeps its own farm save (`dbd-farm-v3`) and exposes `window.__DBD_ENGINE` (state, bills, start day, pay, perks, tools, boss info). The shell talks to it only through that API and the `window.__dbdEvent` events (`dayStart`, `dayEnd`, `idle`, `billPaid`, `perks`, `cityWon`, `foreclosed`, `bossAppear`, `bossStomp`, `bossDown`). Gemini's developer studios and Arthur are removed. Its old `__DBD_TEST` hook exists only in dev and e2e builds.
- `src/game/`: pure game rules, no DOM, unit-tested.
  - `world.ts`: 7 countries, 30 cities in route order, trios, rivals. The last city of each country is its boss farm.
  - `plan.ts`: what each farm asks (`planFor`): bills and their schedule, crop health and value, field density, content unlocks, crops, the city record, par days, the boss.
  - `progress.ts`: the game save (`dbd-game-v3`): wins, stars, crowns, wallet, workshop, tools, ad counters, settings; country and city locks; stars.
  - `workshop.ts`: permanent upgrades; small ones are instant, bigger ones take time (one at a time).
  - `tools.ts`: sickle, scythe, flame weeder, seed blaster and their attachments; `toolStats` becomes `window.__DBD_TOOL` for the engine.
- `src/shell/`: the screens (menu, world and country maps, farmhouse, sundown, won and lost, modals), the farm HUD, rewarded offers, music, art lookup and layout scaling.
- `src/platform/`: native storage mirror, lifecycle, orientation, haptics and AdMob (rewarded ads only, with Google's consent message).

## Rules worth keeping

- One wallet. While a farm runs, the engine's cash is the wallet; between farms it lives in the game save. A foreclosure leaves the player with at most the money they came with; workshop levels and tools are kept.
- Bills keep their schedule: each bill is due its own number of days after the previous due date, so paying early never pulls the next bill closer.
- A boss farm's deed cannot be paid until its boss is knocked out. Boss health is set when the farm starts, from the player's strongest owned tool (`focusSec` seconds of steady hitting), and it carries over between days.
- Ads are never forced. Every reward (double a day, free coins, finish an upgrade, one more day) is a button the player can ignore, shown only while an ad is loaded, and granted only when AdMob reports the reward.
- A day is a transaction: an interrupted day replays from dawn (the engine saves its pre-day checkpoint).

## Verification and delivery

Run `npm ci`, `npm test`, `npm run build` and `npm run test:e2e` (five landscape sizes: the day loop, farmhouse layout on every tab, tools, the boss farm with a test ad, settings). `npm run build:pc` plus `node scripts/inline-html.mjs dist-pc Due-by-Dusk.html` makes one self-contained HTML for playing on a computer (with labelled test ads).

Keep generated builds, dependencies, local SDK paths, signing material and test output out of Git.

Navid authorizes pushing tested updates to this repository. Commit and push coherent, verified changes; record any untested native/device behavior honestly. Publishing to an app store is a separate release step.
