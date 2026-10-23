# Release plan

## Implemented in v0.7.0

- Standard Vite/real Phaser production build with no alternate shim or embedded-base64 loader.
- Landscape full field, gear-operated management overlay, large controls, safe areas and explicit pause/resume.
- Adjustable finger offset, optional native vibration and reduced effects.
- Touch charge release fix, first-harvest guidance, clearer persistent vs current-farm rewards and accurate perk descriptions.
- Canonical economy data and renderer-independent formulas with regression tests.
- Verified rotating saves, corrupt-save recovery, storage warnings, native Preferences mirror and checkpoint restart behavior.
- Android/iOS Capacitor projects, local fonts/assets, iOS storage privacy manifest and CI validation/build workflow.

## Required before public release

1. Install/test the Android APK on a small landscape phone, a modest device and a tablet. Check gesture bars, cutouts, interrupts, audio, battery use and frame pacing. Desktop browser emulation does not replace device testing.
2. Run the Android build in CI or a configured Android Studio environment. Create the production signing key privately, choose final application identity and build a signed AAB. Build/test iOS on a Mac with Xcode and Apple signing.
3. Conduct first-session playtests: can players harvest, charge cleave, understand the bill and buy a useful upgrade without explanation? Record first-bill success, where runs stall and why testers stop. Adjust balance from this evidence.
4. Give regions distinct rules beyond crop pools/scenery. Prototype one regional mechanic at a time before expanding content. Current save migration preserves existing progression and the established farm loop.
5. Review the rights and provenance of supplied art and other assets; retain third-party font licenses and acknowledgments. Prepare final icon, store screenshots from real gameplay and concise store copy.
6. Complete Play Console's current target API, privacy policy, Data safety, content rating and applicable testing requirements. This build adds no ads, accounts, purchases or analytics SDKs. Verify native backup configuration and all data flows when preparing disclosures.

## Deliberate release boundaries

Cloud sync, paid currency, ads, new regional rules, complete accessibility testing and store publication are not implemented. No claim of physical-device performance or signed store readiness is made. A full engine rewrite is unnecessary to validate the current game; pure rules and data are being separated to retain future options.
