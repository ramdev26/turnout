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

## Install Android SDK (command line)

Requires **Java 17+** and `unzip`/`curl`.

```bash
cd android/checkin
chmod +x scripts/install-android-sdk.sh
./scripts/install-android-sdk.sh
```

This installs the SDK under `android/sdk/` and writes `local.properties` for Gradle.

Set for your shell (optional):

```bash
export ANDROID_HOME="$(pwd)/../sdk"   # from android/checkin
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

## Build & install

**Option A — Android Studio (recommended)**

1. Open Android Studio → **Open** → select the `android/checkin` folder (not the whole repo root).
2. Wait for **Gradle Sync** to finish (first time may download SDK components — accept licenses if prompted).
3. Connect an Android phone with **USB debugging** enabled, or start a virtual device with a **back camera**.
4. Click the green **Run** ▶ button (target: `app`).
5. On the phone: allow **Camera** when asked.

**First launch in the app**

| Field | Example |
|-------|---------|
| API URL | `https://turnout-omega.vercel.app` (your live Turnout site, no `/api` suffix) |
| Event ID | From dashboard URL `…/dashboard/events/12/checkin` → `12` |
| Staff PIN | From **Event settings → Check-in** in Turnout |

**Studio tips**

- If sync fails: **File → Settings → Android SDK** → install **Android 15 (API 35)** and **Build-Tools 35**.
- `local.properties` is auto-created with `sdk.dir=…` — do not commit it.
- To build APK without a device: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

**Option B — Command line**

```bash
cd android/checkin
./scripts/install-android-sdk.sh   # once
./gradlew :app:assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

Install on a phone: `adb install -r app/build/outputs/apk/debug/app-debug.apk`

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
