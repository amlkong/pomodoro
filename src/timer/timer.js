const $ = (id) => document.getElementById(id);
const CIRC = 565.49;
const LABELS = {
  focus: ['ready when you are', 'stay with it', 'paused, no rush'],
  short: ['a little break', 'breathe and stretch', 'paused, no rush'],
  long: ['a long break', 'you earned this', 'paused, no rush'],
};
const SETTING_IDS = ['focusMin', 'shortMin', 'longMin', 'longEvery', 'autoStart', 'musicOnBreaks', 'spotifyClientId', 'spotifyPlaylist'];

const mini = $('mini');
mini.innerHTML = window.POMO_SVG;
let current = null;
let settingsFilled = false;

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
  $('roam').textContent = { screen: '🦦 whole screen', window: '🦦 in window', hidden: '🦦 hidden' }[where];

  mini.className = 'mini ' + (!s.running ? '' : s.phase === 'focus' ? 'sitting' : 'dancing');

  // one dot per focus round until the next long break
  const every = s.settings.longEvery;
  const done = s.completed % every;
  const filled = s.completed > 0 && done === 0 && s.phase === 'long' ? every : done;
  const dots = $('dots');
  if (dots.children.length !== every) dots.innerHTML = '<i></i>'.repeat(every);
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < filled));
  dots.title = `${s.completed} focus round${s.completed === 1 ? '' : 's'} today`;

  $('brain').classList.toggle('on', s.brainOpen);
  $('spot').classList.toggle('on', s.spotify.connected);
  $('spotConnect').textContent = s.spotify.connected ? 'Disconnect Spotify' : 'Connect Spotify';
  $('msg').textContent = s.spotify.message || '';

  if (!settingsFilled) {
    settingsFilled = true;
    for (const id of SETTING_IDS) {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = s.settings[id];
      else el.value = s.settings[id];
    }
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
$('toggle').onclick = () => window.api.toggle();
$('reset').onclick = () => window.api.reset();
$('skip').onclick = () => window.api.skip();
$('min').onclick = () => window.api.minimize();
$('close').onclick = () => window.api.close();
$('gear').onclick = () => showSettings($('settings').hidden);
$('done').onclick = () => showSettings(false);
$('brain').onclick = () => window.api.openBrainFm();
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
window.api.getState().then(render);
