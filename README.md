# Due by Dusk

A farming game prototype. You sweep a scythe over crops, each crop sells the moment you cut it, and you must pay a chain of bills before their deadlines or the bank takes the farm.

Not published to any app store yet.

## Mobile development (v0.7.0)

The maintained TypeScript/Phaser/Capacitor project is now in [mobile/](mobile/). It continues the supplied v0.6.00 game. Landscape gameplay fills the screen; a gear button opens management and pauses an active harvest.

From mobile/, run npm ci, npm run dev, npm test and npm run build. See [architecture](mobile/ARCHITECTURE.md), [native setup](mobile/docs/mobile.md) and [release plan](mobile/docs/release-plan.md). GitHub Actions checks updates and builds a debug Android APK. The app has not been published to a store.

The original 2D/3D experiments below remain available as earlier prototypes.

## What is in this repo

- `2d/index.html`: the full 2D game. Nine bills, equipment shed upgrades, perks, heirlooms, and a save in the browser.
- `3d/index.html`: a one-day 3D test of the same idea, built with three.js r128.
- `models/`: free low-poly model packs by Quaternius (crops with growth stages, animated farm animals) for the next 3D version. See `models/README.md`.

## How to run

Open either `index.html` in a browser. Each game is one file with no build step. Both load their fonts from Google Fonts, and the 3D game loads three.js from cdnjs, so they need an internet connection.

If you later load the model files with `fetch` or a three.js loader, browsers block that on `file://`. Serve the folder instead, for example `python -m http.server`, then open `http://localhost:8000/3d/`.

## Notes for editing

Each game is a single HTML file: CSS in one `<style>` block and all game code in one `<script>`.

### 2D (`2d/index.html`)

- Drawn on a canvas. All sprites are painted in code, and sounds are synthesized with WebAudio.
- Data tables at the top of the script: `CROP`, `BILLS`, `UNLOCKS`, `SHED`, `ALMANAC`, `HEIRS`, `PERKS`.
- Player stats are computed in `stats()`. Costs are in `shedCost()` and `heirCost()`. Crop health rises by 8% of its base value each day (`hpMul()`).
- Save data is stored in `localStorage` under `due-by-dusk-v1`.

### 3D (`3d/index.html`)

- three.js r128, used through the global `THREE`. Every model is built in code from simple shapes, merged into a few meshes with vertex colors to keep draw calls low.
- Level settings: `LEVEL` (20 s day, $40 goal) and `CROPS`.
- Key functions: `makeLayout()` and `fitCamera()` for the wide and tall layouts, `buildWorld()` for the island, `applyLight()` and `drawBg()` for the sun, sky and night, `spawnCrop()`, `updateCrops()`, `swing()`, `harvest()`, `startDay()`, `endDay()`, and the main loop `frame()`.
- The pixel ratio adapts to keep the frame rate up (`adapt()`), and the fps chip shows the real frame rate. Settings are stored under `due-by-dusk-3d-settings` and the best day under `due-by-dusk-3d-best`.

### Both

- Lines that mention `window.claude` only matter inside the Claude artifact preview. Elsewhere they do nothing, so they can stay or be removed.

## Game rules (2D)

- Bills, in order, as amount and days to pay it: $20 in 3, $60 in 4, $180 in 4, $500 in 4, $1,300 in 4, $3,200 in 5, $8,500 in 5, $30,000 in 6, $90,000 in 7. Paying the last one (the deed) wins the farm.
- After each bill you pick one of three perks. Shed upgrades and perks last for the current farm only.
- Missing a deadline loses the farm and earns Grit, which buys heirlooms that carry over to every new farm.
- Grit for a farm = floor(total paid / 25) + 2 per bill paid + (days survived, which is the day number minus 1). Owning the farm adds 25.
- Shed upgrade cost = base x growth^level, lowered 5% per level of Cousin Dale's discount.

## Open to-dos

- Phones in landscape: make the header compact so the 3D stage fills a sideways screen. In the store app, lock the game to landscape.
- Replace the code-built 3D models with the packs in `models/`.
- Wrap the game for Android and iPhone (for example with Capacitor) once it is ready.
