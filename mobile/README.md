# Due by Dusk — mobile development v0.11.0

Landscape farm game: Gemini's farm engine for the harvest days, Claude's game around it, packaged with Vite and Capacitor 8. Use Node 22.12+ (Node 24 recommended).

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run i18n:check
npm run mobile:sync
```

- [Architecture and game rules](ARCHITECTURE.md)
- [Android/iOS setup and native limitations](docs/mobile.md)
- [Release plan and remaining device/store work](docs/release-plan.md)

The game: 7 countries and 30 farms on one route. A farm is five to eight bills from Grumble & Sons, each due two days after the last (10 to 16 days of 25 seconds). The field starts with carrots only; every bill paid adds the next crop on the farm's ladder (radishes, the country's three, then staples), each worth more and tougher, and opens a chest with a perk for that farm. The chest's kind is rolled (mostly wooden early, mostly silver in the middle, always gold before the deed), and a rewarded ad can upgrade a closed chest once, up to a diamond chest: four gold perks, pick two. Win farms for stars, ribbons and diamonds; stars and each country's boss open the next country. A farm pays out once: a replay banks only what beats everything that farm has already paid you. Crops are tougher for a build ahead of the route and softer for one behind it (by the square root of the gap), so upgrades and tools pay off without running away from the bills. Between days, the farmhouse is a day card: the day, the bill coming up, the city's rival and one big Start button, with tiles for the bills, the perks, the upgrades (small steps: +4% damage a Blade level; every fifth level takes a while to build) and the tools. A new player starts with a short intro (a boss knocked out a few seconds before sunset) and then learns each mechanic by watching it happen on the real field: no rule screens. From the menu: the skill map (diamonds buy permanent skills, reset free), the daily farm (the same seeded farm, tool and upgrades for everyone, with bronze, silver and gold), duels (two players, one phone, the same field in turn) and the Bling Barn (looks only, bought with ribbons). Settings has separate volume sliders for the music and the sound effects, and Tracks picks the music for the field and the menus. The game speaks English, French, Spanish, Brazilian Portuguese and German: the phone's language when it is one of these, or the globe button on the menu. Rewarded ads are optional: double a day, free coins, finish an upgrade now, one more day on a bill you can't pay, a free ribbon, or another daily try.

For a computer, `npm run build:pc` and `node scripts/inline-html.mjs dist-pc Due-by-Dusk.html` make one HTML file that opens straight from disk.

[Download the Android test APK](https://github.com/navidfarazmand/due-by-dusk/releases/download/android-v0.11.0/Due-by-Dusk-Test.apk). It installs as **Due by Dusk Test** and updates earlier test builds in place; saves carry over. (v0.10 rebuilt the workshop and the farms: a save from before it keeps its farms, stars, ribbons and tools, gets its workshop upgrades refunded into savings, and starts its next farm fresh.)

Android test APKs are development builds from GitHub prereleases and CI artifacts, not Play Store releases. iOS requires a Mac and signing. Test builds show Google demo ads. No purchases, accounts or analytics. The Play app ID is `com.khoreh.duebydusk`; see the [release plan](docs/release-plan.md#google-play-and-admob-v072). Music and sound credits are in `licenses/README.md` and in the game under Settings → Credits.

Editable supplied character sources live in art/source. The original asset pipeline is archived in art/tools and references raw generated images that were not included in the supplied archive. Old bitmap textures are archived in art/legacy-textures; current game art is drawn in code.
