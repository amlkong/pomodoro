const { app, BrowserWindow, ipcMain, Notification, screen, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const spotify = require('./spotify');

const DEFAULTS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStart: true,
  showPet: true,
  alarmSound: true,
  petScale: 1, // character size, 0.5 to 2.5
  character: 'otter', // a file name from src/characters
  petRoam: 'screen', // 'screen' = whole desktop, 'window' = inside the timer window
  musicOnBreaks: false,
  spotifyClientId: '',
  spotifyPlaylist: '',
  spotifyRefresh: '',
  tasks: [], // { id, text, done }
};
const DURATION_KEY = { focus: 'focusMin', short: 'shortMin', long: 'longMin' };

let settings = { ...DEFAULTS };
let timerWin = null;
let petWin = null;

const state = { phase: 'focus', running: false, remainingMs: 0, totalMs: 0, completed: 0 };
let restoreBounds = null; // set while the timer window is maximized
let update = null;        // { status: 'downloading' | 'ready' | 'available', version, url? }
let autoUpdater = null;
const startedAt = Date.now();
let endAt = 0;
let spotifyMsg = '';
let lastWantMusic = null;

// ---------- settings ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
    if (!Array.isArray(settings.tasks)) settings.tasks = [];
    settings.petScale = Math.min(2.5, Math.max(0.5, Number(settings.petScale) || 1));
  } catch {
    settings = { ...DEFAULTS, tasks: [] };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Could not save settings', e);
  }
}

// The Spotify refresh token is kept encrypted with the OS keychain when possible.
function readRefreshToken() {
  const raw = settings.spotifyRefresh;
  if (!raw) return '';
  if (raw.startsWith('enc:')) {
    try { return safeStorage.decryptString(Buffer.from(raw.slice(4), 'base64')); } catch { return ''; }
  }
  return raw;
}

function writeRefreshToken(token) {
  if (token && safeStorage.isEncryptionAvailable()) {
    settings.spotifyRefresh = 'enc:' + safeStorage.encryptString(token).toString('base64');
  } else {
    settings.spotifyRefresh = token || '';
  }
  saveSettings();
}

// ---------- timer ----------
const durationMs = (phase) => settings[DURATION_KEY[phase]] * 60 * 1000;

function setPhase(phase) {
  state.phase = phase;
  state.totalMs = state.remainingMs = durationMs(phase);
  if (state.running) endAt = Date.now() + state.remainingMs;
}

function publicState() {
  const { spotifyRefresh, ...safeSettings } = settings;
  return {
    ...state,
    settings: safeSettings,
    spotify: { connected: spotify.isConnected(), message: spotifyMsg },
    maximized: Boolean(restoreBounds),
    update,
  };
}

function broadcast() {
  const s = publicState();
  for (const w of [timerWin, petWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('state', s);
  }
}

function petEvent(payload) {
  for (const w of [timerWin, petWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('pet:event', payload);
  }
}

function setRunning(running) {
  if (running === state.running) return;
  if (running) endAt = Date.now() + state.remainingMs;
  else state.remainingMs = Math.max(0, endAt - Date.now());
  state.running = running;
  syncMusic();
  broadcast();
}

function finishPhase(skipped) {
  const was = state.phase;
  if (was === 'focus' && !skipped) state.completed += 1;

  let next = 'focus';
  if (was === 'focus') {
    next = !skipped && state.completed % settings.longEvery === 0 ? 'long' : 'short';
  }
  if (!skipped) state.running = settings.autoStart;
  setPhase(next);

  if (!skipped) {
    const title = was === 'focus' ? 'Nice work! Break time 🍅' : 'Break is over';
    const body = was === 'focus'
      ? (next === 'long' ? 'You earned a long one. Go stretch!' : 'Take a few minutes. Grab some water.')
      : 'Ready for another round? You got this.';
    if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
    petEvent({ type: 'phase-end', from: was, to: next });
  }
  syncMusic();
  broadcast();
}

function tick() {
  if (!state.running) return;
  state.remainingMs = Math.max(0, endAt - Date.now());
  if (state.remainingMs <= 0) finishPhase(false);
  else broadcast();
}

// ---------- music ----------
function syncMusic() {
  const want = state.running && (state.phase === 'focus' || settings.musicOnBreaks);

  if (want === lastWantMusic) return;
  lastWantMusic = want;
  if (!spotify.isConnected()) return;
  const job = want ? spotify.play(settings.spotifyPlaylist) : spotify.pause();
  job.then(() => { spotifyMsg = ''; }, (e) => { spotifyMsg = e.message; }).finally(broadcast);
}

// ---------- windows ----------
// The timer window grows a little floor for Pomo when he lives inside it.
const TIMER_W = 340;
function timerHeight() {
  const want = settings.showPet && settings.petRoam === 'window' ? 665 + Math.round(85 * settings.petScale) : 665;
  return Math.min(want, screen.getPrimaryDisplay().workArea.height);
}

function createTimerWindow() {
  timerWin = new BrowserWindow({
    width: TIMER_W,
    height: timerHeight(),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    title: 'Pomo',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  timerWin.loadFile(path.join(__dirname, 'timer', 'index.html'));
  timerWin.on('closed', () => {
    timerWin = null;
    app.quit();
  });
}

function createPetWindow() {
  if (petWin && !petWin.isDestroyed()) return;
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  petWin = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  petWin.setAlwaysOnTop(true, 'screen-saver');
  // skipTransformProcessType keeps the Dock icon from disappearing on macOS
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  // Clicks pass straight through to whatever is underneath, except on Pomo.
  petWin.setIgnoreMouseEvents(true, { forward: true });
  petWin.loadFile(path.join(__dirname, 'pet', 'pet.html'));
  petWin.on('closed', () => { petWin = null; });
}

function syncPetWindow() {
  if (settings.showPet && settings.petRoam === 'screen') createPetWindow();
  else if (petWin && !petWin.isDestroyed()) petWin.close();

  if (restoreBounds) {
    restoreBounds.height = timerHeight(); // maximized: remember the right size for later
  } else if (timerWin && !timerWin.isDestroyed() && timerWin.getSize()[1] !== timerHeight()) {
    timerWin.setResizable(true);
    timerWin.setSize(TIMER_W, timerHeight());
    timerWin.setResizable(false);
  }
}

// ---------- ipc ----------
function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function registerIpc() {
  ipcMain.handle('state:get', () => publicState());

  ipcMain.on('timer:toggle', () => setRunning(!state.running));

  ipcMain.on('timer:reset', () => {
    state.running = false;
    setPhase(state.phase);
    syncMusic();
    broadcast();
  });

  ipcMain.on('timer:skip', () => finishPhase(true));

  ipcMain.on('timer:phase', (_e, phase) => {
    if (!DURATION_KEY[phase]) return;
    state.running = false;
    setPhase(phase);
    syncMusic();
    broadcast();
  });

  ipcMain.on('settings:update', (_e, patch = {}) => {
    const untouched = !state.running && state.remainingMs === state.totalMs;
    if ('focusMin' in patch) settings.focusMin = clampInt(patch.focusMin, 1, 180, settings.focusMin);
    if ('shortMin' in patch) settings.shortMin = clampInt(patch.shortMin, 1, 60, settings.shortMin);
    if ('longMin' in patch) settings.longMin = clampInt(patch.longMin, 1, 120, settings.longMin);
    if ('longEvery' in patch) settings.longEvery = clampInt(patch.longEvery, 2, 12, settings.longEvery);
    for (const k of ['autoStart', 'showPet', 'musicOnBreaks', 'alarmSound']) {
      if (k in patch) settings[k] = Boolean(patch[k]);
    }
    if (patch.petRoam === 'screen' || patch.petRoam === 'window') settings.petRoam = patch.petRoam;
    if ('petScale' in patch) settings.petScale = Math.min(2.5, Math.max(0.5, Number(patch.petScale) || 1));
    if (typeof patch.character === 'string' && /^[a-z0-9-]{1,30}$/.test(patch.character)) settings.character = patch.character;
    if ('spotifyPlaylist' in patch) {
      settings.spotifyPlaylist = String(patch.spotifyPlaylist || '').trim();
      spotify.resetContext();
    }
    if ('spotifyClientId' in patch) settings.spotifyClientId = String(patch.spotifyClientId || '').trim();
    saveSettings();
    if (untouched) setPhase(state.phase);
    syncPetWindow();
    lastWantMusic = null;
    syncMusic();
    broadcast();
  });

  // to-do list
  const tasksChanged = () => { saveSettings(); broadcast(); };
  ipcMain.on('tasks:add', (_e, text) => {
    const clean = String(text || '').trim().slice(0, 140);
    if (!clean || settings.tasks.length >= 100) return;
    settings.tasks.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: clean, done: false });
    tasksChanged();
  });
  ipcMain.on('tasks:toggle', (_e, id) => {
    const task = settings.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done) petEvent({ type: 'task-done', allDone: settings.tasks.every((t) => t.done) });
    tasksChanged();
  });
  ipcMain.on('tasks:remove', (_e, id) => {
    settings.tasks = settings.tasks.filter((t) => t.id !== id);
    tasksChanged();
  });
  ipcMain.on('tasks:clearDone', () => {
    settings.tasks = settings.tasks.filter((t) => !t.done);
    tasksChanged();
  });

  ipcMain.on('spotify:connect', async () => {
    if (!settings.spotifyClientId) {
      spotifyMsg = 'Paste your Spotify Client ID first';
      return broadcast();
    }
    spotifyMsg = 'Waiting for you to log in in the browser...';
    broadcast();
    try {
      spotify.init({ clientId: settings.spotifyClientId, refreshToken: '', onRefreshToken: writeRefreshToken });
      await spotify.connect(settings.spotifyClientId, (url) => shell.openExternal(url));
      spotifyMsg = '';
      lastWantMusic = null;
      syncMusic();
    } catch (e) {
      spotifyMsg = e.code === 'EADDRINUSE' ? 'Port 8888 is busy, close whatever is using it and try again' : e.message;
    }
    broadcast();
  });

  ipcMain.on('spotify:disconnect', () => {
    spotify.disconnect();
    writeRefreshToken('');
    spotifyMsg = '';
    broadcast();
  });

  ipcMain.on('pet:hover', (_e, over) => {
    if (petWin && !petWin.isDestroyed()) petWin.setIgnoreMouseEvents(!over, { forward: true });
  });

  ipcMain.on('win:minimize', () => timerWin && timerWin.minimize());
  // Fill the screen and go back. Done by hand because see-through windows
  // can't use the normal maximize on Windows.
  ipcMain.on('win:maximize', () => {
    if (!timerWin || timerWin.isDestroyed()) return;
    let target;
    if (restoreBounds) {
      target = restoreBounds;
      restoreBounds = null;
    } else {
      restoreBounds = timerWin.getBounds();
      target = screen.getDisplayMatching(restoreBounds).workArea;
    }
    timerWin.setResizable(true);
    timerWin.setBounds(target);
    timerWin.setResizable(false);
    broadcast();
  });
  ipcMain.on('update:apply', () => {
    if (!update) return;
    if (update.status === 'ready' && autoUpdater) autoUpdater.quitAndInstall(true, true);
    else if (update.url) shell.openExternal(update.url);
  });
  ipcMain.on('win:close', () => timerWin && timerWin.close());
}

// ---------- updates ----------
// Windows: new versions download quietly in the background and are installed
// the next time the app closes (or right away from the "Restart" pill).
// Mac: the app isn't signed, so it can only point you at the download page.
const RELEASES_API = 'https://api.github.com/repos/amlkong/pomodoro/releases/latest';
const newer = (a, b) => a.localeCompare(b, undefined, { numeric: true }) > 0;

function setupUpdates() {
  if (!app.isPackaged) return;
  if (process.platform === 'win32') {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) => {
      update = { status: 'downloading', version: info.version };
      broadcast();
    });
    autoUpdater.on('update-downloaded', (info) => {
      update = { status: 'ready', version: info.version };
      broadcast();
      // Just opened and nothing in progress? Switch to the new version right
      // away, so opening Pomo always lands on the latest one.
      const justOpened = Date.now() - startedAt < 3 * 60 * 1000;
      const untouched = !state.running && state.completed === 0 && state.remainingMs === state.totalMs;
      if (justOpened && untouched) setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500);
    });
    autoUpdater.on('error', (e) => {
      console.error('Update check failed:', e.message);
      if (update && update.status === 'downloading') { update = null; broadcast(); }
    });
    const check = () => autoUpdater.checkForUpdates().catch(() => {});
    check();
    setInterval(check, 60 * 60 * 1000);
    return;
  }
  const check = async () => {
    try {
      const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      const rel = await res.json();
      const version = String(rel.tag_name || '').replace(/^v/, '');
      if (version && newer(version, app.getVersion())) {
        update = { status: 'available', version, url: rel.html_url };
        broadcast();
      }
    } catch { /* offline, try again later */ }
  };
  check();
  setInterval(check, 60 * 60 * 1000);
}

// ---------- boot ----------
app.whenReady().then(() => {
  // Windows needs this for notifications to show the app's name and icon
  if (process.platform === 'win32') app.setAppUserModelId('com.pomo.timer');
  loadSettings();
  spotify.init({
    clientId: settings.spotifyClientId,
    refreshToken: readRefreshToken(),
    onRefreshToken: writeRefreshToken,
  });
  setPhase('focus');
  registerIpc();
  createTimerWindow();
  syncPetWindow();
  setInterval(tick, 250);
  setupUpdates();

  // keep Pomo's room matched to the screen if the resolution, taskbar or Dock changes
  screen.on('display-metrics-changed', () => {
    if (petWin && !petWin.isDestroyed()) petWin.setBounds(screen.getPrimaryDisplay().workArea);
  });
});

app.on('window-all-closed', () => app.quit());
