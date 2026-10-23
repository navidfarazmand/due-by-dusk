# Public debug signing key

`public-debug.keystore` is intentionally public and is **only for development APKs**. Its store/key password is `android`, alias `androiddebugkey`. It is not a release credential and must never sign a Play Store or production release.

Keeping the same debug certificate lets v0.7.1 and later test APKs update in place across CI runs without removing player saves. The earlier v0.7.0 CI APK used an ephemeral runner-generated debug key, which was not archived or cached; its private key cannot be recovered from the APK.

To preserve the old app and its saves, debug builds now use `com.navidfarazmand.duebydusk.testing` and display **Due by Dusk Test**. They install alongside v0.7.0 rather than replacing it. Keep the old app installed. Export your save from its Management panel, then open Due by Dusk Test and import that JSON. App storage is separate, so the new test app initially starts fresh. Later test APKs update this test app in place. Do not uninstall the old app until you have verified the imported progress.

Store releases require a separate private signing key maintained outside this repository.

Public test certificate SHA-256: `95:BD:8E:D5:E1:3C:E2:90:A2:CE:37:B4:07:10:FD:A5:FC:F3:D0:D4:5A:D6:3E:F0:82:66:2E:9B:4D:97:2A:64`.
