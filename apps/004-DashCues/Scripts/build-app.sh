#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

if [[ -d "/Applications/Xcode.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

swift build -c release --disable-sandbox

APP_BUNDLE="$APP_ROOT/build/DashCues.app"
CONTENTS="$APP_BUNDLE/Contents"
mkdir -p "$CONTENTS/MacOS"
mkdir -p "$CONTENTS/Resources"
cp .build/release/DashCues "$CONTENTS/MacOS/DashCues"
cp Info.plist "$CONTENTS/Info.plist"
cp Assets/AppIcon.icns "$CONTENTS/Resources/AppIcon.icns"
codesign --force --deep --sign - "$APP_BUNDLE"
touch "$APP_BUNDLE"
printf 'Built %s\n' "$APP_BUNDLE"
