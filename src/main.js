const { app, BrowserWindow, ipcMain, Notification, screen, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const spotify = require('./spotify');
const taskSources = require('./task-sources');
const calendarSource = require('./calendar-source');

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
  todoistToken: '', // kept encrypted, never sent to the window
  notionToken: '',  // kept encrypted, never sent to the window
  notionLink: '',
  todoistSync: false, // opt-in: ticking a Todoist task in Pomo also completes it in Todoist
  taskApp: '',      // 'todoist' or 'notion': which one the Tasks tab shows
  calendarLink: '', // a private link, so kept encrypted like the tokens
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
let updateStatus = '';
const startedAt = Date.now();
let endAt = 0;
let spotifyMsg = '';
let syncMsg = ''; // last problem telling Todoist about a ticked task, if any
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

// Secrets (API tokens) are stored encrypted with the OS keychain when possible.
function readSecret(key) {
  const raw = settings[key];
  if (!raw) return '';
  if (raw.startsWith('enc:')) {
    try { return safeStorage.decryptString(Buffer.from(raw.slice(4), 'base64')); } catch { return ''; }
  }
  return raw;
}

function writeSecret(key, value) {
  const clean = String(value || '').trim();
  settings[key] = clean && safeStorage.isEncryptionAvailable()
    ? 'enc:' + safeStorage.encryptString(clean).toString('base64')
    : clean;
}

function publicState() {
  const { spotifyRefresh, todoistToken, notionToken, calendarLink, ...safeSettings } = settings;
  return {
    ...state,
    settings: safeSettings,
    spotify: { connected: spotify.isConnected(), message: spotifyMsg },
    syncMsg,
    sources: { todoist: Boolean(todoistToken), notion: Boolean(notionToken && settings.notionLink), calendar: Boolean(calendarLink) },
    maximized: Boolean(restoreBounds),
    update,
    updateStatus,
    appVersion: app.getVersion(),
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
  const job = want ? startSpotify() : spotify.pause();
  job.then(() => { spotifyMsg = ''; }, (e) => { spotifyMsg = e.message; }).finally(broadcast);
}

// Plays on Spotify, opening the desktop app first if it isn't running.
function startSpotify() {
  return spotify.play(settings.spotifyPlaylist, {
    openApp: () => shell.openExternal('spotify:').catch(() => {}),
    onStatus: (text) => { spotifyMsg = text; broadcast(); },
  });
}

// ---------- windows ----------
// The timer window grows a little floor for Pomo when he lives inside it.
const TIMER_W = 340;
function timerHeight() {
  const want = settings.showPet && settings.petRoam === 'window' ? 760 + Math.round(85 * settings.petScale) : 760;
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
    for (const k of ['autoStart', 'showPet', 'musicOnBreaks', 'alarmSound', 'todoistSync']) {
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
    if ('todoistToken' in patch) writeSecret('todoistToken', patch.todoistToken);
    if ('notionToken' in patch) writeSecret('notionToken', patch.notionToken);
    if (patch.taskApp === 'todoist' || patch.taskApp === 'notion') settings.taskApp = patch.taskApp;
    if ('notionLink' in patch) settings.notionLink = String(patch.notionLink || '').trim().slice(0, 400);
    if ('calendarLink' in patch) writeSecret('calendarLink', String(patch.calendarLink || '').slice(0, 600));
    saveSettings();
    if (untouched) setPhase(state.phase);
    syncPetWindow();
    lastWantMusic = null;
    syncMusic();
    broadcast();
  });

  // to-do list
  const tasksChanged = () => { saveSettings(); broadcast(); };
  // A task is plain text, or { text, source, sourceId } when it was picked from
  // Todoist, so Pomo knows which Todoist task it stands for.
  ipcMain.on('tasks:add', (_e, input) => {
    const fromApp = input && typeof input === 'object';
    const clean = String((fromApp ? input.text : input) || '').trim().slice(0, 140);
    if (!clean || settings.tasks.length >= 100) return;
    const task = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: clean, done: false };
    if (fromApp && input.source === 'todoist' && input.sourceId) {
      task.source = 'todoist';
      task.sourceId = String(input.sourceId).slice(0, 64);
    }
    settings.tasks.push(task);
    tasksChanged();
  });

  // Tells Todoist about a tick or an un-tick, when that option is switched on.
  const syncTodoist = (sourceId, done) => {
    if (!settings.todoistSync || !sourceId) return Promise.resolve(false);
    return taskSources.setTodoistDone(readSecret('todoistToken'), sourceId, done).then(
      () => { syncMsg = ''; broadcast(); return true; },
      (e) => { syncMsg = e.message; broadcast(); return false; },
    );
  };

  ipcMain.on('tasks:toggle', (_e, id) => {
    const task = settings.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done) petEvent({ type: 'task-done', allDone: settings.tasks.every((t) => t.done) });
    tasksChanged();
    if (task.source === 'todoist') syncTodoist(task.sourceId, task.done);
  });

  // Completing straight from the Todoist list, without adding it to the session first.
  // Opens the real app in the browser. The address is chosen here, never by the window.
  ipcMain.on('sources:open', (_e, which) => {
    let url = '';
    if (which === 'todoist') url = 'https://app.todoist.com/app/today';
    else if (which === 'calendar') url = 'https://calendar.google.com/';
    else if (which === 'notion') {
      url = 'https://www.notion.so/';
      try {
        const link = new URL(settings.notionLink);
        if (link.protocol === 'https:' && /(^|\.)notion\.(so|site)$/.test(link.hostname)) url = link.toString();
      } catch { /* no link saved: open Notion's home page */ }
    }
    if (url) shell.openExternal(url);
  });

  ipcMain.handle('sources:complete', async (_e, which, sourceId) => {
    if (which !== 'todoist') return { error: 'Only Todoist tasks can be completed from here' };
    if (!settings.todoistSync) return { error: 'Turn on "also complete it in Todoist" in ⚙ first' };
    const ok = await syncTodoist(String(sourceId), true);
    if (!ok) return { error: syncMsg };
    // if the same task is in this session's list, tick it there too
    let ticked = false;
    for (const t of settings.tasks) {
      if (t.source === 'todoist' && t.sourceId === String(sourceId) && !t.done) { t.done = true; ticked = true; }
    }
    if (ticked) tasksChanged();
    petEvent({ type: 'task-done', allDone: settings.tasks.length > 0 && settings.tasks.every((t) => t.done) });
    return { ok: true };
  });
  ipcMain.on('tasks:remove', (_e, id) => {
    settings.tasks = settings.tasks.filter((t) => t.id !== id);
    tasksChanged();
  });
  // task lists from other apps, shown as extra tabs next to the to-do list
  ipcMain.handle('sources:fetch', async (_e, which) => {
    try {
      if (which === 'todoist') return { items: await taskSources.fetchTodoist(readSecret('todoistToken')) };
      if (which === 'notion') return { items: await taskSources.fetchNotion(readSecret('notionToken'), settings.notionLink) };
      if (which === 'calendar') return { items: await calendarSource.fetchCalendar(readSecret('calendarLink')) };
      return { error: 'Unknown list' };
    } catch (e) {
      return { error: e.message };
    }
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

  // the Spotify button on the main screen: open Spotify and start the music now
  ipcMain.on('spotify:playNow', () => {
    if (!spotify.isConnected()) return;
    lastWantMusic = true;
    startSpotify().then(() => { spotifyMsg = ''; }, (e) => { spotifyMsg = e.message; }).finally(broadcast);
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
  ipcMain.on('update:check', () => checkForUpdates());
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

// One line the settings screen shows, so update problems are never silent.
function setUpdateStatus(text) {
  updateStatus = text;
  broadcast();
}

let checkForUpdates = () => setUpdateStatus('Updates only work in the installed app.');

function setupUpdates() {
  if (!app.isPackaged) return;
  if (process.platform === 'win32') {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => setUpdateStatus('Checking for a newer version…'));
    autoUpdater.on('update-not-available', () => setUpdateStatus('You have the latest version.'));
    autoUpdater.on('update-available', (info) => {
      update = { status: 'downloading', version: info.version };
      setUpdateStatus(`Downloading version ${info.version}…`);
    });
    autoUpdater.on('download-progress', (p) => {
      if (update) setUpdateStatus(`Downloading version ${update.version}… ${Math.round(p.percent)}%`);
    });
    autoUpdater.on('update-downloaded', (info) => {
      update = { status: 'ready', version: info.version };
      setUpdateStatus(`Version ${info.version} is ready. It installs when Pomo restarts.`);
      // Just opened and nothing in progress? Switch to the new version right
      // away, so opening Pomo always lands on the latest one.
      const justOpened = Date.now() - startedAt < 3 * 60 * 1000;
      const untouched = !state.running && state.completed === 0 && state.remainingMs === state.totalMs;
      if (justOpened && untouched) setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500);
    });
    autoUpdater.on('error', (e) => {
      console.error('Update check failed:', e.message);
      if (update && update.status === 'downloading') update = null;
      setUpdateStatus(`Couldn't update: ${String(e.message || e).split('\n')[0].slice(0, 140)}`);
    });
    checkForUpdates = () => autoUpdater.checkForUpdates().catch(() => {});
  } else {
    // Mac: the app isn't signed, so it can only point at the download page.
    checkForUpdates = async () => {
      setUpdateStatus('Checking for a newer version…');
      try {
        const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
        const rel = await res.json();
        const version = String(rel.tag_name || '').replace(/^v/, '');
        if (version && newer(version, app.getVersion())) {
          update = { status: 'available', version, url: rel.html_url };
          setUpdateStatus(`Version ${version} is out. Click the pill on the main screen to download it.`);
        } else {
          setUpdateStatus('You have the latest version.');
        }
      } catch (e) {
        setUpdateStatus(`Couldn't check: ${e.message}`);
      }
    };
  }
  checkForUpdates();
  setInterval(() => checkForUpdates(), 60 * 60 * 1000);
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
