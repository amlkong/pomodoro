// "Bring your own" characters: picture-based characters loaded from a folder on
// this computer (see the app's "Add your own" menu item). They are never part of
// the app itself. The loading and pose matching happens in src/custom-characters.js.
window.CHARACTERS = window.CHARACTERS || {};

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

// The character's box is 140 wide by 150 tall. Every picture is shown at the
// same scale, so poses keep their real relative sizes and nothing is stretched.
function frameWidth(c, frame) {
  if (!frame.w || !c.size || !c.size.w) return null; // size unknown: just fit the box
  const ref = Math.max(c.size.w, c.size.h * (140 / 150));
  return `${(frame.w / ref) * 100}%`;
}

// Puts one picture into an <img>, falling back to idle if it can't be shown.
window.showCharacterFrame = (img, c, frame) => {
  const width = frameWidth(c, frame);
  img.classList.toggle('sized', Boolean(width));
  img.style.width = width || '';
  img.onerror = () => {
    img.onerror = null;
    const idle = c.frames.idle[0];
    if (frame !== idle) window.showCharacterFrame(img, c, idle);
  };
  img.src = frame.src;
};

// Drawn characters are SVG; custom ones are plain images.
window.characterMarkup = (c) => (c.frames ? '<img class="char-img" alt="" draggable="false">' : c.svg);
window.mountCharacter = (el, c) => {
  el.innerHTML = window.characterMarkup(c);
  if (c.frames) window.showCharacterFrame(el.querySelector('.char-img'), c, c.frames.idle[0]);
};

window.customCharactersReady = window.api.getCustomCharacters().then((packs) => {
  for (const pack of packs) {
    const moments = pack.moments.map((name) => ({ pose: `x-${name}`, ms: 2200 }));
    window.CHARACTERS[pack.id] = {
      name: pack.name,
      emoji: pack.emoji || '⭐',
      custom: true,
      frames: pack.frames,
      size: pack.size,
      idleActions: moments,
      breakActions: moments,
      lines: { ...DEFAULT_LINES, ...(pack.lines || {}) },
    };
  }
}).catch((e) => console.error('Could not load custom characters', e));
