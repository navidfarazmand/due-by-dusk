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
2. Create the private Play upload key and add its four repository secrets, then build the signed AAB with the **Play release bundle** workflow (see below). The final Android app ID is `com.khoreh.duebydusk`. Build/test iOS on a Mac with Xcode and Apple signing.
3. Conduct first-session playtests: can players harvest, charge cleave, understand the bill and buy a useful upgrade without explanation? Record first-bill success, where runs stall and why testers stop. Adjust balance from this evidence.
4. Give regions distinct rules beyond crop pools/scenery. Prototype one regional mechanic at a time before expanding content. Current save migration preserves existing progression and the established farm loop.
5. Review the rights and provenance of supplied art and other assets; retain third-party font licenses and acknowledgments. Prepare final icon, store screenshots from real gameplay and concise store copy.
6. Complete Play Console's content rating, target audience and Data safety, then run the closed test (at least 12 testers opted in for 14 consecutive days) before applying for production. Since v0.7.2 the game includes the Google Mobile Ads SDK (rewarded ads and Google's consent message); it adds no accounts, purchases or analytics of its own. Keep the Data safety answers and the [privacy policy](https://khoreh.com/due-by-dusk/privacy.html) in line with any new SDK.

## Deliberate release boundaries

Cloud sync, paid currency, iOS ads, new regional rules, complete accessibility testing and store publication are not implemented. No claim of physical-device performance or signed store readiness is made. A full engine rewrite is unnecessary to validate the current game; pure rules and data are being separated to retain future options.

## Google Play and AdMob (v0.7.2)

- **App IDs.** The Play app is `com.khoreh.duebydusk` (created in Play Console; it can never change). Test APKs from CI keep `com.navidfarazmand.duebydusk.testing` and the name **Due by Dusk Test**, so they still update the test app already installed and keep its saves.
- **AdMob.** App ID `ca-app-pub-2635409921068961~1832203754` (in `android/app/src/main/res/values/strings.xml`). Rewarded unit `ca-app-pub-2635409921068961/7140370750`. `khoreh.com/app-ads.txt` authorizes the publisher ID.
- **What the ad does.** When a bill is due tonight and the player is short, the card offers *Watch ad: one more day* next to *Face the bank*: once per farm, only while an ad is already loaded, and the extra day is granted only after AdMob reports the reward (`src/platform/ads.ts`, `extraDay()` in `FarmScene.ts`). The flag is saved as `farm.extraDayUsed`.
- **Consent.** Google's consent message (published in AdMob for the EEA, UK and Switzerland) is requested at every launch before any ad request. Management shows *Privacy policy* and, where Google requires it, *Privacy choices*.
- **Demo or real ads.** Every build shows Google's demo ads unless it is the Play app **and** was built with `VITE_ADMOB_PRODUCTION=true` (the *production ads* box in the release workflow). Keep it off for closed testing; turn it on only for the production release, after the Play listing is public and linked in AdMob.
- **iOS.** The plugin is synced, so `Info.plist` carries Google's sample iOS app ID to keep the app from crashing at launch. The game requests no ads on iOS. Before an iOS release: add the iOS app in AdMob, replace the sample ID, add Google's full SKAdNetwork list, the ATT prompt and privacy manifest entries.

### Creating the Play upload key (once)

Keep the key and its passwords private (for example in a password manager), outside the repository. If it is ever lost, Play Console can reset the upload key, but that takes time.

1. On your computer, with Android Studio installed, open PowerShell in a private folder and run (it asks for a password and your name):
   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore due-by-dusk-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Copy the key file as base64 to the clipboard:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\due-by-dusk-upload.jks")) | Set-Clipboard
   ```
3. In GitHub: repository **Settings > Secrets and variables > Actions > New repository secret**. Add `DBD_UPLOAD_KEYSTORE_BASE64` (paste), `DBD_UPLOAD_STORE_PASSWORD` (your password), `DBD_UPLOAD_KEY_ALIAS` (`upload`) and `DBD_UPLOAD_KEY_PASSWORD` (the same password; keytool uses one password for this key type).

### Building and uploading a Play bundle

1. GitHub **Actions > Play release bundle > Run workflow** (leave *production ads* off for closed testing).
2. Download the `due-by-dusk-play-…` artifact from the finished run and unzip it to get `app-release.aab`.
3. Play Console **Test and release > Testing > Closed testing**: create a release, upload the bundle, add testers, roll out. Each run uses versionCode 1000 + the run number, so later uploads are always accepted.
