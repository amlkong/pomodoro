// Loads picture-based characters from a folder on the user's own computer.
// One sub-folder per character, pictures named after poses. Nothing here is
// ever bundled into the app or the repo: it is read from disk at startup.
const fs = require('fs');
const path = require('path');

const IMAGE_TYPES = { '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILES = 80;
const MAX_PACKS = 30;

// What the app does -> picture names it will use for it, best match first.
// "idle" is the only picture a character must have; anything missing uses it.
const ROLES = {
  walking: ['walk', 'walking', 'run', 'running'],
  dancing: ['dance', 'dancing', 'cheer'],
  sitting: ['sleep', 'sleeping', 'sit', 'sitting', 'rest'], // focus time
  jumping: ['happy', 'excited', 'celebrate', 'jump'],       // celebrating
  held: ['held', 'carried'],
};

const HOW_TO = `Add your own characters to Pomo
================================

1. In this folder, make a new folder for your character. Its name is the
   character's name, for example:  Biscuit

2. Put pictures inside it, named after poses. PNG with a see-through
   background looks best. The character should face RIGHT.

     idle.png     standing around          (the only one you must have)
     walk.png     moving                   (or run.png)
     dance.png    break time               (or cheer.png)
     sleep.png    focus time               (or sit.png)
     happy.png    celebrating              (or excited.png)
     held.png     being picked up

   Any pose you leave out just uses idle.png.

3. Any other picture becomes a little moment your character does now and
   then, for example:  sad.png  confused.png  wave.png

4. Numbered pictures:
   - Same pixel size  = animation frames, played in order:
       walk-1.png  walk-2.png  walk-3.png
   - Different sizes  = separate poses, each shown as its own moment:
       sad.png  sad-2.png

5. In Pomo, open the character menu and click "Refresh list" (or just
   restart Pomo). Your character is now in the menu.

Optional: add a file called character.json to set the name and what they say:
  { "name": "Biscuit", "emoji": "🍪", "lines": { "pokes": ["hi!", "woof"] } }

Keep each picture under 3 MB. Pictures are shown at their real relative
sizes, so crop all poses of one character from art drawn at the same scale.

Please only use pictures you made or have the right to use.
`;

// Width and height from a PNG's header, or null if it isn't a real PNG.
function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return w > 0 && h > 0 ? { w, h } : null;
}

// "red_panda" -> "Red Panda". Names that already have capitals are left alone.
function prettyName(folder) {
  const spaced = folder.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (spaced !== spaced.toLowerCase()) return spaced.slice(0, 24);
  return spaced.replace(/\b[a-z]/g, (c) => c.toUpperCase()).slice(0, 24);
}

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

// Turns the pictures found in one folder into poses.
// `pictures` is { stem: [{ n, src, w, h }] } where "sad-2.png" has stem "sad", n 2.
function buildPoses(pictures) {
  const poses = {};
  for (const [stem, list] of Object.entries(pictures)) {
    list.sort((a, b) => a.n - b.n);
    const sameSize = list.every((f) => f.w === list[0].w && f.h === list[0].h);
    if (list.length === 1 || sameSize) {
      poses[stem] = list; // one picture, or a real frame-by-frame animation
    } else {
      // differently sized numbered pictures are separate drawings, not frames
      for (const f of list) poses[f.n ? `${stem}-${f.n}` : stem] = [f];
    }
  }
  return poses;
}

// Decides which picture is used for what. Returns the frames keyed by the
// app's own pose names, the leftover pictures as "moments", and a readable
// summary of the choices.
function mapPoses(poses) {
  if (!poses.idle) return null;
  const frames = { idle: poses.idle };
  const mapping = { idle: 'idle' };
  const used = new Set(['idle']);
  for (const [role, names] of Object.entries(ROLES)) {
    const found = names.find((n) => poses[n]);
    if (found) {
      frames[role] = poses[found];
      used.add(found);
    }
    mapping[role] = found || 'idle';
  }
  const moments = [];
  for (const name of Object.keys(poses).sort()) {
    if (used.has(name)) continue;
    frames[`x-${name}`] = poses[name];
    moments.push(name);
  }
  return { frames, moments, mapping };
}

function loadPack(folder, folderName) {
  const slug = slugify(folderName);
  if (!slug) return null;
  const pack = { id: `my-${slug}`, name: prettyName(folderName), skipped: [] };
  const pictures = {};
  const files = fs.readdirSync(folder).sort().slice(0, MAX_FILES);
  for (const file of files) {
    const full = path.join(folder, file);
    const ext = path.extname(file).toLowerCase();
    if (file.toLowerCase() === 'character.json') {
      try {
        const info = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (typeof info.name === 'string' && info.name.trim()) pack.name = info.name.trim().slice(0, 24);
        if (typeof info.emoji === 'string') pack.emoji = info.emoji.slice(0, 4);
        if (info.lines && typeof info.lines === 'object' && !Array.isArray(info.lines)) pack.lines = info.lines;
      } catch {
        pack.skipped.push(`${file}: not valid JSON`);
      }
      continue;
    }
    if (!IMAGE_TYPES[ext]) continue;
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isFile()) continue;
    if (stat.size > MAX_FILE_BYTES) { pack.skipped.push(`${file}: larger than 3 MB`); continue; }
    if (stat.size === 0) { pack.skipped.push(`${file}: empty file`); continue; }
    const buf = fs.readFileSync(full);
    const size = ext === '.png' ? pngSize(buf) : { w: 0, h: 0 };
    if (!size) { pack.skipped.push(`${file}: not a readable PNG`); continue; }
    const base = path.basename(file, ext).toLowerCase();
    const numbered = base.match(/^(.*?)[-_ ]?(\d+)$/);
    const stem = (numbered && numbered[1] ? numbered[1] : base).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!stem) continue;
    (pictures[stem] = pictures[stem] || []).push({
      n: numbered && numbered[1] ? Number(numbered[2]) : 0,
      src: `data:${IMAGE_TYPES[ext]};base64,${buf.toString('base64')}`,
      w: size.w,
      h: size.h,
    });
  }
  const mapped = mapPoses(buildPoses(pictures));
  if (!mapped) return { ...pack, error: 'no idle picture' };
  // the biggest picture decides the scale, so every pose keeps its real relative size
  let w = 0;
  let h = 0;
  for (const list of Object.values(mapped.frames)) for (const f of list) { w = Math.max(w, f.w); h = Math.max(h, f.h); }
  return { ...pack, ...mapped, size: { w, h } };
}

// Reads every character folder in `dir`. Never throws: a broken folder is
// skipped and reported, and the rest still load.
function loadCustomCharacters(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'HOW-TO.txt'), HOW_TO);
  } catch {
    return [];
  }
  const packs = [];
  const seen = new Set();
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || packs.length >= MAX_PACKS) continue;
    try {
      const pack = loadPack(path.join(dir, entry.name), entry.name);
      if (!pack) continue;
      if (pack.error) { console.error(`Custom character "${entry.name}" skipped: ${pack.error}`); continue; }
      if (seen.has(pack.id)) continue;
      seen.add(pack.id);
      if (pack.skipped.length) console.error(`Custom character "${entry.name}":`, pack.skipped.join('; '));
      packs.push(pack);
    } catch (e) {
      console.error(`Custom character "${entry.name}" skipped:`, e.message);
    }
  }
  return packs;
}

module.exports = { loadCustomCharacters, loadPack, buildPoses, mapPoses, pngSize, prettyName, ROLES, HOW_TO };
