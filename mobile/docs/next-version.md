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
      - [x] Reports go to info@khoreh.com (the phone's email app opens with the report filled in).
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
- [x] Release notes go up with the Play upload (mobile/release-notes/whatsnew-en-US).

Still open: the other six countries' weather (after Navid has played Canada's snow).

