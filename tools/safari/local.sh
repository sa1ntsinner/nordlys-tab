#!/bin/sh
# Builds Nordlys for Safari on this Mac, signs it with the Apple Development
# certificate in the keychain and puts it in /Applications.
#
# A build signed ad hoc counts as unsigned: Safari then wants "Allow unsigned
# extensions", takes that back every time it quits, and Nordlys goes off with
# it. A build signed by a developer needs no such permission.
#
# Everything is built in a temporary folder that is removed at the end, so no
# second copy of the extension is left for Safari to pick up instead.
#
#   npm run safari:local
set -eu

cd "$(dirname "$0")/../.."
BUNDLE_ID=io.github.sa1ntsinner.nordlys
APP=/Applications/Nordlys.app
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

identity=$(security find-identity -v -p codesigning | sed -n 's/^ *[0-9]*) \([0-9A-F]\{40\}\) "Apple Development.*/\1/p' | head -1)
if [ -z "$identity" ]; then
  echo "No Apple Development certificate in the keychain. Xcode makes one: Settings, Accounts, Manage Certificates." >&2
  exit 1
fi

work=$(mktemp -d)
built=""
cleanup() {
  [ -n "$built" ] && "$LSREGISTER" -u "$built" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

npm run --silent ports safari

xcrun safari-web-extension-converter dist/safari \
  --project-location "$work" --app-name Nordlys --bundle-identifier "$BUNDLE_ID" \
  --macos-only --swift --copy-resources --no-open --no-prompt --force >/dev/null

sh tools/safari/app-icon.sh "$work"
sh tools/safari/app.sh "$work"
# The converter takes the case of the ids from the app name; the registered
# ids are lower case (the same step as in .github/workflows/safari.yml).
/usr/bin/grep -rlI "io.github.sa1ntsinner.Nordlys" "$work" | while read -r f; do
  sed -i '' "s/io\.github\.sa1ntsinner\.Nordlys/$BUNDLE_ID/g" "$f"
done

project=$(find "$work" -maxdepth 3 -name "*.xcodeproj" | head -1)
version=$(node -p 'require("./manifest.json").version')
# This Xcode builds for macOS 12 and later; the store build keeps its own target.
xcodebuild build -quiet -project "$project" -scheme Nordlys -configuration Release \
  -derivedDataPath "$work/dd" -destination "generic/platform=macOS" \
  CODE_SIGNING_ALLOWED=NO MACOSX_DEPLOYMENT_TARGET=12.0 \
  MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$(date +%Y%m%d%H%M)"

built="$work/dd/Build/Products/Release/Nordlys.app"
extension="$built/Contents/PlugIns/Nordlys Extension.appex"

entitlements() {
  cat > "$1" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.app-sandbox</key><true/>
  <key>com.apple.security.files.user-selected.read-only</key><true/>
  $2
</dict></plist>
PLIST
}
entitlements "$work/extension.plist" ""
entitlements "$work/app.plist" "<key>com.apple.security.network.client</key><true/>"

# Inside out: the extension first, then the app that holds it.
codesign --force --options runtime --entitlements "$work/extension.plist" --sign "$identity" "$extension"
codesign --force --options runtime --entitlements "$work/app.plist" --sign "$identity" "$built"
codesign --verify --deep --strict "$built"

rm -rf "$APP"
ditto "$built" "$APP"
"$LSREGISTER" -u "$built" >/dev/null 2>&1 || true
"$LSREGISTER" -f "$APP"

echo "Nordlys $version is in $APP, signed by $(codesign -dv "$APP" 2>&1 | sed -n 's/^TeamIdentifier=//p')."
if pgrep -x Safari >/dev/null; then
  echo "Quit Safari and open it again to load this build."
fi
