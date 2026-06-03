#!/usr/bin/env bash
# Installs Android SDK into ../../sdk (workspace/android/sdk) for local builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_HOME="${ANDROID_HOME:-$ROOT/sdk}"
CMDLINE_ZIP="/tmp/commandlinetools-linux.zip"
CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

echo "Android SDK location: $ANDROID_HOME"
mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Downloading Android command-line tools..."
  curl -fsSL -o "$CMDLINE_ZIP" "$CMDLINE_URL"
  rm -rf /tmp/cmdline-tools-extract
  unzip -q -o "$CMDLINE_ZIP" -d /tmp/cmdline-tools-extract
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv /tmp/cmdline-tools-extract/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "Accepting SDK licenses..."
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null

echo "Installing platform-tools, Android 35 platform, build-tools 35.0.0..."
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0"

CHECKIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "sdk.dir=$ANDROID_HOME" > "$CHECKIN_DIR/local.properties"
echo "Wrote $CHECKIN_DIR/local.properties"
echo "Done. Build with: cd android/checkin && ./gradlew :app:assembleDebug"
