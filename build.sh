#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_PATH="$SCRIPT_DIR/manifest.json"
DIST_DIR="$SCRIPT_DIR/dist"

usage() {
  echo "Usage: bash build.sh [firefox|chromium|edge|all]" >&2
}

TARGET="${1:-all}"
case "$TARGET" in
  firefox|chromium|edge|all)
    ;;
  *)
    usage
    exit 1
    ;;
esac

for cmd in python3 zip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

VERSION="$(python3 - <<'PY' "$MANIFEST_PATH"
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    manifest = json.load(f)

print(manifest["version"])
PY
)"

if [[ "$TARGET" == "all" ]]; then
  TARGETS=(firefox chromium edge)
else
  TARGETS=("$TARGET")
fi

mkdir -p "$DIST_DIR"

for browser in "${TARGETS[@]}"; do
  STAGE_DIR="$DIST_DIR/__stage-$browser"
  UNPACKED_DIR="$DIST_DIR/$browser-unpacked"
  ZIP_PATH="$DIST_DIR/$browser-$VERSION.zip"

  rm -rf "$STAGE_DIR" "$UNPACKED_DIR"
  rm -f "$ZIP_PATH"

  mkdir -p "$STAGE_DIR"

  for item in \
    background.js \
    manifest.json \
    popup.html \
    _locales \
    icons \
    lib \
    src \
    styles \
    notes; do
    if [[ -e "$SCRIPT_DIR/$item" ]]; then
      cp -R "$SCRIPT_DIR/$item" "$STAGE_DIR/"
    fi
  done

  python3 - <<'PY' "$STAGE_DIR/manifest.json" "$browser"
import json
import sys

manifest_path = sys.argv[1]
browser = sys.argv[2]

with open(manifest_path, "r", encoding="utf-8") as f:
    manifest = json.load(f)

if browser == "firefox":
    manifest["background"] = {"scripts": ["background.js"]}
    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": "flashcpap@molipoli-blip",
            "data_collection_permissions": {
                "required": ["none"],
                "optional": []
            }
        }
    }
else:
    manifest["background"] = {"service_worker": "background.js"}
    manifest.pop("browser_specific_settings", None)

with open(manifest_path, "w", encoding="utf-8", newline="\n") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY

  mkdir -p "$UNPACKED_DIR"
  cp -R "$STAGE_DIR"/. "$UNPACKED_DIR/"

  (
    cd "$UNPACKED_DIR"
    zip -qr "$ZIP_PATH" .
  )

  rm -rf "$STAGE_DIR"
  echo "Created $ZIP_PATH"
  echo "Prepared $UNPACKED_DIR"
done