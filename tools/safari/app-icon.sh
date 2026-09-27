#!/bin/sh
# Replaces the app icon the converter made (from the 128 px extension icon)
# with every size macOS asks for, cut from app-1024.png. macOS only (sips).
set -eu
set_dir=$(find "$1" -type d -name AppIcon.appiconset | head -1)
[ -n "$set_dir" ] || { echo "no AppIcon.appiconset under $1"; exit 1; }
src="$(dirname "$0")/app-1024.png"
rm -f "$set_dir"/*.png
entries=""
for size in 16 32 128 256 512; do
  for scale in 1 2; do
    px=$((size * scale))
    name="icon_${size}x${size}@${scale}x.png"
    sips -z "$px" "$px" "$src" --out "$set_dir/$name" >/dev/null
    entries="$entries{\"idiom\":\"mac\",\"size\":\"${size}x${size}\",\"scale\":\"${scale}x\",\"filename\":\"$name\"},"
  done
done
printf '{"images":[%s],"info":{"version":1,"author":"xcode"}}\n' "${entries%,}" > "$set_dir/Contents.json"
echo "app icon: $set_dir"
