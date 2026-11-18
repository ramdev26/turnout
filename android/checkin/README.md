# Turnout (Android)

Organizer console + staff QR scanner. Uses the same **Turnout teal + lime** branding and the same API as the web dashboard / staff check-in.

## Modes (home screen)

1. **Organizer login** — sign in with your organizer account to manage events from the phone:
   - Event list + live stats (checked-in, sold, revenue)
   - Open door scanner (uses that event’s staff PIN automatically)
   - Attendee search / guest list
   - Bank transfer confirm / reject
   - View & share staff PIN
2. **Staff scanner** — enter API URL + Event ID + staff PIN (same as before), including offline roster mode

## Requirements

- Android 8.0+ (API 26)
- Camera permission (scanner)
- Internet for login, roster download, and sync

## Install Android SDK (command line)

Requires **Java 17+** and `unzip`/`curl`.

```bash
cd android/checkin
chmod +x scripts/install-android-sdk.sh
./scripts/install-android-sdk.sh
```

This installs the SDK under `android/sdk/` and writes `local.properties` for Gradle.

## Build & install

**Android Studio (recommended)**

1. Open Android Studio → **Open** → select the `android/checkin` folder.
2. Wait for **Gradle Sync**.
3. Connect a phone with USB debugging (or an emulator with a back camera).
4. Run ▶ `app`.

**CLI**

```bash
cd android/checkin
./gradlew :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

## First launch

| Path | What to enter |
|------|----------------|
| Organizer | API URL (site origin, no `/api`) + organizer email/password |
| Staff | API URL + Event ID + staff PIN from Event settings → Check-in |

Default API base: `https://turnout-omega.vercel.app`

## Notes

- Organizer Bearer POSTs are CSRF-exempt on the API (cookie sessions still protected).
- Organizer “Open door scanner” unlocks the existing staff scanner with that event’s PIN so offline mode still works.
