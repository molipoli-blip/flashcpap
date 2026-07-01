#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/build.ps1" "$@"
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/build.ps1" "$@"
else
  echo "PowerShell is required to run this build script." >&2
  exit 1
fi