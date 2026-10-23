# Due by Dusk — mobile development v0.7.0

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

The production build uses real Phaser; the old custom shim is not shipped. Android debug APKs are CI artifacts for testing, not signed Play Store releases. iOS requires a Mac and signing. No ads, purchases, accounts or analytics have been added.

Editable supplied character sources live in art/source. The original asset pipeline is archived in art/tools and references raw generated images that were not included in the supplied archive. Shipping assets are already supplied in public/assets and require no regeneration.
