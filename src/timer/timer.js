const $ = (id) => document.getElementById(id);
const CIRC = 565.49;
const LABELS = {
  focus: ['ready when you are', 'stay with it', 'paused, no rush'],
  short: ['a little break', 'breathe and stretch', 'paused, no rush'],
  long: ['a long break', 'you earned this', 'paused, no rush'],
};
const SETTING_IDS = ['focusMin', 'shortMin', 'longMin', 'longEvery', 'autoStart', 'alarmSound', 'petScale', 'musicOnBreaks', 'spotifyClientId', 'spotifyPlaylist'];

const mini = $('mini');
let miniChar = '';
let current = null;
let settingsFilled = false;
let tasksKey = '';

function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render(s) {
  current = s;
  document.body.dataset.phase = s.phase;
  $('time').textContent = fmt(s.remainingMs);
  document.title = `${fmt(s.remainingMs)} · Pomo`;
  $('prog').style.strokeDashoffset = CIRC * (1 - s.remainingMs / s.totalMs);

  const fresh = s.remainingMs === s.totalMs;
  $('label').textContent = LABELS[s.phase][s.running ? 1 : fresh ? 0 : 2];
  $('toggle').textContent = s.running ? 'Pause' : fresh ? 'Start' : 'Resume';

  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.phase === s.phase));

  // the little Pomo in the ring mirrors what the big one is doing
  const where = !s.settings.showPet ? 'hidden' : s.settings.petRoam;
  document.body.classList.toggle('pet-in', where === 'window');
  const charId = window.CHARACTERS[s.settings.character] ? s.settings.character : Object.keys(window.CHARACTERS)[0];
  const char = window.CHARACTERS[charId];
  if (charId !== miniChar) {
    miniChar = charId;
    window.mountCharacter(mini, char);
    mini.classList.toggle('img-char', Boolean(char.frames));
  }
  $('roam').textContent = `${char.emoji} ${{ screen: 'on screen', window: 'in window', hidden: 'hidden' }[where]}`;
  $('swap').title = `Choose character (now: ${char.name})`;
  document.body.classList.toggle('max', s.maximized);
  $('max').textContent = s.maximized ? '❐' : '□';
  $('max').title = s.maximized ? 'Restore' : 'Maximize';
  $('update').hidden = !s.update;
  if (s.update) {
    $('update').textContent = s.update.status === 'ready'
      ? `✨ Version ${s.update.version} is ready · restart`
      : `✨ Version ${s.update.version} is out · download`;
  }

  const miniPose = !s.running ? '' : s.phase === 'focus' ? 'sitting' : 'dancing';
  mini.className = 'mini ' + (char.frames ? 'img-char ' : '') + miniPose;
  if (char.frames && mini.dataset.pose !== `${charId}:${miniPose}`) {
    mini.dataset.pose = `${charId}:${miniPose}`;
    const img = mini.querySelector('.char-img');
    if (img) window.showCharacterFrame(img, char, (char.frames[miniPose] || char.frames.idle)[0]);
  }

  // one dot per focus round until the next long break
  const every = s.settings.longEvery;
  const done = s.completed % every;
  const filled = s.completed > 0 && done === 0 && s.phase === 'long' ? every : done;
  const dots = $('dots');
  if (dots.children.length !== every) dots.innerHTML = '<i></i>'.repeat(every);
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < filled));
  dots.title = `${s.completed} focus round${s.completed === 1 ? '' : 's'} today`;

  $('spot').classList.toggle('on', s.spotify.connected);
  $('spotConnect').textContent = s.spotify.connected ? 'Disconnect Spotify' : 'Connect Spotify';
  $('msg').textContent = s.spotify.message || '';

  renderTasks(s.settings.tasks || []);
  if (document.activeElement !== $('petScale')) $('petScale').value = s.settings.petScale;

  if (!settingsFilled) {
    settingsFilled = true;
    for (const id of SETTING_IDS) {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = s.settings[id];
      else el.value = s.settings[id];
    }
  }
}

// The state arrives several times a second, so only rebuild the list when it really changed.
function renderTasks(tasks) {
  const key = JSON.stringify(tasks);
  if (key === tasksKey) return;
  tasksKey = key;
  const left = tasks.filter((t) => !t.done).length;
  $('todoCount').textContent = !tasks.length ? 'To do' : left ? `To do · ${left} left` : 'To do · all done!';
  $('clearDone').hidden = !tasks.some((t) => t.done);
  const ul = $('tasks');
  ul.textContent = '';
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = t.done ? 'done' : '';
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = t.done;
    box.onchange = () => window.api.toggleTask(t.id);
    const text = document.createElement('span');
    text.textContent = t.text;
    label.append(box, text);
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Remove';
    del.setAttribute('aria-label', `Remove ${t.text}`);
    del.onclick = () => window.api.removeTask(t.id);
    li.append(label, del);
    ul.append(li);
  }
}

function showSettings(show) {
  $('settings').hidden = !show;
  $('main').hidden = show;
}

// one button cycles where Pomo lives: whole screen, in this window, hidden
$('roam').onclick = () => {
  if (!current) return;
  const { showPet, petRoam } = current.settings;
  if (!showPet) window.api.updateSettings({ showPet: true, petRoam: 'screen' });
  else if (petRoam === 'screen') window.api.updateSettings({ petRoam: 'window' });
  else window.api.updateSettings({ showPet: false });
};
// character picker: a little menu listing everyone in src/characters
const charMenu = $('charMenu');
function buildCharMenu() {
  charMenu.textContent = '';
  for (const [id, c] of Object.entries(window.CHARACTERS)) {
    const item = document.createElement('button');
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(id === miniChar));
    item.className = id === miniChar ? 'on' : '';
    const pic = document.createElement('span');
    pic.className = 'pic';
    window.mountCharacter(pic, c);
    const name = document.createElement('span');
    name.textContent = c.name;
    item.append(pic, name);
    item.onclick = () => {
      charMenu.hidden = true;
      window.api.updateSettings({ character: id, ...(current && !current.settings.showPet ? { showPet: true } : {}) });
    };
    charMenu.append(item);
  }
  const add = document.createElement('button');
  add.className = 'add first';
  add.textContent = '＋ Add your own…';
  add.title = 'Opens the folder where you can drop in your own character pictures';
  add.onclick = () => {
    charMenu.hidden = true;
    window.api.openCharactersFolder();
  };
  charMenu.append(add);
  const refresh = document.createElement('button');
  refresh.className = 'add';
  refresh.textContent = '↻ Refresh list';
  refresh.title = 'Re-read your own characters after adding or changing pictures';
  refresh.onclick = () => window.api.reloadCharacters();
  charMenu.append(refresh);
}
$('swap').onclick = (e) => {
  e.stopPropagation();
  if (charMenu.hidden) buildCharMenu();
  charMenu.hidden = !charMenu.hidden;
};
document.addEventListener('click', (e) => {
  if (!charMenu.hidden && !charMenu.contains(e.target)) charMenu.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') charMenu.hidden = true;
});

// alarm: a soft three-note chime, made on the spot so there is no sound file to ship
let audioCtx = null;
function chime(repeats = 3) {
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [659.25, 783.99, 1046.5]; // E5, G5, C6
    const start = audioCtx.currentTime + 0.05;
    for (let r = 0; r < repeats; r++) {
      notes.forEach((freq, i) => {
        const t = start + r * 1.15 + i * 0.17;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.75);
      });
    }
  } catch (err) {
    console.error('Could not play the alarm', err);
  }
}
window.api.onPetEvent((e) => {
  if (e.type === 'phase-end' && current && current.settings.alarmSound) chime();
});
$('alarmSound').addEventListener('change', (e) => { if (e.target.checked) chime(1); });

$('max').onclick = () => window.api.maximize();
$('update').onclick = () => window.api.applyUpdate();
$('toggle').onclick = () => window.api.toggle();
$('reset').onclick = () => window.api.reset();
$('skip').onclick = () => window.api.skip();
$('min').onclick = () => window.api.minimize();
$('close').onclick = () => window.api.close();
$('gear').onclick = () => showSettings($('settings').hidden);
$('done').onclick = () => showSettings(false);
$('spot').onclick = () => {
  if (current && current.spotify.connected) $('msg').textContent = 'Spotify is connected. It plays when you focus.';
  else showSettings(true);
};
$('spotConnect').onclick = () => {
  if (current && current.spotify.connected) window.api.spotifyDisconnect();
  else {
    window.api.spotifyConnect();
    showSettings(false);
  }
};
$('newTask').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  window.api.addTask(e.target.value);
  e.target.value = '';
});
$('clearDone').onclick = () => window.api.clearDoneTasks();
document.querySelectorAll('.tabs button').forEach((b) => {
  b.onclick = () => window.api.setPhase(b.dataset.phase);
});
for (const id of SETTING_IDS) {
  const el = $(id);
  el.addEventListener('change', () => {
    window.api.updateSettings({ [id]: el.type === 'checkbox' ? el.checked : el.value });
  });
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    window.api.toggle();
  }
});

window.api.onState(render);
window.customCharactersReady.then(() => window.api.getState()).then(render);
