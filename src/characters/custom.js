// "Bring your own" characters: picture-based characters loaded from a folder on
// this computer (see the app's "Add your own" menu item). They are never part of
// the app itself. Each one is a folder of images named after poses.
window.CHARACTERS = window.CHARACTERS || {};

// Drawn characters are SVG; custom ones are plain images.
window.characterMarkup = (c) => (c.frames
  ? `<img class="char-img" src="${c.frames.idle[0]}" alt="" draggable="false">`
  : c.svg);

// picture file name -> the pose the app uses it for
const POSE_FILES = { idle: 'idle', walk: 'walking', dance: 'dancing', sleep: 'sitting', happy: 'jumping', held: 'held' };

const DEFAULT_LINES = {
  focus: 'Focus time. I will be right here',
  break: 'Break time!',
  focusDone: 'You did it!! Break time',
  breakDone: 'Okay! Let\'s go again',
  taskDone: ['One down!', 'Nice one!', 'Yay!'],
  allDone: 'All done!! Amazing',
  dropped: 'whee!',
  pokes: ['hi!', 'you are doing great', 'I believe in you', 'boop!'],
};

window.customCharactersReady = window.api.getCustomCharacters().then((packs) => {
  for (const pack of packs) {
    if (!pack.frames.idle) continue; // idle is the one picture every character needs
    const frames = {};
    const idleActions = [];
    for (const [file, list] of Object.entries(pack.frames)) {
      if (POSE_FILES[file]) {
        frames[POSE_FILES[file]] = list;
      } else {
        // any other picture (sad, confused, wave...) becomes a little idle moment
        frames[`x-${file}`] = list;
        idleActions.push({ pose: `x-${file}`, ms: 2200 });
      }
    }
    window.CHARACTERS[pack.id] = {
      name: pack.name,
      emoji: pack.emoji || '⭐',
      custom: true,
      frames,
      idleActions,
      breakActions: [],
      lines: { ...DEFAULT_LINES, ...(pack.lines || {}) },
    };
  }
}).catch((e) => console.error('Could not load custom characters', e));
