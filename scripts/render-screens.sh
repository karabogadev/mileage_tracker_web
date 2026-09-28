#!/usr/bin/env bash
# Renders design/screens/*.html into the phone screenshots used by the site.
# Needs Google Chrome and cwebp (brew install webp). Run from anywhere:
#   scripts/render-screens.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
out="$root/public/assets/screens"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

# Screens are 393 × 852 pt (iPhone 16/17). Rendered at 2x: sharp on retina, small on the wire.
for page in "$root"/design/screens/*.html; do
  name="$(basename "$page" .html)"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=393,852 --screenshot="$tmp/$name.png" "file://$page" >/dev/null 2>&1
  cwebp -quiet -q 86 "$tmp/$name.png" -o "$out/$name.webp"
  echo "rendered $name.webp ($(du -k "$out/$name.webp" | cut -f1) KB)"
done
