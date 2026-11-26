const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { pickUpdate, bundlePath, canSelfUpdate, download, installScript, newer } = require('../src/mac-update');

const SHA = 'a'.repeat(64);
const release = (assets) => ({ tag_name: 'v0.1.30', html_url: 'https://github.com/amlkong/pomodoro/releases/tag/v0.1.30', assets });
const asset = (name, extra = {}) => ({ name, browser_download_url: `https://example.com/${name}`, size: 100, digest: `sha256:${SHA}`, state: 'uploaded', ...extra });

test('versions compare as numbers, not text', () => {
  assert.ok(newer('0.1.10', '0.1.9'));
  assert.ok(!newer('0.1.9', '0.1.10'));
  assert.ok(!newer('0.1.25', '0.1.25'));
});

test('picks the file for this kind of Mac', () => {
  const rel = release([asset('Pomo-Setup-0.1.30.exe'), asset('Pomo-0.1.30-mac-x64.dmg'), asset('Pomo-0.1.30-mac-arm64.dmg')]);
  assert.strictEqual(pickUpdate(rel, '0.1.25', 'arm64').dmg.name, 'Pomo-0.1.30-mac-arm64.dmg');
  assert.strictEqual(pickUpdate(rel, '0.1.25', 'x64').dmg.name, 'Pomo-0.1.30-mac-x64.dmg');
  assert.deepStrictEqual(pickUpdate(rel, '0.1.25', 'arm64').dmg, { name: 'Pomo-0.1.30-mac-arm64.dmg', url: 'https://example.com/Pomo-0.1.30-mac-arm64.dmg', size: 100, sha256: SHA });
});

test('nothing to do when already on the latest version, or the release is unreadable', () => {
  assert.strictEqual(pickUpdate(release([asset('Pomo-0.1.30-mac-arm64.dmg')]), '0.1.30', 'arm64'), null);
  assert.strictEqual(pickUpdate(release([asset('Pomo-0.1.30-mac-arm64.dmg')]), '0.1.31', 'arm64'), null);
  assert.strictEqual(pickUpdate({}, '0.1.25', 'arm64'), null);
  assert.strictEqual(pickUpdate(null, '0.1.25', 'arm64'), null);
});

test('a release whose Mac file has not been added yet is recognised, with no file to fetch', () => {
  const up = pickUpdate(release([asset('Pomo-Setup-0.1.30.exe')]), '0.1.25', 'arm64');
  assert.strictEqual(up.version, '0.1.30');
  assert.strictEqual(up.dmg, null);
  // a file still being uploaded is not used either
  assert.strictEqual(pickUpdate(release([asset('Pomo-0.1.30-mac-arm64.dmg', { state: 'new' })]), '0.1.25', 'arm64').dmg, null);
});

test('finds the app from the program inside it', () => {
  assert.strictEqual(bundlePath('/Applications/Pomo.app/Contents/MacOS/Pomo'), '/Applications/Pomo.app');
  assert.strictEqual(bundlePath('/Users/a b/Apps/Pomo.app/Contents/MacOS/Pomo'), '/Users/a b/Apps/Pomo.app');
  assert.strictEqual(bundlePath('/usr/local/bin/electron'), '');
});

test('only a properly installed copy updates itself', () => {
  const yes = () => true;
  assert.strictEqual(canSelfUpdate('/Applications/Pomo.app', yes).ok, true);
  assert.match(canSelfUpdate('/Volumes/Pomo 0.1.30/Pomo.app', yes).why, /Applications folder/);
  assert.match(canSelfUpdate('/private/var/folders/x/T/AppTranslocation/ABC/d/Pomo.app', yes).why, /Applications folder/);
  assert.match(canSelfUpdate('/Applications/Pomo.app', () => false).why, /isn't allowed/);
  assert.strictEqual(canSelfUpdate('', yes).ok, false);
});

test('download: saves the file and checks its size and fingerprint', async () => {
  const body = Buffer.from('pretend this is a disk image');
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomo-dl-'));
  const serve = () => { global.fetch = async () => ({ ok: true, status: 200, body: (async function* gen() { yield body.subarray(0, 10); yield body.subarray(10); }()) }); };
  const seen = [];
  serve();
  const file = await download({ name: 'Pomo-0.1.30-mac-arm64.dmg', url: 'https://example.com/x', size: body.length, sha256: sha }, dir, (p) => seen.push(p));
  assert.ok(fs.readFileSync(file).equals(body));
  assert.strictEqual(seen[seen.length - 1], 100);
  serve();
  await assert.rejects(download({ name: 'a.dmg', url: 'u', size: body.length + 5, sha256: sha }, dir), /cut short/);
  serve();
  await assert.rejects(download({ name: 'a.dmg', url: 'u', size: body.length, sha256: 'b'.repeat(64) }, dir), /didn't match/);
  global.fetch = async () => ({ ok: false, status: 404, body: null });
  await assert.rejects(download({ name: 'a.dmg', url: 'u', size: 1, sha256: '' }, dir), /download failed \(404\)/);
});

test('the swap script is valid shell, quotes awkward paths, and can skip reopening', () => {
  const script = installScript({ dmg: "/tmp/it's here/Pomo.dmg", bundle: '/Applications/My Apps/Pomo.app', pid: 4242, relaunch: false });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pomo-sh-')), 'install.sh');
  fs.writeFileSync(file, script);
  execFileSync('/bin/bash', ['-n', file]); // syntax check only, nothing is run
  assert.match(script, /DMG='\/tmp\/it'\\''s here\/Pomo\.dmg'/);
  assert.match(script, /APP='\/Applications\/My Apps\/Pomo\.app'/);
  assert.match(script, /kill -0 4242 /);
  assert.ok(!/^\s*open "\$APP"/m.test(script));
  assert.match(installScript({ dmg: '/a.dmg', bundle: '/Applications/Pomo.app', pid: 1 }), /^\s*open "\$APP"/m);
});

test('the swap script puts the old app back if the swap itself fails', () => {
  const script = installScript({ dmg: '/a.dmg', bundle: '/Applications/Pomo.app', pid: 1 });
  assert.match(script, /if ! mv "\$NEW" "\$APP"; then\s+mv "\$OLD" "\$APP"/);
  // the new copy is fully made before the old one is touched
  assert.ok(script.indexOf('ditto "$SRC" "$NEW"') < script.indexOf('mv "$APP" "$OLD"'));
});
