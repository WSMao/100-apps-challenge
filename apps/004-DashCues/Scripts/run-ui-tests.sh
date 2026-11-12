#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

if [[ -d "/Applications/Xcode.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

pkill -9 -x DashCues 2>/dev/null || true
pkill -9 -x DashCuesUITests-Runner 2>/dev/null || true
sleep 1

xcodebuild -project DashCues.xcodeproj \
  -scheme DashCues \
  -destination 'platform=macOS' \
  "$@"
