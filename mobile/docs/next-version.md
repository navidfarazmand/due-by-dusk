# Next version (0.11.2) checklist

Navid's list for the next Play release. Claude ticks items as they land and says when it is enough for a version;
then it bumps the version and runs the Play release (closed testing).

- [x] New rooster crow: "Cartoon Rooster Sounds" by DRAGON-STUDIO (Pixabay Content License, free for commercial use),
      loudness-matched, credited in Settings → Credits and licenses/README.md.
- [x] "A new version is ready" pop-up: when Play has a newer version, a pop-up on a menu screen (never during a day,
      once per launch) asks the player to update; "Update now" uses Google Play's in-app update
      (@capawesome/capacitor-app-update 8.1.1). Only the Play app sees it, not GitHub test APKs.
- [x] Report a problem: one strong shake (one jolt above ~26 m/s², then quiet for 4 s) or Settings → Report a problem
      opens a short report (the player's words plus version, device, screen, where they were, recent errors); a day
      pauses. Settings → "Shake to report a problem" turns the shake off.
      - [ ] Where reports go: waiting for Navid's support email (REPORT_EMAIL in src/platform/report.ts). Until then the
            report is copied to paste anywhere.
- [ ] New app icon and splash: Navid picks from the new designs (carrot alone; sickle about to cut; sickle cut through
      and passing), each with a different face.
- [ ] Country looks for the other six countries, once Navid approves Canada's snow (USA dust, Brazil rain and mud,
      France autumn leaves, Morocco heat and sand, China drizzle, Japan cherry blossom).

Done since 0.11.1 went to Play: LICENSE (all rights reserved); Play uploads from GitHub (release-aab.yml).
