# Due by Dusk mobile architecture (v0.9)

Landscape farm game: Gemini's v0.6.05 farm engine runs the harvest days; Claude's game shell runs everything around them. TypeScript + Vite + Capacitor 8. Android and iOS hold local web assets; no server is needed to play.

## Pieces

- `src/engine/gemini-engine.js`: Gemini's v0.6.05 bundle (Phaser shim, crops, characters, sounds, effects), formatted and patched. It draws the field on `#field`, keeps its own farm save (`dbd-farm-v3`) and exposes `window.__DBD_ENGINE` (state, bills, start day, pay, perks, tools, boss info). The shell talks to it only through that API and the `window.__dbdEvent` events (`dayStart`, `dayEnd`, `idle`, `billPaid`, `perks`, `cityWon`, `foreclosed`, `bossAppear`, `bossStomp`, `bossDown`). Gemini's developer studios and Arthur are removed. Its old `__DBD_TEST` hook exists only in dev and e2e builds.
- `src/game/`: pure game rules, no DOM, unit-tested.
  - `world.ts`: 7 countries, 30 cities in route order, trios, rivals. The last city of each country is its boss farm.
  - `plan.ts`: what each farm asks (`planFor`): bills and their schedule, crop health and value, field density, content unlocks, crops, the city record, par days, the boss.
  - `progress.ts`: the game save (`dbd-game-v3`): wins, stars, crowns, wallet, workshop, tools, skills, ribbons, looks, today's daily farm, ad counters, settings; country and city locks; stars. Older saves get ribbons for the stars, crowns and bosses they already have.
  - `workshop.ts`: permanent upgrades; small ones are instant, bigger ones take time (one at a time).
  - `tools.ts`: sickle, scythe, flame weeder, seed blaster and their attachments; `toolStats` becomes `window.__DBD_TOOL` for the engine.
  - `skills.ts`: the skill map. 19 of the engine's own skills (`hasSkill`) in four branches, bought with diamonds (one per farm won, two per boss farm, one per daily gold medal). Nodes stay in the clouds until a neighbour is learned; reset is free. The whole route earns exactly what every skill costs.
  - `flair.ts`: the Bling Barn, looks only (tool finish, swing trail, bird, coins), bought with ribbons. `lookFor` becomes `window.__DBD_LOOK`, which the engine reads when it draws.
  - `daily.ts`: the daily farm and duels. One-day side farms on a seeded field with a set loadout, medal targets, and the day's tries.
- `src/shell/`: the screens (menu, world and country maps, farmhouse, sundown, won and lost, modals; `extras.ts` for the skill map, Bling Barn, daily farm and duel), the farm HUD, rewarded offers, music (eight tracks, one picked for the field and one for the menus), the item and skill drawings (`looks.ts`), art lookup and layout scaling.
- `src/platform/`: native storage mirror, lifecycle, orientation, haptics and AdMob (rewarded ads only, with Google's consent message).

## Rules worth keeping

- One wallet. While a farm runs, the engine's cash is the wallet; between farms it lives in the game save. A foreclosure leaves the player with at most the money they came with; workshop levels and tools are kept.
- Bills keep their schedule: each bill is due its own number of days after the previous due date, so paying early never pulls the next bill closer.
- A boss farm's deed cannot be paid until its boss is knocked out. Boss health is set when the farm starts, from the player's strongest owned tool (`focusSec` seconds of steady hitting), and it carries over between days.
- Ads are never forced. Every reward (double a day, free coins, finish an upgrade, one more day) is a button the player can ignore, shown only while an ad is loaded, and granted only when AdMob reports the reward.
- A day is a transaction: an interrupted day replays from dawn (the engine saves its pre-day checkpoint).
- Side farms never touch the real farm. The daily farm and each duel turn take an engine `snapshot()`, switch saving off, seed the field (`setFieldSeed`: every crop, prop, crow and goat comes from its own seeded stream), drop skills and use the set loadout; at sunset the shell records the score and `restore()`s the snapshot, plan, tool, skills and sound. A daily try is counted when it starts, so quitting mid-day uses it up.
- The economy is tuned with a bot (`sim` scripts outside the repo): a bot playing at about Navid's speed clears the first farms without ads, needs replays from the fourth farm on without ads, and goes through first try with an ad after most days. Prices sit in `workshop.ts` and `tools.ts`, bill pressure in `plan.ts` (`CANADA_MUL`, `BILL_MUL`).

## Verification and delivery

Run `npm ci`, `npm test`, `npm run build` and `npm run test:e2e` (five landscape sizes: the day loop, farmhouse layout on every tab, tools, the boss farm with a test ad, settings, the skill map, the Bling Barn, a daily farm that must leave the real farm untouched, and a two-player duel). `npm run build:pc` plus `node scripts/inline-html.mjs dist-pc Due-by-Dusk.html` makes one self-contained HTML for playing on a computer (with labelled test ads).

Keep generated builds, dependencies, local SDK paths, signing material and test output out of Git.

Navid authorizes pushing tested updates to this repository. Commit and push coherent, verified changes; record any untested native/device behavior honestly. Publishing to an app store is a separate release step.
