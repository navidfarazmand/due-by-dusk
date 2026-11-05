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

## 0.11.4 and 0.12 (Navid's test of 0.11.3, 4 Nov 2026)

Clear fixes, released as 0.11.4 (versionCode 1106, rolled out to closed testing on 4 Nov 2026 by the Play release
workflow, run 6):
- [x] Reports go to bugs@khoreh.com: one address for every app, the subject names the game (website too).
- [x] Sound from the first second: music and effects play when the game opens, without a tap first (it still waits
      for a button).
- [x] Perks: picking a perk asks to confirm before it is taken.
- [x] Upgrades: the "not enough cash" message was hidden under something; show it as a clear card over a dimmed screen.
- [x] "One more day" ad button in blue like every other ad button (it is yellow like Start).
- [x] Tools: the sickle's picture and text take a third of the screen and push the upgrades out of sight; the tool
      descriptions are hidden under other things. Compact the tool, upgrades visible without scrolling.
- [x] Sundown: a button straight to the next day ("Pay the bill · next day" on a bill night). The field music keeps
      playing with no break and the rooster crows as the day starts; the menu music only comes in if the player
      opens the farmhouse. (Today the fast music cuts to the mellow menu music at once.)
- [x] Canada's snow: the field itself snow white, crops push snow (with a little soil) when they come up.
- [x] Crop size and count are right now (keep them).

## 0.12 (Navid's picks, 5 Nov 2026; choices page: https://claude.ai/artifact/U3PTtWms8LHpEti34e7QVH)

- [x] Bills of 2, 3, 4, then 5 days (later bills stay at 5): a Canadian farm is 19 days, a Japanese one 29. The day
      card shows a dot per day (smaller dots on farms over 20 days).
- [x] Days start at 15 s; Longer days and skills add seconds (to about 30).
- [x] A new crop every morning: carrots on day 1, the radish on day 2, the country's three, then the rest. The day
      card names the crop that joins the field that morning (the chest no longer does).
- [ ] Bills tuned with three bots (scripts/bots.mjs: strong, average, weak; on-track builds, 15 s days): weak can't pay
      even with an ad, average pays with one ad, a computer-strong player needs none.
- [x] The boss: eats the best crops (the Muncher), its armour is off only right after it eats (hit it then and it spits
      the coins back), bomb seeds from its second phase, a country storm from its third (ice, sand or mud; two hits
      free a crop, no bonus). It can fall mid-farm only if you neglect the crops (and then the bills).
- [x] Thief crows on every farm: they take 6% of the jar and fly off; swipe them first to get the coins back.
- [x] Late fees instead of "one more day": up to three late days, each needs an ad; Grumble & Sons take 20%, then
      40%, then 60% of that day's earnings; after the third the bank takes the farm.
- [x] One money: nothing carries from a won farm to the next (no grinding the first town for upgrades); free coins go
      to the farm you're on. The won card no longer shows "+$0 to your savings".
- [x] Power meter beside the sun dial (replaces the hold-still Charge Cleave and the RUSH counter): cuts fill it, a
      chain fills it faster; full fires the tool's power and the Harvest Rush together. Sickle: Cleave. Scythe:
      Whirlwind (follows the finger). Flame weeder: Fire wave. Seed blaster: Seed storm. The Charge handle is now the
      Power booster (same id, testers keep their levels), on every tool. A card explains the meter once per tool.
- [x] Arthur Grumble (Top Hat Tubby, round 2; Navid: "yes to arthur") on the HUD, left of the sound button: gloats on a
      bill's due day when you're short (more as dusk nears), angry when you have the money, stomps and sulks the
      morning after a bill is paid, shocked when his crow is chased off or the boss falls, faints on the won card.
- [ ] Every city its own look, from one table (src/game/citylook.ts) so new countries and cities are easy to add:
  - [x] Weather by city: Gatineau autumn leaves (falling and lying on the soil), Leamington and Kelowna a clear field,
        Charlottetown, Toronto and Saskatoon snow.
  - [ ] Landmarks in each Canadian city's skyline band (src/art/bands/<city id>.webp): the lighthouse, the Peace
        Tower, the CN Tower, the big tomato and greenhouses, a grain elevator, Okanagan Lake with Ogopogo.
- [ ] Docs (README, ARCHITECTURE), release notes, version 0.12.0, Play closed testing.

Next version (0.13), to send to Navid before building: one upgrade tree bought with cash (Workshop and skills
together, six branches, free reset, long builds with an ad); perks with 5 levels (a perk can come back as its next
level); crop levels that never reset; a tool shop and a seed album; diamonds retired (refunded).
