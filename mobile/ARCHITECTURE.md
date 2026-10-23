# Due by Dusk mobile architecture

The mobile project continues the supplied v0.6.00 game with TypeScript, Phaser 3 and Capacitor 8. It is landscape, with a full-width harvest field and a gear-operated management drawer. Android and iOS contain local web assets; a server connection is unnecessary during play.

## Entry and rendering

`src/main.ts` hydrates the local save cache from native Preferences before importing scenes, connects verified saves to ordered native writes, initializes the management drawer and lifecycle handlers, and starts Phaser. Fonts are installed locally.

Phaser runs timing and scenes on a hidden 1×1 canvas. The procedural Canvas2D renderer exclusively owns the visible `#field` canvas. Keeping the two separate prevents Phaser's render pass from clearing the field. The scenery and Arthur are original cartoon artwork in `src/rendering/cartoonWorld.ts`. Vegetable drawing functions remain unchanged; only their size and placement changed. Old bitmap panoramas and the Arthur atlas are archived under `art/legacy-textures` and are not shipped. The previous shim/fallback build is not a production path.

The bottom dock holds every gameplay counter and control outside the playable canvas. Tips use a separate strip above it. Android uses immersive system bars and cutout-safe control insets. The field coordinate system remains 640 logical units high. Width changes with its aspect ratio. Screen-to-world input uses the visible canvas bounds and scale; the adjustable finger offset is in CSS pixels. `fieldLayout.ts` keeps vegetables large in CSS pixels and reserves safe finger targets away from edges. Pixel ratio is capped at 2. Reduced effects also follows the operating system's reduced-motion preference.

## State and saving

- `src/types/game.ts`: state interfaces, schema v2.
- `src/data/`: canonical crops, geography, skills, bills, equipment and perks.
- `src/domain/economy.ts`: renderer-independent stats, upgrade costs, crop health and Grit formulas.
- `src/systems/SaveSystem.ts`: validation, migration, verified writes, rotating backups, recovery and observable storage failures.
- `src/platform/`: native lifecycle, landscape orientation, optional vibration and ordered Preferences persistence.
- `src/ui/`: management drawer and save warnings.
- `src/scenes/FarmScene.ts`: procedural art, current harvest state and gameplay UI. This remains a large legacy module; continue extracting focused systems as their behavior changes.

A day is a transaction. Before dawn, the farm is checkpointed. During an interrupted harvest, saving writes the checkpoint rather than partly earned cash. Closing/restarting replays that day from dawn; it never adds partial income twice. On successful sunset, the whole day and regional rewards commit. Opening management pauses play and closing it requires explicit Resume. Backgrounding saves and pauses; foregrounding never silently resumes the timer.

Completed farms grant exactly one permanent skill point; new games start at zero. Bills and city records grant none. Existing saved balances are preserved. Cash, equipment and perks belong to the current farm. Grit, heirlooms, learned skills, Diamonds and regional accomplishments persist across farms. Perk stacks are intentional. Migration must preserve them and must not refund old skills twice.

Imported JSON is untrusted data: validate state, escape text rendered in HTML, and never execute it. Unknown future schemas are not downgraded. Unrecoverable originals block autosave until explicit restore/reset, with a visible warning.

## Verification and delivery

Run `npm ci`, `npm test`, `npm run build`, and `npm run test:e2e`. The browser tests cover landscape sizes, drawer pause/resume, actual touch charge release, local assets and interrupted-day recovery. Use `npm run mobile:sync` before opening a native project. Device builds require the SDKs documented in `docs/mobile.md`.

Production builds do not expose the mutable `__DBD_TEST` harness. Development and the explicit `e2e` build mode do. Keep generated builds, dependencies, local SDK paths, signing material and test output out of Git.

Navid authorizes pushing tested updates to this repository. Commit and push coherent, verified changes; record any untested native/device behavior honestly. Publishing to an app store is a separate release step.
