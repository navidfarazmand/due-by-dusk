# Handoff (10 Nov 2026, 0.13 built on a branch)

Where Due by Dusk stands, for the next session. Navid's live checklist is `docs/next-version.md`; the rules of the
game are in `ARCHITECTURE.md`.

## Released

| Version | versionCode | What | Play release run |
|---|---|---|---|
| 0.12.0 | 1107 | Bills 2-3-4-5 days, 15 s days, a crop a morning, bills from bots, boss moves, thief crows, late fees, power meter, Arthur, Canada's city looks | 7 |
| 0.12.1 | 1108 | Navid's test of 0.12: Sundown shows the money and opens Upgrades, late-day row, power meter fills one way and more often, sun dial plate, events in each city's weather, free coins = half a day of this farm | 8 |
| 0.12.3 | 1110 (check) | The upgrade tree in the game: 22 nodes to buy, a free reset | 10 (started at hand-off) |
| 0.12.2 | 1109 (check) | Option B: the leftover after a deed is banked as savings (upgrades and tools only, only above the farm's mark) | 9 (started at hand-off; confirm its "Send the bundle to Play Console" step) |
| 0.12.4 | (check) | The power chip stays the power meter; a little fewer crops | (check) |
| 0.13.0 | not released | The upgrade tree is the one upgrade system; diamonds retired | branch `claude/tree-013`, to review and merge |

Branch: `claude/loving-albattani-8c25qm` (every release so far is built from it). Release: run the GitHub workflow
`release-aab.yml` on that branch with upload "closed testing (roll out)"; versionCode is 1100 + the run number.
Bump `package.json`, `package-lock.json`, `android/app/build.gradle` (versionName) and `release-notes/whatsnew-en-US`
(under 500 characters) first.

## Waiting for Navid

- **0.13 is built on the branch `claude/tree-013`, not released**: review it, then merge it into the release branch
  (`claude/loving-albattani-8c25qm`) and run the release workflow. Nothing was tagged, released or run.
- Things in 0.13 he may want different (all easy to change, `src/game/tree.ts`):
  - A diamond is worth $1,000 of tree credit (`DIAMOND_CREDIT`), the same on every farm: generous on the first
    farms, small in Japan. A daily gold medal pays it once a day, with no end.
  - A keystone takes 30 minutes to build (`KEY_BUILD_MS`, the Workshop's longest build).
  - Quicker hands opens from Wider swing, Lucky clover from Sharper blade, Longer days from Richer soil (the tree's
    shape). A level an older save already has stays open.
  - A reset gives the level tracks back too. So a farm's crop toughness follows the highest track levels a player
    has had (`g.peak`), or a reset before each farm would soften its crops.
  - The tricks' prices are still the first guess (by ring: $20, $200, $800, $3,000, $12,000, $50,000, and $300,000
    for a keystone); no bot has played with tricks owned.
- Difficulty: his last test ran on a Kelowna farm started in 0.11 (old bill days, $1,338 of savings), so it said
  nothing about 0.12's bills. Ask him to try a farm started fresh (Austin), without free coins.

## The upgrade tree (0.13, built 10 Nov)

`src/game/tree.ts` holds the whole tree: 103 nodes (the toolbox, 8 level tracks, 76 tricks, 12 keystones, 6 bridges),
each with its branch, icon name, effect, levels, prices, the nodes that open it and its place on the map.
`docs/tree/map-template.html` is the design page Navid approved ("tree is a yes").

It is the game's one upgrade system now:

- **Tracks**: the Workshop's seven level tracks are bought in the tree at the Workshop's own prices, caps and build
  times (`TREE_WORKSHOP`, `src/game/workshop.ts`; the bills are tuned against them). Their levels are still
  `workshop.levels`, so old saves keep them and nothing is counted twice. Power cell is the tree's own track.
- **Screen** (`src/shell/treeview.ts`): the farmhouse's Upgrades tile, the panel's Upgrades tab, Sundown's Upgrades
  button and the menu's Barn open it. Centred on the toolbox; nodes that can be bought now have a gold ring and a
  "+"; the toolbox's card lists them; a node's card has one big Buy button with the price. The tile's badge counts
  what can be bought now.
- **Money**: tree credit first, then savings, then the farm's cash above its mark. Savings never pay a bill.
- **Long builds**: every fifth level of a track and every keystone, one at a time, in the Workshop's job
  (`workshop.job`), with the rewarded "Finish now" while an ad is loaded.
- **Reset**: free, two taps; everything paid comes back as tree credit (`treeSpent` is the ledger).
- **Diamonds are retired** (`migrateSkills`, once per save, `treeV`): a learned skill becomes its node (Retained
  counsel and Compound reserve at level 3, which is what the skills did; Reaper's verdict also gives Storm rod and
  Chain lightning, its old lightning); every other diamond (unspent, or spent on one of the seven plain stat skills,
  which have no node) becomes $1,000 of tree credit. A first win pays $1,000 of credit, a boss farm $2,000, the
  day's first daily gold $1,000. The skill map, the Workshop list and every diamond on screen are gone ("a diamond
  chest" stays: it is a chest, not the currency).
- **Tricks**: 84 of the 102 nodes besides the toolbox work. The engine reads a node's level with `tfx('<id>')`
  (`window.__DBD_TREEFX`), and each effect text says what the code does. To make another one work: add its effect in
  the engine with `tfx('<id>')`, its id to `TREE_NEW_LIVE`, and a line in the trick tests (`tests/e2e/game.spec.ts`,
  "tree tricks"). The 18 that still say "Coming soon":
  - need something the engine does not have: Twin blade and Wide arc (a swing has no arc: it hits a whole circle),
    Boomerang, Ricochet and Orbit (new things to draw and move), Goat army (one goat only), Sheepdog and Goat treats
    (no herding, and a calm goat has no timer), Clean cut (crops come up at random places), Overcharge (the power
    fires by itself when the meter is full);
  - would break a standing rule or a screen: Futures (a bill is paid on its evening, never earlier), Seed vault (the
    day card names the morning's crop), Almanac and Rain dance (the day's event card states its numbers), Deal of
    the day (needs a daily pick and its mark in the tree);
  - not worth what they cost as written: Green thumb (crops ripen in 0.4 s by themselves), Quickdraw (a free swing
    on reaching a crop can be farmed by wiggling), Deep roots (20% bigger crops also change what a swing reaches).
- All of it is translated (fr, es, pt, de): `npm run i18n:check` for the screen's texts, a unit test for the 103
  names and effects and the words the tricks draw on the field.

## Next work, in this order

1. Bots with the tree: `scripts/bots.mjs` plays on-track builds of track levels only. Give the bots tricks, then
   set the tricks' prices (and see whether Early bird, Harvest moon, Bulk order and First of the day pay too well).
2. The 18 nodes that say "Coming soon" (above).
3. Perks with 5 levels (a perk can come back as its next level); crop levels that never reset.
4. A tool shop and the seed album (see the 0.12 choices page: https://claude.ai/artifact/U3PTtWms8LHpEti34e7QVH).
5. Measure the later countries' bills again (only one bot run of four days on six farms so far; see below).

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

`npm test` (70 unit tests), `npm run i18n:check` (fr, es, pt, de complete), `npx tsc --noEmit -p .`,
`node --check` on a `.mjs` copy of the engine, and the e2e suite (45 tests on each of five screen sizes, about 20
minutes): `npx playwright test -c pw.local.config.ts` here, or against a frozen build with
`DBD_BASE_URL=http://127.0.0.1:5187 DBD_SKIP_SERVER=1`. Don't edit `src` while the dev server serves a full run.

## Loose ends

- Art: Canada's six skyline bands come from `art/source/bands/gen.mjs` (one row a city). The art agent was unsure about
  Saskatoon's Bessborough (drawn as a generic château, copper roofs) and Toronto's City Hall (small, at the dial's
  edge on wide phones).
- Weather and landmarks exist for Canada only; other countries use their country band and a clear field
  (`src/game/citylook.ts` takes a row per city).
- Arthur's faint falls sideways rather than backwards (`src/shell/arthur-art.js`).
- khoreh.com (repo navidfarazmand/khoreh, branch `claude/game-pages`, merged to main and live) needs nothing.
