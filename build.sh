#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-firefox}"
VERSION=$(grep '"version"' manifest.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/${TARGET}-${VERSION}.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

echo "Packaging extension v$VERSION for $TARGET → $OUT_FILE"

# For Chromium/Edge: patch manifest (service_worker instead of scripts, no gecko settings)
if [[ "$TARGET" == "chromium" || "$TARGET" == "edge" ]]; then
  TMP_DIR=$(mktemp -d)
  python3 - <<EOF
import json
with open('manifest.json') as f:
    m = json.load(f)
m['background'] = {'service_worker': 'background.js'}
m.pop('browser_specific_settings', None)
with open('$TMP_DIR/manifest.json', 'w') as f:
    json.dump(m, f, indent=2, ensure_ascii=False)
EOF
  zip -r "$OUT_FILE" \
    background.js \
    popup.html \
    _locales/ \
    icons/ \
    lib/ \
    src/ \
    styles/ \
    --exclude "*.DS_Store" \
    --exclude "__MACOSX/*"
  cd "$TMP_DIR" && zip -j "$(cd - > /dev/null; pwd)/$OUT_FILE" manifest.json && cd - > /dev/null
  rm -rf "$TMP_DIR"
else
  zip -r "$OUT_FILE" \
    manifest.json \
    background.js \
    popup.html \
    _locales/ \
    icons/ \
    lib/ \
    src/ \
    styles/ \
    --exclude "*.DS_Store" \
    --exclude "__MACOSX/*"
fi

echo "Done: $OUT_FILE ($(du -sh "$OUT_FILE" | cut -f1))"
