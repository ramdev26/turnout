#!/usr/bin/env bash
# Builds debug APK and prints the full path (macOS/Linux).
set -euo pipefail
cd "$(dirname "$0")/.."
./gradlew :app:assembleDebug --no-daemon
APK="$PWD/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "=============================================="
echo "APK built successfully:"
echo "$APK"
echo "=============================================="
ls -lh "$APK"
