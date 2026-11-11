#!/bin/sh
# Puts Nordlys's own window (app/) over the one the converter writes into the
# Mac app: two steps in Safari instead of a paragraph and a Quit button.
set -eu
view=$(find "$1" -name ViewController.swift -not -path "*/dd/*" | head -1)
[ -n "$view" ] || { echo "no ViewController.swift under $1"; exit 1; }
app=$(dirname "$view")
here="$(dirname "$0")"
cp "$here/app/ViewController.swift" "$view"
cp "$here/app/Main.html" "$app/Resources/Base.lproj/Main.html"
cp "$here/app/Script.js" "$here/app/Style.css" "$app/Resources/"
sips -z 256 256 "$here/app-1024.png" --out "$app/Resources/Icon.png" >/dev/null
echo "app window: $app"
