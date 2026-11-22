const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCustomCharacters, mapPoses, buildPoses, pngSize, prettyName } = require('../src/custom-characters');

// The smallest thing the loader accepts as a PNG: the signature plus a header
// chunk carrying the width and height.
function fakePng(w, h) {
  const buf = Buffer.alloc(33);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}

function makeDir(layout) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomo-chars-'));
  for (const [file, content] of Object.entries(layout)) {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

const byName = (packs, name) => packs.find((p) => p.name === name);

test('an empty folder gives no characters and gets a HOW-TO', () => {
  const dir = makeDir({});
  assert.deepStrictEqual(loadCustomCharacters(dir), []);
  assert.ok(fs.existsSync(path.join(dir, 'HOW-TO.txt')));
});

test('a missing folder is created instead of crashing', () => {
  const dir = path.join(makeDir({}), 'does', 'not', 'exist');
  assert.deepStrictEqual(loadCustomCharacters(dir), []);
  assert.ok(fs.existsSync(dir));
});

test('each character folder is found, with a readable name and a safe id', () => {
  const dir = makeDir({
    'red_panda/idle.png': fakePng(100, 100),
    'Biscuit/idle.png': fakePng(100, 100),
    'loose-file.png': fakePng(10, 10),
  });
  const packs = loadCustomCharacters(dir);
  assert.deepStrictEqual(packs.map((p) => p.name).sort(), ['Biscuit', 'Red Panda']);
  assert.strictEqual(byName(packs, 'Red Panda').id, 'my-red-panda');
  assert.match(byName(packs, 'Biscuit').id, /^[a-z0-9-]{1,30}$/);
});

test('standard pose names land on the right app poses', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/walk.png': fakePng(100, 100),
    'Pal/dance.png': fakePng(100, 100),
    'Pal/sleep.png': fakePng(100, 100),
    'Pal/happy.png': fakePng(100, 100),
    'Pal/held.png': fakePng(100, 100),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.deepStrictEqual(Object.keys(pack.frames).sort(), ['dancing', 'held', 'idle', 'jumping', 'sitting', 'walking']);
  assert.deepStrictEqual(pack.moments, []);
});

test('alternative names are understood: run, cheer, sit, excited', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/run.png': fakePng(100, 100),
    'Pal/cheer.png': fakePng(100, 100),
    'Pal/sit.png': fakePng(100, 100),
    'Pal/excited.png': fakePng(100, 100),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.deepStrictEqual(pack.mapping, { idle: 'idle', walking: 'run', dancing: 'cheer', sitting: 'sit', jumping: 'excited', held: 'idle' });
});

test('sleep is preferred over sit for focus time, and sit then becomes a moment', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/sleep.png': fakePng(100, 100),
    'Pal/sit.png': fakePng(100, 100),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.strictEqual(pack.mapping.sitting, 'sleep');
  assert.deepStrictEqual(pack.moments, ['sit']);
});

test('missing poses fall back to idle rather than being left empty', () => {
  const dir = makeDir({ 'Pal/idle.png': fakePng(100, 100) });
  const [pack] = loadCustomCharacters(dir);
  assert.deepStrictEqual(Object.keys(pack.frames), ['idle']);
  for (const role of ['walking', 'dancing', 'sitting', 'jumping', 'held']) assert.strictEqual(pack.mapping[role], 'idle');
});

test('pictures with other names are kept as moments, none are dropped', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/confused.png': fakePng(100, 100),
    'Pal/shark-costume.png': fakePng(100, 100),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.deepStrictEqual(pack.moments, ['confused', 'shark-costume']);
  assert.ok(pack.frames['x-confused'] && pack.frames['x-shark-costume']);
});

test('numbered pictures of the same size are animation frames, in order', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/walk-2.png': fakePng(120, 90),
    'Pal/walk-10.png': fakePng(120, 90),
    'Pal/walk-1.png': fakePng(120, 90),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.strictEqual(pack.frames.walking.length, 3);
  assert.deepStrictEqual(pack.frames.walking.map((f) => f.n), [1, 2, 10]);
});

test('numbered pictures of different sizes are separate poses, not a fake animation', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/idle-2.png': fakePng(80, 90),
    'Pal/idle-3.png': fakePng(70, 95),
    'Pal/sad.png': fakePng(60, 60),
    'Pal/sad-2.png': fakePng(64, 80),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.strictEqual(pack.frames.idle.length, 1);
  assert.deepStrictEqual(pack.moments, ['idle-2', 'idle-3', 'sad', 'sad-2']);
  for (const m of pack.moments) assert.strictEqual(pack.frames[`x-${m}`].length, 1);
});

test('the pack size is the largest picture, so every pose shares one scale', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 200),
    'Pal/sleep.png': fakePng(300, 120),
  });
  const [pack] = loadCustomCharacters(dir);
  assert.deepStrictEqual(pack.size, { w: 300, h: 200 });
});

test('a folder without idle is skipped, and the others still load', () => {
  const dir = makeDir({
    'NoIdle/walk.png': fakePng(100, 100),
    'Good/idle.png': fakePng(100, 100),
  });
  assert.deepStrictEqual(loadCustomCharacters(dir).map((p) => p.name), ['Good']);
});

test('broken, empty and oversized pictures are skipped without crashing', () => {
  const dir = makeDir({
    'Pal/idle.png': fakePng(100, 100),
    'Pal/broken.png': Buffer.from('this is not a png'),
    'Pal/empty.png': Buffer.alloc(0),
    'Pal/huge.png': Buffer.concat([fakePng(100, 100), Buffer.alloc(3 * 1024 * 1024)]),
    'Pal/notes.txt': 'hello',
  });
  const [pack] = loadCustomCharacters(dir);
  assert.deepStrictEqual(Object.keys(pack.frames), ['idle']);
  assert.strictEqual(pack.skipped.length, 3);
});

test('a broken idle picture means the character is skipped, not shown broken', () => {
  const dir = makeDir({ 'Pal/idle.png': Buffer.from('nope'), 'Pal/walk.png': fakePng(10, 10) });
  assert.deepStrictEqual(loadCustomCharacters(dir), []);
});

test('character.json sets the name, emoji and lines; a bad one is ignored', () => {
  const dir = makeDir({
    'red_panda/idle.png': fakePng(100, 100),
    'red_panda/character.json': JSON.stringify({ name: 'Rusty', emoji: '🍂', lines: { pokes: ['hi'] } }),
    'other/idle.png': fakePng(100, 100),
    'other/character.json': '{ not json',
  });
  const packs = loadCustomCharacters(dir);
  const rusty = byName(packs, 'Rusty');
  assert.strictEqual(rusty.emoji, '🍂');
  assert.deepStrictEqual(rusty.lines, { pokes: ['hi'] });
  assert.strictEqual(rusty.id, 'my-red-panda'); // the id follows the folder, so the saved choice survives a rename in the json
  assert.ok(byName(packs, 'Other'));
});

test('pictures are passed through untouched', () => {
  const png = fakePng(40, 50);
  const dir = makeDir({ 'Pal/idle.png': png });
  const [pack] = loadCustomCharacters(dir);
  const [, b64] = pack.frames.idle[0].src.split(',');
  assert.ok(Buffer.from(b64, 'base64').equals(png));
  assert.match(pack.frames.idle[0].src, /^data:image\/png;base64,/);
});

test('helpers', () => {
  assert.deepStrictEqual(pngSize(fakePng(12, 34)), { w: 12, h: 34 });
  assert.strictEqual(pngSize(Buffer.from('nope')), null);
  assert.strictEqual(prettyName('red_panda'), 'Red Panda');
  assert.strictEqual(prettyName('McFluff'), 'McFluff');
  assert.strictEqual(mapPoses(buildPoses({ walk: [{ n: 0, w: 1, h: 1 }] })), null);
});
