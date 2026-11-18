#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

SOURCE_SVG="${1:-Assets/Logos/logo.svg}"
OUTPUT_ICNS="${2:-Assets/AppIcon.icns}"

if [[ ! -f "$SOURCE_SVG" ]]; then
  printf 'Source SVG not found: %s\n' "$SOURCE_SVG" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  printf 'Missing required tool: sips\n' >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  printf 'Missing required tool: iconutil\n' >&2
  exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dashcues-icon.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

BASE_PNG="$WORK_DIR/source-1024.png"
ICONSET_DIR="$WORK_DIR/AppIcon.iconset"
mkdir -p "$ICONSET_DIR"

sips -s format png "$SOURCE_SVG" --out "$BASE_PNG" >/dev/null

cp "$BASE_PNG" "$ICONSET_DIR/icon_512x512@2x.png"
sips -z 16 16 "$BASE_PNG" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$BASE_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$BASE_PNG" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$BASE_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$BASE_PNG" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$BASE_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$BASE_PNG" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$BASE_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$BASE_PNG" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null

mkdir -p "$(dirname "$OUTPUT_ICNS")"
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

printf 'Built icon: %s (source: %s)\n' "$OUTPUT_ICNS" "$SOURCE_SVG"
