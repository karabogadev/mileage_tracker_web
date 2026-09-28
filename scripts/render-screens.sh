#!/usr/bin/env bash
# Renders the design sources into the images the site uses:
#   design/screens/*.html -> public/assets/screens/*.webp  (phone screenshots)
#   design/og.html        -> public/assets/img/og.jpg      (social preview, uses the screenshots)
# Needs Google Chrome, cwebp and ImageMagick (brew install webp imagemagick). Run from anywhere:
#   scripts/render-screens.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
out="$root/public/assets/screens"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$out"

shoot() { # <page> <width>,<height> <scale> <png>
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor="$3" --window-size="$2" --screenshot="$4" "file://$1" >/dev/null 2>&1
}

# Screens are 393 × 852 pt (iPhone 16/17). Rendered at 2x: sharp on retina, small on the wire.
for page in "$root"/design/screens/*.html; do
  name="$(basename "$page" .html)"
  shoot "$page" 393,852 2 "$tmp/$name.png"
  cwebp -quiet -q 86 "$tmp/$name.png" -o "$out/$name.webp"
  echo "rendered screens/$name.webp ($(du -k "$out/$name.webp" | cut -f1) KB)"
done

shoot "$root/design/og.html" 1200,630 1 "$tmp/og.png"
magick "$tmp/og.png" -strip -quality 88 "$root/public/assets/img/og.jpg"
echo "rendered img/og.jpg ($(du -k "$root/public/assets/img/og.jpg" | cut -f1) KB)"
