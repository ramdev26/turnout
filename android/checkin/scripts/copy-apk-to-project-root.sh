#!/usr/bin/env bash
# Copies the debug APK next to the project for easy access in Finder/Explorer.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$SRC" ]; then
  echo "APK not built yet. Run: ./gradlew :app:assembleDebug"
  exit 1
fi
mkdir -p dist
cp -f "$SRC" ./TurnoutCheckIn-debug.apk
cp -f "$SRC" dist/TurnoutCheckIn-debug.apk
echo "Copied to:"
echo "  $PWD/TurnoutCheckIn-debug.apk"
echo "  $PWD/dist/TurnoutCheckIn-debug.apk"
