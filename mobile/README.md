# Due by Dusk — mobile development v0.7.2

Landscape harvest game built with TypeScript, Phaser 3, Vite and Capacitor 8. Use Node 22.12+ (Node 24 recommended).

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

The development server prints the local URL. The generated dist/ is a web build: serve it over HTTP or sync it into the native projects. Opening the built index directly using file:// is not supported.

- [Architecture and state invariants](ARCHITECTURE.md)
- [Android/iOS setup and native limitations](docs/mobile.md)
- [Release plan and remaining device/store work](docs/release-plan.md)

Assets and fonts are packaged locally. Management starts closed; open the gear to view bills, equipment, heirlooms, map, skills, save transfer and controls. Drag to harvest; hold then release to cleave. Keyboard arrows/WASD steer, Space charges and P pauses. Interrupted days restart from dawn with the pre-day farm state. Save imports preserve existing v1/v2 progress through validation and migration.

The bottom dock keeps the multiplier, daylight, bill and buttons outside the crop area. Existing vegetable artwork is preserved and enlarged; scenery and Arthur use new cartoon vector artwork. Successful farms grant one skill point.

[Download the Android test APK](https://github.com/navidfarazmand/due-by-dusk/releases/download/android-v0.7.2/Due-by-Dusk-Test.apk). It installs as **Due by Dusk Test** alongside the old app. Export/import a save to carry over progress, and keep the old app installed until you verify the transfer.

The production build uses real Phaser; the old custom shim is not shipped. Android test APKs are distributed through GitHub prereleases and CI artifacts. They are development builds, not Play Store releases. iOS requires a Mac and signing. Since v0.7.2 the game includes optional rewarded ads (Google AdMob) with Google's consent message; test builds show Google demo ads. No purchases, accounts or analytics have been added. The Play app ID is `com.khoreh.duebydusk`; see the [release plan](docs/release-plan.md#google-play-and-admob-v072).

Editable supplied character sources live in art/source. The original asset pipeline is archived in art/tools and references raw generated images that were not included in the supplied archive. Old bitmap textures are archived in art/legacy-textures; current game art is drawn in code.
