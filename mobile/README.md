# Due by Dusk — mobile development v0.12.0

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

The game: 7 countries and 30 farms on one route. A farm is five to eight bills from Grumble & Sons: the first is due in 2 days, the next in 3, then 4, then 5 days each (19 days in Canada, up to 34 on Japan's boss farm). Days are 15 seconds at first; Longer days and skills add up to about 15 more. The field starts with carrots only; every morning adds the next crop on the farm's ladder (radishes, the country's three, then staples), each worth more and tougher, and the day card names it. Every bill paid opens a chest with a perk for that farm. The chest's kind is rolled (mostly wooden early, mostly silver in the middle, always gold before the deed), and a rewarded ad can upgrade a closed chest once, up to a diamond chest: four gold perks, pick two. Win farms for stars, ribbons and diamonds; stars and each country's boss open the next country. One money: the farm's cash pays the bills and buys the upgrades, and nothing carries to the next farm (so replaying an easy farm can't buy upgrades); a farm pays out once. A bill you can't pay on its night can go late, up to three days, each with an ad: Grumble & Sons take 20%, then 40%, then 60% of that day's earnings, and after the third the bank takes the farm. Thief crows steal from the jar on every farm; swipe one before it flies off to get the coins back. Each country's boss eats the best crops, is armoured except right after it eats (hit it then and it spits the coins back), throws bomb seeds and calls a storm that freezes, buries or bogs down crops. Crops are tougher for a build ahead of the route and softer for one behind it (by the square root of the gap), so upgrades and tools pay off without running away from the bills. Between days, the farmhouse is a day card: the day, the bill coming up, the city's rival and one big Start button, with tiles for the bills, the perks, the upgrades (small steps: +4% damage a Blade level; every fifth level takes a while to build) and the tools. A new player starts on Level 0, a practice farm whose sun waits while each step is done (cut, the jar, a chain); on real farms, anything new holds the field with a short card until a tap. Settings replays the practice farm and the intro film (a boss knocked out a few seconds before sunset). From the menu: the skill map (diamonds buy permanent skills, reset free), the daily farm (the same seeded farm, tool and upgrades for everyone, with bronze, silver and gold), duels (two players, one phone, the same field in turn) and the Bling Barn (looks only, bought with ribbons). The menu is a signpost: Play goes straight to your farm's day card; the plank above it opens the world map; signs lead to the daily farm, duels and the Barn (skills, Bling Barn). The pause card has music and sound switches and Back to menu. The power meter beside the sun dial fills as you cut, faster with a chain; when it's full, the tool's own power fires (the sickle's Cleave, the scythe's Whirlwind, the flame weeder's Fire wave, the seed blaster's Seed storm) with a Harvest Rush. The Power booster attachment fills it faster. Arthur Grumble, the banker, watches from the top of the screen: he gloats when you're short on a bill's last day, fumes when you have the money and sulks after you pay. Each city has its own look from one table (src/game/citylook.ts): Gatineau's autumn leaves, snow in Charlottetown, Toronto and Saskatoon, a clear field in Leamington and Kelowna. Settings has the language and separate volume sliders for the music and the sound effects, a finger offset slider that lifts the sickle above the finger so it doesn't hide the crops (Off cuts right under the finger), and Tracks picks the music for the field and the menus. The game speaks English, French, Spanish, Brazilian Portuguese and German: the phone's language when it is one of these, or Settings → Language. Rewarded ads are optional: double a day, free coins, finish an upgrade now, a late day on a bill you can't pay, a free ribbon, or another daily try.

For a computer, `npm run build:pc` and `node scripts/inline-html.mjs dist-pc Due-by-Dusk.html` make one HTML file that opens straight from disk.

[Download the Android test APK](https://github.com/navidfarazmand/due-by-dusk/releases/download/android-v0.11.0/Due-by-Dusk-Test.apk). It installs as **Due by Dusk Test** and updates earlier test builds in place; saves carry over. (v0.10 rebuilt the workshop and the farms: a save from before it keeps its farms, stars, ribbons and tools, gets its workshop upgrades refunded into savings, and starts its next farm fresh.)

Android test APKs are development builds from GitHub prereleases and CI artifacts, not Play Store releases. iOS requires a Mac and signing. Test builds show Google demo ads. No purchases, accounts or analytics. The Play app ID is `com.khoreh.duebydusk`; see the [release plan](docs/release-plan.md#google-play-and-admob-v072). Music and sound credits are in `licenses/README.md` and in the game under Settings → Credits.

Editable supplied character sources live in art/source. The original asset pipeline is archived in art/tools and references raw generated images that were not included in the supplied archive. Old bitmap textures are archived in art/legacy-textures; current game art is drawn in code.

## Copyright

Copyright (c) 2026 Navid Farazmand. All rights reserved. No use, copying or modification without written permission; see [LICENSE](../LICENSE). Credited third-party music, fonts and packages keep their own licences.
