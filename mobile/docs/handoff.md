# Handoff (5 Nov 2026, after 0.12.2)

Where Due by Dusk stands, for the next session. Navid's live checklist is `docs/next-version.md`; the rules of the
game are in `ARCHITECTURE.md`.

## Released

| Version | versionCode | What | Play release run |
|---|---|---|---|
| 0.12.0 | 1107 | Bills 2-3-4-5 days, 15 s days, a crop a morning, bills from bots, boss moves, thief crows, late fees, power meter, Arthur, Canada's city looks | 7 |
| 0.12.1 | 1108 | Navid's test of 0.12: Sundown shows the money and opens Upgrades, late-day row, power meter fills one way and more often, sun dial plate, events in each city's weather, free coins = half a day of this farm | 8 |
| 0.12.2 | 1109 (check) | Option B: the leftover after a deed is banked as savings (upgrades and tools only, only above the farm's mark) | 9 (started at hand-off; confirm its "Send the bundle to Play Console" step) |

Branch: `claude/loving-albattani-8c25qm` (every release so far is built from it). Release: run the GitHub workflow
`release-aab.yml` on that branch with upload "closed testing (roll out)"; versionCode is 1100 + the run number.
Bump `package.json`, `package-lock.json`, `android/app/build.gradle` (versionName) and `release-notes/whatsnew-en-US`
(under 500 characters) first.

## Waiting for Navid

- **The 0.13 upgrade tree**: https://claude.ai/artifact/7t59cN7bWpBkviWoQnjKLF. One tree bought with cash, six branches
  (Blade, Power, Reach, Field, Market, Rancher); the Workshop's level tracks are the trunks (they keep power in step
  with the bills to Japan); unique tricks hang off them; two keystones per branch, one of each pair; bridges between
  branches; free reset into tree credit (buys nodes only). He has not answered "Tree: yes or what to change" yet.
  Option B (the money question on that page) is done: savings are the tree credit to be.
- Difficulty: his last test ran on a Kelowna farm started in 0.11 (old bill days, $1,338 of savings), so it said
  nothing about 0.12's bills. Ask him to try a farm started fresh (Austin), without free coins.

## The tree's design (done, 5 Nov)

`src/game/tree.ts` holds the whole tree: 103 nodes (the toolbox, 8 level tracks, 76 tricks, 12 keystones, 6 bridges),
each with its branch, icon name, effect, levels, prices (a first guess), the nodes that open it and its place on the
map. `docs/tree/map-template.html` is the map page (minimal line icons drawn in code); the published page is built
from the template with the data bundled in (esbuild an entry that sets `window.DBD_TREE = { TREE, BRANCHES }` and
put it where the template says `/*TREE_DATA*/`).

In the game (on the branch, not released yet): the skill map has a "See the 0.13 tree" button that opens the whole
map (`src/shell/treeview.ts`, icons in `treeglyphs.ts`): it scrolls and zooms, and a card shows the chosen node.
Level tracks show the player's Workshop levels (bought in the farmhouse, `TREE_WORKSHOP`). Nodes can be bought in
the tree with savings, then farm cash above the farm's mark (the shell's `spend`, the same as upgrades): the 12 tricks
that are today's diamond skills (`TREE_SKILL`; owning either gives the effect) and 10 new tricks the engine does
through `window.__DBD_TREEFX` / `tfx(id)` (`TREE_NEW_LIVE`: Power cell, Big power, Chain fuel, Long rush, Spark start,
Rooster, Keen edge, Golden soil, Deed discount, Scarecrow). A node opens when a neighbour is owned; a keystone is not
sold if its partner is owned. The other nodes say "Coming in 0.13": to make one work, add its effect in the engine
with `tfx('<id>')` and its id to `TREE_NEW_LIVE`. Still to do: a tree reset (refund as tree credit), long builds for
keystones and every fifth level, moving the Workshop tracks and the diamond skills fully into the tree (retire
diamonds), translations of the node names and effects, bot-tuned prices.

## Next work (0.13), in this order

1. The upgrade tree once Navid says yes: merge `src/game/workshop.ts` (tracks) and `src/game/skills.ts` (diamond
   skills, most already implemented in the engine via `hasSkill`) into one tree; nodes cost cash (savings first,
   then farm cash above the mark, as upgrades do now); long builds with an ad to finish; reset refunds tree credit.
   Testers' learned skills become owned nodes; unspent diamonds become credit. New tricks need engine work
   (`src/engine/gemini-engine.js`, see `firePower`, `harvest`, `hitCrop`, `updateVortexes` for the patterns).
2. Perks with 5 levels (a perk can come back as its next level); crop levels that never reset.
3. A tool shop and the seed album (see the 0.12 choices page: https://claude.ai/artifact/U3PTtWms8LHpEti34e7QVH).
4. Measure the later countries' bills again (only one bot run of four days on six farms so far; see below).

## How the bills are tuned

`scripts/bots.mjs` plays real days with three bot players (strong, average, weak) on on-track builds, through the
dev hook `window.__DBD_BOT`. Run it against a frozen e2e build so `src` can change meanwhile:

```
npx vite build --mode e2e --outDir /tmp/bots-build && (cd /tmp/bots-build && python3 -m http.server 5180 &)
DBD_URL=http://127.0.0.1:5180 BOTS_OUT=/tmp/bots.json node scripts/bots.mjs 0,1,2 1,2,3,5,8,12,19 2
```

A full Canada + USA run (9 farms, 7 days, 2 runs, 3 players) takes about 90 minutes; background jobs stop at their
time limit, so give them a long one. `src/game/plan.ts` turns the average bot's days into bills: `DAY_SHAPES` (an
average day by day of the farm), `AVG_POINTS` (its size per farm against `dayRef`), `BILL_OVER` (half a best day on
top), `BILL_CLIMB`, `RECORD_DAYS` (the rival's record). Navid's target: weak can't pay even with an ad, average pays
with one ad, a computer-strong player needs none. With each farm's settled days, 40 of 47 Canadian and US bills met
all three; the misses are the boss farms (bills 15% lighter to leave time for the boss) and one at Des Moines.

## Checks

`npm test` (61 unit tests), `npm run i18n:check` (fr, es, pt, de complete), `npx tsc --noEmit -p .`,
`node --check` on a `.mjs` copy of the engine, and the e2e suite (170 tests, five screen sizes, about 15 minutes):
`npx playwright test -c pw.local.config.ts` here, or against a frozen build with
`DBD_BASE_URL=http://127.0.0.1:5187 DBD_SKIP_SERVER=1`.

## Loose ends

- Art: Canada's six skyline bands come from `art/source/bands/gen.mjs` (one row a city). The art agent was unsure about
  Saskatoon's Bessborough (drawn as a generic château, copper roofs) and Toronto's City Hall (small, at the dial's
  edge on wide phones).
- Weather and landmarks exist for Canada only; other countries use their country band and a clear field
  (`src/game/citylook.ts` takes a row per city).
- Arthur's faint falls sideways rather than backwards (`src/shell/arthur-art.js`).
- khoreh.com (repo navidfarazmand/khoreh, branch `claude/game-pages`, merged to main and live) needs nothing.
