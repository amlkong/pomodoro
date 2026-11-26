#!/bin/bash
# Runs on the Mac build machine after the installers are built. It performs a
# real self-update: an "installed" copy of Pomo is replaced from the freshly
# built disk image using the same script the app uses, and the result is checked.
# It also checks that a broken download leaves the installed app untouched.
set -u
VERSION="$1"

DMG_BUILT="$(ls dist/*-mac-arm64.dmg | head -n 1)"
APP_BUILT="dist/mac-arm64/Pomo.app"
[ -f "$DMG_BUILT" ] || { echo "FAIL: no arm64 disk image was built"; exit 1; }
[ -d "$APP_BUILT" ] || { echo "FAIL: no built app at $APP_BUILT"; exit 1; }

WORK="$(mktemp -d)"
INSTALLED="$WORK/My Apps/Pomo.app"   # a space in the path, on purpose
mkdir -p "$WORK/My Apps"
fail() { echo "FAIL: $1"; exit 1; }

# pretend an older Pomo is installed: a copy with a marker file only the old one has
install_old() {
  rm -rf "$INSTALLED"
  ditto "$APP_BUILT" "$INSTALLED"
  touch "$INSTALLED/Contents/OLD_VERSION_MARKER"
}

make_script() { # $1 = disk image to install from, $2 = where to write the script
  node -e "
    const m = require('./src/mac-update');
    process.stdout.write(m.installScript({ dmg: process.argv[1], bundle: process.argv[2], pid: 999999, relaunch: false }));
  " "$1" "$INSTALLED" > "$2"
}

echo "== 1. a good update replaces the app =="
install_old
cp "$DMG_BUILT" "$WORK/update.dmg"   # a copy, because a successful install deletes its download
make_script "$WORK/update.dmg" "$WORK/install.sh"
bash "$WORK/install.sh"; CODE=$?
[ "$CODE" -eq 0 ] || fail "the swap script exited with $CODE"
[ -d "$INSTALLED" ] || fail "the app is gone after the update"
[ ! -e "$INSTALLED/Contents/OLD_VERSION_MARKER" ] || fail "the old app is still there"
[ -x "$INSTALLED/Contents/MacOS/Pomo" ] || fail "the new app has no program inside"
GOT="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INSTALLED/Contents/Info.plist")"
[ "$GOT" = "$VERSION" ] || fail "expected version $VERSION, the installed app says $GOT"
codesign --verify --deep --strict "$INSTALLED" || fail "the installed app's signature is not valid"
[ ! -e "$INSTALLED.new" ] && [ ! -e "$INSTALLED.old" ] || fail "leftover .new or .old copies"
[ ! -e "$WORK/update.dmg" ] || fail "the used download was not cleaned up"
if mount | grep -q "pomo-update"; then fail "the disk image is still mounted"; fi
echo "ok: replaced, version $GOT, signature valid, nothing left behind"

echo "== 2. a broken download changes nothing =="
install_old
echo "this is not a disk image" > "$WORK/broken.dmg"
make_script "$WORK/broken.dmg" "$WORK/install-broken.sh"
bash "$WORK/install-broken.sh"; CODE=$?
[ "$CODE" -ne 0 ] || fail "the swap script claimed success with a broken download"
[ -e "$INSTALLED/Contents/OLD_VERSION_MARKER" ] || fail "the installed app was changed by a broken download"
[ -x "$INSTALLED/Contents/MacOS/Pomo" ] || fail "the installed app was damaged by a broken download"
[ ! -e "$INSTALLED.new" ] && [ ! -e "$INSTALLED.old" ] || fail "leftover .new or .old copies after a failed update"
echo "ok: the installed app was left exactly as it was"

rm -rf "$WORK"
echo "Mac self-update check passed"
