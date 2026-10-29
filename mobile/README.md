# Due by Dusk — mobile development v0.8.0

Landscape farm game: Gemini's farm engine for the harvest days, Claude's game around it, packaged with Vite and Capacitor 8. Use Node 22.12+ (Node 24 recommended).

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run mobile:sync
```

- [Architecture and game rules](ARCHITECTURE.md)
- [Android/iOS setup and native limitations](docs/mobile.md)
- [Release plan and remaining device/store work](docs/release-plan.md)

The game: 7 countries and 30 farms on one route, each farm a few days long with bills from Grumble & Sons. Win farms for stars and diamonds; stars and each country's boss open the next country. Between days, the farmhouse has the workshop, tools and attachments, perks and the bill list. Rewarded ads are optional: double a day, free coins, finish an upgrade now, or one more day on a bill you can't pay.

For a computer, `npm run build:pc` and `node scripts/inline-html.mjs dist-pc Due-by-Dusk.html` make one HTML file that opens straight from disk.

[Download the Android test APK](https://github.com/navidfarazmand/due-by-dusk/releases/download/android-v0.8.0/Due-by-Dusk-Test.apk). It installs as **Due by Dusk Test** alongside the old app. v0.8.0 starts a fresh game (the farm engine changed); older test saves stay untouched in their own storage.

Android test APKs are development builds from GitHub prereleases and CI artifacts, not Play Store releases. iOS requires a Mac and signing. Test builds show Google demo ads. No purchases, accounts or analytics. The Play app ID is `com.khoreh.duebydusk`; see the [release plan](docs/release-plan.md#google-play-and-admob-v072). Music and sound credits are in `licenses/README.md` and in the game under Settings → Credits.

Editable supplied character sources live in art/source. The original asset pipeline is archived in art/tools and references raw generated images that were not included in the supplied archive. Old bitmap textures are archived in art/legacy-textures; current game art is drawn in code.
