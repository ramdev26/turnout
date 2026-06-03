#!/usr/bin/env bash
# Builds debug APK and prints the full path (macOS/Linux).
set -euo pipefail
cd "$(dirname "$0")/.."
./gradlew :app:assembleDebug --no-daemon
APK="$PWD/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p dist
cp -f "$APK" ./TurnoutCheckIn-debug.apk
cp -f "$APK" dist/TurnoutCheckIn-debug.apk
echo ""
echo "=============================================="
echo "APK built — open this file in Finder/Explorer:"
echo "$PWD/TurnoutCheckIn-debug.apk"
echo ""
echo "Also at: $PWD/dist/TurnoutCheckIn-debug.apk"
echo "Gradle path: $APK"
echo "=============================================="
ls -lh ./TurnoutCheckIn-debug.apk
