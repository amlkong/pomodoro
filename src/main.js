const { app, BrowserWindow, ipcMain, Notification, screen, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const spotify = require('./spotify');
const taskSources = require('./task-sources');
const calendarSource = require('./calendar-source');
const googleCal = require('./google-calendar');

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
  todoistSync: false, // opt-in: Pomo may change Todoist (complete, add and delete tasks)
  taskApp: '',      // 'todoist' or 'notion': which one the Tasks tab shows
  calendarLink: '', // a private link, so kept encrypted like the tokens
  googleClientId: '',
  googleClientSecret: '', // kept encrypted, never sent to the window
  googleRefresh: '',      // the saved Google sign-in; kept encrypted, never sent to the window
  calendarLogFocus: false, // opt-in: add each finished focus round to Google Calendar
  winW: 0, // window size chosen by dragging its corner; 0 = the automatic size
  winH: 0,
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
let googleMsg = ''; // progress or problem with Google sign-in and calendar changes
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

// (Re)starts the Google Calendar connection from what is saved in settings.
function initGoogle() {
  googleCal.init({
    clientId: settings.googleClientId,
    clientSecret: readSecret('googleClientSecret'),
    refreshToken: readSecret('googleRefresh'),
    onRefreshToken: (token) => {
      writeSecret('googleRefresh', token);
      saveSettings();
      broadcast();
    },
  });
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
  const { spotifyRefresh, todoistToken, notionToken, calendarLink, googleClientSecret, googleRefresh, ...safeSettings } = settings;
  return {
    ...state,
    settings: safeSettings,
    spotify: { connected: spotify.isConnected(), message: spotifyMsg },
    syncMsg,
    google: { connected: googleCal.isConnected(), hasSecret: Boolean(googleClientSecret), message: googleMsg },
    sources: { todoist: Boolean(todoistToken), notion: Boolean(notionToken && settings.notionLink), calendar: Boolean(calendarLink) || googleCal.isConnected(), calendarLink: Boolean(calendarLink) },
    // what Pomo is allowed to change in the other apps right now
    can: { todoistWrite: Boolean(settings.todoistSync && todoistToken), calendarWrite: googleCal.isConnected() },
    customSize: Boolean(settings.winW && settings.winH),
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

// Writes a finished focus round into Google Calendar, if that option is on.
function logFocusRound(lengthMs) {
  if (!settings.calendarLogFocus || !googleCal.isConnected()) return;
  const end = new Date();
  googleCal.createEvent({ summary: 'Focus session 🍅', start: new Date(end.getTime() - lengthMs), end }).then(
    () => { googleMsg = ''; },
    (e) => { googleMsg = `Couldn't log your focus round: ${e.message}`; },
  ).finally(broadcast);
}

function finishPhase(skipped) {
  const was = state.phase;
  const lengthMs = state.totalMs;
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
    if (was === 'focus') logFocusRound(lengthMs);
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
// If the corner has been dragged, that size is used as it is.
const TIMER_W = 340;
const MIN_W = 320;
const MIN_H = 520;
function timerSize() {
  const area = (timerWin && !timerWin.isDestroyed() ? screen.getDisplayMatching(timerWin.getBounds()) : screen.getPrimaryDisplay()).workArea;
  if (settings.winW && settings.winH) {
    return {
      w: Math.max(MIN_W, Math.min(settings.winW, area.width)),
      h: Math.max(MIN_H, Math.min(settings.winH, area.height)),
    };
  }
  const want = settings.showPet && settings.petRoam === 'window' ? 760 + Math.round(85 * settings.petScale) : 760;
  return { w: TIMER_W, h: Math.min(want, area.height) };
}

function setTimerBounds(bounds) {
  timerWin.setResizable(true);
  timerWin.setBounds(bounds);
  timerWin.setResizable(false);
}

function createTimerWindow() {
  timerWin = new BrowserWindow({
    width: timerSize().w,
    height: timerSize().h,
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

  if (!timerWin || timerWin.isDestroyed()) return;
  const { w, h } = timerSize();
  if (restoreBounds) {
    // maximized: remember the right size for later
    restoreBounds.width = w;
    restoreBounds.height = h;
  } else {
    const [curW, curH] = timerWin.getSize();
    if (curW !== w || curH !== h) {
      const [x, y] = timerWin.getPosition();
      setTimerBounds({ x, y, width: w, height: h });
    }
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
    for (const k of ['autoStart', 'showPet', 'musicOnBreaks', 'alarmSound', 'todoistSync', 'calendarLogFocus']) {
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
    if ('googleClientId' in patch || 'googleClientSecret' in patch) {
      // a different Google project means the old sign-in no longer applies
      const before = `${settings.googleClientId}|${readSecret('googleClientSecret')}`;
      if ('googleClientId' in patch) settings.googleClientId = String(patch.googleClientId || '').trim().slice(0, 200);
      if ('googleClientSecret' in patch) writeSecret('googleClientSecret', String(patch.googleClientSecret || '').slice(0, 200));
      if (before !== `${settings.googleClientId}|${readSecret('googleClientSecret')}`) writeSecret('googleRefresh', '');
      initGoogle();
      googleMsg = '';
    }
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
    if (!settings.todoistSync) return { error: 'Turn on "Let Pomo change Todoist" in ⚙ first' };
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
      if (which === 'calendar') {
        // signed in with Google: the live calendar. Otherwise the read-only private link.
        if (googleCal.isConnected()) return { items: await googleCal.listEvents() };
        return { items: await calendarSource.fetchCalendar(readSecret('calendarLink')) };
      }
      return { error: 'Unknown list' };
    } catch (e) {
      return { error: e.message };
    }
  });

  // Adding something new to Todoist or Google Calendar from Pomo.
  ipcMain.handle('sources:add', async (_e, which, text) => {
    try {
      if (which === 'todoist') {
        if (!settings.todoistSync) return { error: 'Turn on "Let Pomo change Todoist" in ⚙ first' };
        return { item: await taskSources.addTodoist(readSecret('todoistToken'), text) };
      }
      if (which === 'calendar') {
        if (!googleCal.isConnected()) return { error: 'Sign in with Google in ⚙ to add events' };
        return { item: await googleCal.quickAdd(text) };
      }
      return { error: 'Nothing can be added to that list from here' };
    } catch (e) {
      return { error: e.message };
    }
  });

  // Deleting for good. The window always asks "are you sure?" before calling this.
  ipcMain.handle('sources:delete', async (_e, which, sourceId) => {
    try {
      if (which === 'todoist') {
        if (!settings.todoistSync) return { error: 'Turn on "Let Pomo change Todoist" in ⚙ first' };
        await taskSources.deleteTodoist(readSecret('todoistToken'), String(sourceId));
        // a session task that pointed at it stays, but no longer talks to Todoist
        let touched = false;
        for (const t of settings.tasks) {
          if (t.source === 'todoist' && t.sourceId === String(sourceId)) { delete t.source; delete t.sourceId; touched = true; }
        }
        if (touched) tasksChanged();
        return { ok: true };
      }
      if (which === 'calendar') {
        if (!googleCal.isConnected()) return { error: 'Sign in with Google in ⚙ to delete events' };
        await googleCal.deleteEvent(String(sourceId));
        return { ok: true };
      }
      return { error: 'Nothing can be deleted from that list here' };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.on('google:connect', async () => {
    if (!settings.googleClientId || !readSecret('googleClientSecret')) {
      googleMsg = 'Paste your Google Client ID and Client secret first';
      return broadcast();
    }
    googleMsg = 'Waiting for you to sign in in the browser…';
    broadcast();
    try {
      initGoogle();
      await googleCal.connect((url) => shell.openExternal(url));
      googleMsg = '';
    } catch (e) {
      googleMsg = e.message;
    }
    broadcast();
  });

  ipcMain.on('google:disconnect', () => {
    googleCal.disconnect();
    writeSecret('googleRefresh', '');
    saveSettings();
    googleMsg = '';
    broadcast();
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
    setTimerBounds(target);
    broadcast();
  });

  // Dragging the corner of the window. The top-left corner stays where it is.
  // Done by hand because see-through windows can't be resized the normal way.
  ipcMain.on('win:resize', (_e, size) => {
    if (!timerWin || timerWin.isDestroyed() || restoreBounds || !size) return;
    const b = timerWin.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    const width = Math.round(Math.max(MIN_W, Math.min(Number(size.w) || b.width, area.x + area.width - b.x)));
    const height = Math.round(Math.max(MIN_H, Math.min(Number(size.h) || b.height, area.y + area.height - b.y)));
    if (width !== b.width || height !== b.height) setTimerBounds({ x: b.x, y: b.y, width, height });
  });
  // the drag ended: remember the size for next time
  ipcMain.on('win:resizeEnd', () => {
    if (!timerWin || timerWin.isDestroyed() || restoreBounds) return;
    [settings.winW, settings.winH] = timerWin.getSize();
    saveSettings();
    broadcast();
  });
  // double-clicking the corner goes back to the automatic size
  ipcMain.on('win:resetSize', () => {
    settings.winW = 0;
    settings.winH = 0;
    saveSettings();
    syncPetWindow();
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
  initGoogle();
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
