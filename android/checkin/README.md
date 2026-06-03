# Turnout Check-in (Android)

Staff QR scanner for door check-in. Uses the same **Turnout teal + lime** branding and the same API as the web staff scanner (`/staff/checkin/:eventId`).

## Features

- Configure **API URL** (e.g. `https://turnout-omega.vercel.app`) and **Event ID**
- Unlock with the **staff PIN** from Event settings → Check-in
- Scan ticket QR codes with the rear camera (ML Kit)
- Manual token entry fallback
- Success / already checked-in / error feedback (matches web scanner)

## Requirements

- Android 8.0+ (API 26)
- Camera permission
- Internet access to your Turnout API host

## Build & install

1. Install [Android Studio](https://developer.android.com/studio) (Ladybug or newer).
2. Open the `android/checkin` folder as a project.
3. Let Gradle sync, then **Run** on a device or emulator with a camera.

From the command line (with Android SDK installed):

```bash
cd android/checkin
./gradlew :app:assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

## Setup on event day

1. In Turnout dashboard → **Event settings → Check-in**, copy the **Event ID** (from the URL `/dashboard/events/{id}/checkin`) and **staff PIN** (or regenerate).
2. In the app, enter your production API URL and event ID.
3. Enter the staff PIN → start scanning ticket QRs from the order confirmation page.

## API endpoints used

- `POST /api/events/{eventId}/checkin/verify-pin` — `{ "staffPin": "123456" }`
- `POST /api/events/{eventId}/checkin` — `{ "qrToken": "…", "staffPin": "123456" }`

No organizer login cookie is required when the staff PIN is valid.

## Default API URL

Change `DEFAULT_API_BASE` in `app/build.gradle.kts` or set it in the app on first launch.
