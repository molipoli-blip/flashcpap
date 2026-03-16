#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-firefox}"
VERSION=$(grep '"version"' manifest.json | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/${TARGET}-${VERSION}.zip"

mkdir -p "$OUT_DIR"

# Remove old package if present
rm -f "$OUT_FILE"

echo "Packaging extension v$VERSION for $TARGET → $OUT_FILE"

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

echo "Done: $OUT_FILE ($(du -sh "$OUT_FILE" | cut -f1))"
