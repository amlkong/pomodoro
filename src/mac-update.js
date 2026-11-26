// Self-update for the Mac app.
//
// Macs normally only let an app replace itself if it is signed with a paid
// Apple developer certificate. Pomo isn't, so it does the job by hand: download
// the new .dmg from this repo's releases, check it arrived intact, then hand
// over to a small shell script that swaps the app once Pomo has quit and opens
// it again. If anything goes wrong the old app is put back.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const RELEASES_API = 'https://api.github.com/repos/amlkong/pomodoro/releases/latest';
const newer = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }) > 0;

// From the latest release: is there a newer version, and which file is for this Mac?
// `arch` is 'arm64' (Apple Silicon) or 'x64' (Intel).
function pickUpdate(release, currentVersion, arch) {
  const version = String((release && release.tag_name) || '').replace(/^v/, '');
  if (!version || !newer(version, currentVersion)) return null;
  const wanted = `-mac-${arch}.dmg`;
  const asset = ((release && release.assets) || []).find((a) => a && typeof a.name === 'string' && a.name.endsWith(wanted) && a.state !== 'new');
  return {
    version,
    page: release.html_url || '',
    // the Mac files are added to a release a few minutes after the Windows one
    dmg: asset ? {
      name: asset.name,
      url: asset.browser_download_url,
      size: Number(asset.size) || 0,
      sha256: /^sha256:[0-9a-f]{64}$/.test(asset.digest || '') ? asset.digest.slice(7) : '',
    } : null,
  };
}

// ".../Pomo.app/Contents/MacOS/Pomo" -> ".../Pomo.app"
function bundlePath(execPath) {
  const m = String(execPath || '').match(/^(.*\.app)\/Contents\/MacOS\/[^/]+$/);
  return m ? m[1] : '';
}

// Can this copy of the app replace itself? Not when it is being run straight
// from the downloaded disk image, or from the hidden read-only place macOS
// runs apps that haven't been moved to Applications yet.
function canSelfUpdate(bundle, canWrite = defaultCanWrite) {
  if (!bundle) return { ok: false, why: 'This copy of Pomo can\'t update itself.' };
  if (bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/')) {
    return { ok: false, why: 'Move Pomo into your Applications folder and open it from there to get automatic updates.' };
  }
  if (!canWrite(path.dirname(bundle))) {
    return { ok: false, why: 'Pomo isn\'t allowed to change the folder it lives in, so it can\'t update itself.' };
  }
  return { ok: true, why: '' };
}

function defaultCanWrite(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}

async function latestRelease() {
  const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return res.json();
}

// Downloads the .dmg and makes sure it is complete and unaltered.
async function download(dmg, dir, onProgress = () => {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, dmg.name.replace(/[^A-Za-z0-9._-]/g, '_'));
  const res = await fetch(dmg.url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status})`);
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(file);
  let got = 0;
  try {
    for await (const chunk of res.body) {
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
      if (dmg.size) onProgress(Math.min(100, Math.round((got / dmg.size) * 100)));
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }
  if (dmg.size && got !== dmg.size) throw new Error('The download was cut short');
  if (dmg.sha256 && hash.digest('hex') !== dmg.sha256) throw new Error('The download didn\'t match the published file');
  return file;
}

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // quote for the shell

// The script that does the swap. It runs on its own after Pomo has quit.
function installScript({ dmg, bundle, pid, relaunch = true }) {
  return `#!/bin/bash
# Replaces Pomo with the version inside the downloaded disk image.
DMG=${q(dmg)}
APP=${q(bundle)}
MNT="$(mktemp -d /tmp/pomo-update.XXXXXX)"
NEW="$APP.new"
OLD="$APP.old"

finish() {
  hdiutil detach "$MNT" -quiet -force >/dev/null 2>&1
  rmdir "$MNT" >/dev/null 2>&1
  rm -rf "$NEW"
  ${relaunch ? 'open "$APP"' : ':'}
  exit "$1"
}

# wait for the running Pomo to close (up to 30 seconds)
for i in $(seq 1 60); do
  kill -0 ${Number(pid) || 0} >/dev/null 2>&1 || break
  sleep 0.5
done

hdiutil attach "$DMG" -nobrowse -readonly -quiet -mountpoint "$MNT" || finish 1
SRC="$(ls -d "$MNT"/*.app 2>/dev/null | head -n 1)"
[ -d "$SRC" ] || finish 1

# copy the new app next to the old one first, so a failed copy changes nothing
rm -rf "$NEW" "$OLD"
ditto "$SRC" "$NEW" || finish 1
[ -x "$NEW/Contents/MacOS/$(basename "$APP" .app)" ] || finish 1

# swap them, and put the old one back if the swap fails
mv "$APP" "$OLD" || finish 1
if ! mv "$NEW" "$APP"; then
  mv "$OLD" "$APP"
  finish 1
fi
rm -rf "$OLD"
xattr -dr com.apple.quarantine "$APP" >/dev/null 2>&1
rm -f "$DMG"
finish 0
`;
}

// Starts the swap script on its own, so it carries on after Pomo quits.
// `relaunch` false installs quietly without opening Pomo again afterwards.
function startInstall({ dmg, bundle, pid, dir, relaunch = true }) {
  const script = path.join(dir, 'install-update.sh');
  fs.writeFileSync(script, installScript({ dmg, bundle, pid, relaunch }), { mode: 0o700 });
  const child = spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' });
  child.unref();
}

module.exports = { pickUpdate, bundlePath, canSelfUpdate, latestRelease, download, installScript, startInstall, newer };
