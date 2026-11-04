# Version checklist

Navid's list for the next Play release. 0.11.2 went to closed testing on 3 Nov 2026 with everything ticked below; the
open items carry over to 0.11.3. Claude ticks items as they land and says when it is enough for a version;
then it bumps the version and runs the Play release (closed testing).

- [x] New rooster crow: "Cartoon Rooster Sounds" by DRAGON-STUDIO (Pixabay Content License, free for commercial use),
      loudness-matched, credited in Settings → Credits and licenses/README.md.
- [x] "A new version is ready" pop-up: when Play has a newer version, a pop-up on a menu screen (never during a day,
      once per launch) asks the player to update; "Update now" uses Google Play's in-app update
      (@capawesome/capacitor-app-update 8.1.1). Only the Play app sees it, not GitHub test APKs.
- [x] Report a problem: one strong shake (one jolt above ~26 m/s², then quiet for 4 s) or Settings → Report a problem
      opens a short report (the player's words plus version, device, screen, where they were, recent errors); a day
      pauses. Settings → "Shake to report a problem" turns the shake off.
      - [x] Reports go to info@khoreh.com (the phone's email app opens with the report filled in); from 0.12 to bugs@khoreh.com.
- [x] New app icon and splash: concept A kept simple (Navid's pick): the carrot's face only, no hands, no sickle, no
      extra tooth, no sparkle. Android (legacy, round, adaptive foreground), iOS icon, all splash screens. Sources in
      art/source/app-icon.svg and app-icon-foreground.svg. The Play Store listing icon is uploaded by hand:
      docs/store/play-icon-512.png (Play Console → Grow users → Store presence → Main store listing → App icon).
- [ ] Country looks for the other six countries, once Navid approves Canada's snow (USA dust, Brazil rain and mud,
      France autumn leaves, Morocco heat and sand, China drizzle, Japan cherry blossom).

Done since 0.11.1 went to Play: LICENSE (all rights reserved); Play uploads from GitHub (release-aab.yml).

## 0.11.3 (4 Nov 2026, Navid's test of 0.11.2 on his phone)

- [x] The bar across the top ("Due by Dusk" title strip): EdgeToEdge.enable() before super.onCreate made Android add a
      title bar. Removed; the Android setup is back to 0.11.0's (strictly landscape in the manifest and at runtime,
      fullscreen theme), keeping only the camera-cutout mode fix.
- [x] No "turn your device sideways" screen at all; the game only ever runs in landscape.
- [x] Report a problem: no typing inside the game (the keyboard covered half the screen). A small card, then the phone's
      email app opens with the details and the player writes there.
- [x] Crops: as many as the upgrades allow again (0.11.2 doubled them); size kept 25% bigger; Richer soil +¾ a level
      (was +½), so level 9 gives about 7 more crops instead of 5.
- [x] Smoothness: the field picks a lighter drawing resolution by itself when a phone can't keep up; snow drawn in a few
      batched shapes, same look.
- [x] The record bar (rival and best day) is off the field: it made a second row under the top-right buttons. The record
      stays on the day card; passing it shows a short "Crown!" message.
- [x] Sundown shows the bill's whole name (it was cut to "The ..."); a long name wraps.
- [x] Release notes go up with the Play upload (mobile/release-notes/whatsnew-en-US).

Still open: the other six countries' weather (after Navid has played Canada's snow).

## 0.12 (Navid's test of 0.11.3, 4 Nov 2026)

Clear fixes:
- [x] Reports go to bugs@khoreh.com: one address for every app, the subject names the game (website too).
- [ ] Sound from the first second: music and effects play when the game opens, without a tap first (it still waits
      for a button).
- [ ] Perks: picking a perk asks to confirm before it is taken.
- [ ] Upgrades: the "not enough cash" message was hidden under something; show it as a clear card over a dimmed screen.
- [ ] "One more day" ad button in blue like every other ad button (it is yellow like Start).
- [ ] Tools: the sickle's picture and text take a third of the screen and push the upgrades out of sight; the tool
      descriptions are hidden under other things. Compact the tool, upgrades visible without scrolling.
- [ ] Sundown: a button straight to the next day ("Pay the bill · next day" on a bill night). The field music keeps
      playing with no break and the rooster crows as the day starts; the menu music only comes in if the player
      opens the farmhouse. (Today the fast music cuts to the mellow menu music at once.)
- [ ] Canada's snow: the field itself snow white, crops push snow (with a little soil) when they come up.
- [x] Crop size and count are right now (keep them).

Needs Navid's decision (proposals page):
- [ ] Difficulty: far too easy (Kelowna, day 6: every day pays much more than the bill). Target: poor play can't pay
      even with an ad; average play pays with an ad; very strong play (bot-level) pays without one.
- [ ] Bills: a bill every other day is samey; first bills short (2 days) so the new crops come in, later bills longer
      (4–6 days) and bigger.
- [ ] Crops: when each crop joins (each bill now; each day instead, all in by day 5–6?) and whether a crop found on one
      farm carries to the next.
- [ ] Days feel too long before upgrades and perks: shorter early days that grow with upgrades.
- [ ] Boss: should do something that hurts (eat crops, plant a bomb, ...) and be much harder (beaten on day 2).
- [ ] Charge handle: still can't trigger it on purpose. Options: a meter by the day timer that fills as you cut and
      lets you release the charge; or each tool's own special fires when you reach a multiplier.
- [ ] Skills: much deeper (more branches, real choices); how upgrades, perks and skills fit together.
- [ ] Cities: each city its own look and weather (Gatineau: autumn leaves falling instead of snow, ...) and its landmark
      in the background (Toronto: the CN Tower, ...). Today every Canadian farm looks the same.
- [ ] Arthur (Grumble & Sons' banker) in the background, reacting to the day: sulking when you do well, happier as you
      fall short on a bill night, angry when you pay. 10 designs for Navid to pick from first.

Replaces the open "six countries' weather" item above: looks per city, not only per country.
