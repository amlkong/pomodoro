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
  musicOnBreaks: false,
  spotifyClientId: '',
  spotifyPlaylist: '',
  spotifyRefresh: '',
};
const DURATION_KEY = { focus: 'focusMin', short: 'shortMin', long: 'longMin' };

let settings = { ...DEFAULTS };
let timerWin = null;
let petWin = null;
let brainWin = null;
let quitting = false;

const state = { phase: 'focus', running: false, remainingMs: 0, totalMs: 0, completed: 0 };
let endAt = 0;
let spotifyMsg = '';
let lastWantMusic = null;

// ---------- settings ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    settings = { ...DEFAULTS };
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
    brainOpen: Boolean(brainWin),
  };
}

function broadcast() {
  const s = publicState();
  for (const w of [timerWin, petWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('state', s);
  }
}

function petEvent(payload) {
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:event', payload);
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

  if (brainWin && !brainWin.isDestroyed()) brainWin.webContents.setAudioMuted(!want);

  if (want === lastWantMusic) return;
  lastWantMusic = want;
  if (!spotify.isConnected()) return;
  const job = want ? spotify.play(settings.spotifyPlaylist) : spotify.pause();
  job.then(() => { spotifyMsg = ''; }, (e) => { spotifyMsg = e.message; }).finally(broadcast);
}

function openBrainFm() {
  if (brainWin && !brainWin.isDestroyed()) {
    brainWin.show();
    brainWin.focus();
    return;
  }
  brainWin = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'brain.fm',
    autoHideMenuBar: true,
    webPreferences: { partition: 'persist:brainfm' },
  });
  brainWin.loadURL('https://www.brain.fm/');
  // Closing only hides it, so the music keeps going in the background.
  brainWin.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      brainWin.hide();
    }
  });
  brainWin.on('closed', () => { brainWin = null; });
  const want = state.running && (state.phase === 'focus' || settings.musicOnBreaks);
  brainWin.webContents.setAudioMuted(!want && state.running);
  broadcast();
}

// ---------- windows ----------
function createTimerWindow() {
  timerWin = new BrowserWindow({
    width: 340,
    height: 560,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    title: 'Pomo',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
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
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Clicks pass straight through to whatever is underneath, except on Pomo.
  petWin.setIgnoreMouseEvents(true, { forward: true });
  petWin.loadFile(path.join(__dirname, 'pet', 'pet.html'));
  petWin.on('closed', () => { petWin = null; });
}

function syncPetWindow() {
  if (settings.showPet) createPetWindow();
  else if (petWin && !petWin.isDestroyed()) petWin.close();
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
    for (const k of ['autoStart', 'showPet', 'musicOnBreaks']) {
      if (k in patch) settings[k] = Boolean(patch[k]);
    }
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

  ipcMain.on('brainfm:open', openBrainFm);

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
  ipcMain.on('win:close', () => timerWin && timerWin.close());
}

// ---------- boot ----------
app.whenReady().then(() => {
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
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
