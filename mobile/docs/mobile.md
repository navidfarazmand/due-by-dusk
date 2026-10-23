# Due by Dusk mobile shell

The game remains TypeScript + Phaser, packaged by Capacitor 8. Android and iOS projects are checked in. The phone layout and native orientation are landscape in both directions. Native shells were generated with Capacitor 8.5.3; this is a development foundation, not a signed store release.

## Build and sync

Run from `mobile/`:

```sh
npm ci
npm run build
npx cap sync
```

Always rebuild and sync after changing the game. Capacitor copies `dist/`; opening Android Studio without syncing can run an older game. The offline HTML builder is for standalone browser distribution, not the native release. The app packages local assets without a remote server URL.

## Android

Install a current compatible Android Studio and Android SDK 36. Use its JDK 21 (or the version required by the installed Capacitor/Gradle toolchain), not an old system Java installation. `android/variables.gradle` currently targets API 36 with minimum API 24. See the [Capacitor 8 upgrade requirements](https://capacitorjs.com/docs/updating/8-0).

```sh
npx cap open android
```

In Android Studio, select a physical phone or emulator and run the `app` configuration. For a command-line debug build on Windows after the SDK and JDK are configured:

```powershell
.\android\gradlew.bat -p android assembleDebug
```

Use Android Studio's **Generate Signed Bundle / APK > Android App Bundle** for the Play release. Keep signing keys and passwords outside the repository. Increment `versionCode` for every Play upload and update `versionName`. Confirm the app ID `com.navidfarazmand.duebydusk` before the first store upload; changing it afterward creates another app.

`AndroidManifest.xml` declares `sensorLandscape` and `appCategory="game"`. Android's documented game exception preserves orientation restrictions on large screens when targeting API 36; still test tablets, foldables, and window resizing. [Android orientation behavior](https://developer.android.com/about/versions/16/behavior-changes-16)

## iOS

The Xcode project uses Swift Package Manager. Build on a Mac with the [supported Xcode version](https://capacitorjs.com/docs/ios), select a development team, and provision a real iPhone:

```sh
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

Only landscape left/right are listed for iPhone and iPad. `UIRequiresFullScreen` permits iPad orientation locking. The AppDelegate orientation override uses the window passed by UIKit, compatible with Capacitor's UIScene lifecycle.

`App/App/PrivacyInfo.xcprivacy` is included in Xcode resources and declares UserDefaults reason CA92.1 for save preferences. Re-audit privacy declarations if analytics, ads, purchases, or other plugins are added. [Preferences privacy requirement](https://capacitorjs.com/docs/apis/preferences)

## Platform integration

- Await `bootstrapPreferences(SAVE_STORAGE_KEYS)` before creating scenes. It restores missing local save/backup entries from native preferences. Existing cache entries remain available for SaveSystem validation and recovery.
- Subscribe to `SaveSystem.subscribePersisted` and send verified entries to `persistPreference(key, value)`. Mirroring is ordered and read-back verified; report rejected promises to the player. Preferences survive normal app termination, but uninstalling removes them. Export remains the transfer/backup route; this is not cloud sync.
- `getNativeSaveStatus()` and the `dbd:native-save-status` event expose primary save verification independently of browser save status. Keep a native warning visible until a later verified primary native write clears it; a successful browser write or settings write does not prove the device backup succeeded.
- Call `initializeMobilePlatform({onPause, onResume, onBackButton, onError})` once. Pause must save/checkpoint and suspend play; resume should require the player's explicit continuation. Android Back closes an open game panel when the callback returns true, otherwise safely minimizes the app.
- `setHapticsEnabled(true)` enables optional native feedback; `hapticImpact('light')` is throttled. It defaults off and has no effect in browsers.

## Verification before publishing

Web build and native sync do not prove device compatibility. Test a real Android phone and iPhone: launch offline, rotate both landscape directions, tap near cutouts and gesture bars, background during a charged harvest, resume without lost time, force-stop/reopen, simulate damaged saves, import an existing v2 save, and run several harvests on a modest device. Test denied/full storage and confirm visible failure plus export recovery.

Replace generated launcher/splash artwork, set final versions and signing, prepare actual landscape gameplay screenshots, complete accurate Play Data safety/content-rating and App Store privacy declarations, and run closed testing before release. Native compilation and signing require the external SDKs and credentials; they are not bundled here.

## Continuous integration

The repository's `.github/workflows/mobile.yml` runs for mobile changes and can also be dispatched manually. It installs locked dependencies, runs unit tests and Chromium landscape smoke tests, builds production assets, syncs Android, and compiles a debug APK using JDK 21, SDK 36, Gradle 8.14.3, and Android Gradle Plugin 8.13.0. Successful runs retain the debug APK for 14 days. Debug APKs are for testing; Play release bundles still require release signing and store preparation. The workflow does not build or sign iOS.

## Immersive mode and test updates (v0.7.1)

Android enters immersive mode through `WindowInsetsControllerCompat`, hides status and navigation bars, and lets a system edge swipe reveal them temporarily. It reapplies on focus and resume. Capacitor `SystemBars.hidden` is also enabled so bridge initialization does not restore bars. The WebView draws edge to edge while Capacitor forwards cutout insets; essential controls must use its `--safe-area-inset-*` CSS variables with `env(safe-area-inset-*)` fallbacks, plus normal touch margins. System gestures remain available. Test both phone landscape directions, three-button and gesture navigation, return from Home, and the camera cutout on the Samsung A71. [Android immersive guidance](https://developer.android.com/develop/ui/views/layout/immersive)

v0.7.1 uses Android versionCode 8 and iOS build 8. Its debug-only signing key is intentionally public and checked in under `android/app/test-signing/`, so subsequent test APKs can install over it and retain saves. The v0.7.0 CI key was ephemeral and not archived. To preserve its saves, the new debug app uses the separate ID `com.navidfarazmand.duebydusk.testing` and name **Due by Dusk Test**. It installs alongside the old app. Keep the old app installed, export its save from Management, and import the JSON in the new test app. The apps have separate storage; progress does not transfer automatically. This public debug key must never be used for a store release.
