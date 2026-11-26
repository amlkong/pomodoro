const $ = (id) => document.getElementById(id);
const CIRC = 565.49;
const LABELS = {
  focus: ['ready when you are', 'stay with it', 'paused, no rush'],
  short: ['a little break', 'breathe and stretch', 'paused, no rush'],
  long: ['a long break', 'you earned this', 'paused, no rush'],
};
const SETTING_IDS = ['focusMin', 'shortMin', 'longMin', 'longEvery', 'autoStart', 'alarmSound', 'petScale', 'musicOnBreaks', 'todoistSync', 'calendarLogFocus', 'googleClientId', 'spotifyClientId', 'spotifyPlaylist'];

const mini = $('mini');
let miniChar = '';
let current = null;
let settingsFilled = false;
let tasksKey = '';
let syncShown = null;
let canShown = '';

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
    mini.innerHTML = char.svg;
  }
  $('roam').textContent = `${char.emoji} ${{ screen: 'on screen', window: 'in window', hidden: 'hidden' }[where]}`;
  $('swap').title = `Choose character (now: ${char.name})`;
  document.body.classList.toggle('max', s.maximized);
  $('max').textContent = s.maximized ? '❐' : '□';
  $('max').title = s.maximized ? 'Restore' : 'Maximize';
  $('ver').textContent = ` ${s.appVersion}`;
  $('verLong').textContent = `Pomo version ${s.appVersion}`;
  $('updateStatus').textContent = s.updateStatus || '';
  $('update').hidden = !s.update;
  if (s.update) {
    $('update').textContent = {
      downloading: `✨ Getting version ${s.update.version}…`,
      ready: `✨ Version ${s.update.version} is ready · restart`,
      available: `✨ Version ${s.update.version} is out · download`,
    }[s.update.status];
    $('update').disabled = s.update.status === 'downloading';
  }

  mini.className = 'mini ' + (!s.running ? '' : s.phase === 'focus' ? 'sitting' : 'dancing');

  // one dot per focus round until the next long break
  const every = s.settings.longEvery;
  const done = s.completed % every;
  const filled = s.completed > 0 && done === 0 && s.phase === 'long' ? every : done;
  const dots = $('dots');
  if (dots.children.length !== every) dots.innerHTML = '<i></i>'.repeat(every);
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < filled));
  dots.title = `${s.completed} focus round${s.completed === 1 ? '' : 's'} today`;

  $('spot').classList.toggle('on', s.spotify.connected);
  $('spot').title = s.spotify.connected ? 'Open Spotify and start the music now' : 'Set up Spotify';
  $('spotConnect').textContent = s.spotify.connected ? 'Disconnect Spotify' : 'Connect Spotify';
  $('msg').textContent = s.spotify.message || '';

  // which extra tabs exist depends on what is connected in settings
  // the saved choice wins; before one is made, use whichever app is connected
  taskApp = s.settings.taskApp || (s.sources.notion && !s.sources.todoist ? 'notion' : 'todoist');
  for (const id of ['taskApp', 'taskAppSetting']) if (document.activeElement !== $(id)) $(id).value = taskApp;
  $('todoistFields').hidden = taskApp !== 'todoist';
  $('notionFields').hidden = taskApp !== 'notion';
  $('calendarOff').hidden = !s.sources.calendarLink;
  $('calendarLink').placeholder = s.sources.calendarLink ? 'saved ✓  (paste a new one to replace)' : 'Secret address in iCal format (ends in basic.ics)';
  $('todoistOff').hidden = !s.sources.todoist;
  $('notionOff').hidden = !s.settings.notionLink && !s.sources.notion;
  $('todoistToken').placeholder = s.sources.todoist ? 'saved ✓  (paste a new one to replace)' : 'Todoist → Settings → Integrations → Developer';
  $('notionToken').placeholder = s.sources.notion ? 'saved ✓  (paste a new one to replace)' : 'from notion.so/profile/integrations';
  if (document.activeElement !== $('notionLink')) $('notionLink').value = s.settings.notionLink || '';
  $('syncMsg').textContent = s.syncMsg || '';
  // Google sign-in
  $('googleConnect').textContent = s.google.connected ? 'Sign out of Google' : 'Sign in with Google';
  $('googleMsg').textContent = s.google.message || (s.google.connected ? 'Signed in. You can add and delete events from the Calendar tab.' : '');
  $('googleClientSecret').placeholder = s.google.hasSecret ? 'saved ✓  (paste a new one to replace)' : 'from the same Google Cloud page';
  $('calendarLogFocus').disabled = !s.google.connected;
  $('winGrip').hidden = s.maximized;
  // what Pomo may change decides which buttons the lists show
  const canKey = JSON.stringify(s.can);
  if (canKey !== canShown) { canShown = canKey; if (tab !== 'session') setTimeout(renderExternal, 0); }
  // the Todoist list shows extra buttons when syncing is switched on or off
  if (syncShown !== s.settings.todoistSync) { syncShown = s.settings.todoistSync; tasksKey = ''; }
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
  $('tabSession').textContent = !tasks.length ? 'To do' : left ? `To do · ${left}` : 'To do · done!';
  anyDone = tasks.some((t) => t.done);
  sessionTexts = new Set(tasks.map((t) => t.text));
  showTab(tab);
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
    if (t.source === 'todoist') {
      // came from Todoist: with syncing on, ticking it here completes it there too
      const tag = document.createElement('i');
      tag.className = 'from';
      tag.textContent = 'Todoist';
      tag.title = current && current.settings.todoistSync ? 'Ticking this also completes it in Todoist' : 'Picked from Todoist';
      label.append(tag);
    }
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Remove';
    del.setAttribute('aria-label', `Remove ${t.text}`);
    del.onclick = () => window.api.removeTask(t.id);
    li.append(label, del);
    ul.append(li);
  }
}

// ---------- tabs: this session's to-do list, a Tasks tab (Todoist or Notion), and Calendar ----------
let tab = 'session';   // 'session', 'tasks' or 'calendar'
let taskApp = 'todoist'; // which app the Tasks tab reads from; saved per person
// the list a tab shows: the Tasks tab follows the chosen app
const sourceOf = (t) => (t === 'tasks' ? taskApp : t);
let anyDone = false;
let sessionTexts = new Set();
const ext = { todoist: { filter: '' }, notion: { filter: 'all' }, calendar: { filter: 'today' } }; // items, error, loading, at
const EXT = {
  todoist: { name: 'Todoist', open: 'Todoist', addHint: 'Add a task to Todoist and press Enter', deleteWord: 'Delete from Todoist for good?', filters: true, all: 'all', none: 'No open tasks in Todoist.', noneToday: 'Nothing due today. Click "today" to see everything.' },
  notion: { name: 'Notion', open: 'your Notion page', filters: false, all: 'all', none: 'No open tasks in Notion.', noneToday: '' },
  calendar: { name: 'your calendar', open: 'Google Calendar', addHint: 'Add an event, e.g. Dentist tomorrow 3pm', deleteWord: 'Delete this event from your calendar?', filters: true, all: 'week', none: 'Nothing on your calendar this week.', noneToday: 'Nothing on your calendar today. Click "today" to see the week.' },
};

function showTab(next) {
  tab = next;
  const isSession = tab === 'session';
  $('tabSession').classList.toggle('on', isSession);
  $('tabTasks').classList.toggle('on', tab === 'tasks');
  $('tabCalendar').classList.toggle('on', tab === 'calendar');
  $('sessionPane').hidden = !isSession;
  $('extPane').hidden = isSession;
  $('clearDone').hidden = !isSession || !anyDone;
  $('taskApp').hidden = tab !== 'tasks';
  if (!isSession) renderExternal();
}

async function loadExternal(which, force) {
  const src = ext[which];
  if (src.loading) return;
  if (!force && src.items && Date.now() - src.at < 2 * 60 * 1000) return;
  src.loading = true;
  src.error = '';
  renderExternal();
  const res = await window.api.fetchSource(which);
  src.loading = false;
  src.at = Date.now();
  if (res.error) src.error = res.error;
  else {
    src.items = res.items;
    // Todoist opens on "today" when something is due, otherwise on everything
    if (which === 'todoist' && !src.filter) src.filter = res.items.some((t) => t.today) ? 'today' : 'all';
  }
  renderExternal();
}

function renderExternal() {
  if (tab === 'session') return;
  const src = ext[sourceOf(tab)];
  const info = EXT[sourceOf(tab)];
  const name = info.name;
  const items = (src.items || []).filter((t) => src.filter !== 'today' || t.today);
  $('extOpen').title = `Open ${info.open}`;
  $('extFilter').hidden = !info.filters;
  $('extFilter').textContent = src.filter === 'today' ? 'today' : info.all;
  $('extStatus').textContent = src.loading ? `Loading from ${name}…`
    : src.error ? src.error
    : !src.items ? ''
    : !items.length ? (src.filter === 'today' ? info.noneToday : info.none)
    : 'Click + to add one to your session.';
  // what Pomo may change in this list right now
  const key = sourceOf(tab);
  const can = (current && current.can) || {};
  const canWrite = (key === 'todoist' && can.todoistWrite) || (key === 'calendar' && can.calendarWrite);
  const canComplete = key === 'todoist' && can.todoistWrite;
  $('extAdd').hidden = !canWrite;
  $('extAdd').placeholder = info.addHint || '';

  const ul = $('extTasks');
  ul.textContent = '';
  for (const t of items) {
    const li = document.createElement('li');

    // asked to delete: the row turns into a yes / no question first
    if (src.confirm === t.id) {
      li.className = 'asking';
      const q = document.createElement('span');
      q.className = 'text';
      q.textContent = info.deleteWord;
      const yes = document.createElement('button');
      yes.className = 'yes';
      yes.textContent = 'Delete';
      yes.onclick = async () => {
        yes.disabled = true;
        const res = await window.api.deleteFromSource(key, t.id);
        src.confirm = null;
        if (res.error) src.error = res.error;
        else { src.error = ''; src.items = (src.items || []).filter((x) => x.id !== t.id); }
        renderExternal();
      };
      const no = document.createElement('button');
      no.className = 'no';
      no.textContent = 'Keep';
      no.onclick = () => { src.confirm = null; renderExternal(); };
      li.append(q, yes, no);
      ul.append(li);
      continue;
    }

    const added = sessionTexts.has(t.text);
    const add = document.createElement('button');
    add.className = 'add';
    add.textContent = added ? '✓' : '+';
    add.disabled = added;
    add.title = added ? 'Already in your to-do list' : 'Add to this session';
    add.setAttribute('aria-label', `${added ? 'Already added' : 'Add to this session'}: ${t.text}`);
    add.onclick = () => window.api.addTask(key === 'todoist' ? { text: t.text, source: 'todoist', sourceId: t.id } : t.text);
    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = t.text;
    li.append(add, text);
    if (t.label) {
      const tag = document.createElement('span');
      tag.className = `tag ${t.label === 'overdue' ? 'late' : ''}`;
      tag.textContent = t.label;
      li.append(tag);
    }
    if (canComplete) {
      // complete it in Todoist right here, without adding it to the session
      const done = document.createElement('button');
      done.className = 'complete';
      done.textContent = '✓';
      done.title = 'Complete in Todoist';
      done.setAttribute('aria-label', `Complete in Todoist: ${t.text}`);
      done.onclick = async () => {
        done.disabled = true;
        const res = await window.api.completeSource('todoist', t.id);
        if (res.error) { src.error = res.error; done.disabled = false; }
        else src.items = (src.items || []).filter((x) => x.id !== t.id);
        renderExternal();
      };
      li.append(done);
    }
    if (canWrite) {
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.title = key === 'todoist' ? 'Delete from Todoist' : 'Delete from your calendar';
      del.setAttribute('aria-label', `${del.title}: ${t.text}`);
      del.onclick = () => { src.confirm = t.id; renderExternal(); };
      li.append(del);
    }
    ul.append(li);
  }
}

// typing in the box above a list adds a new task to Todoist, or a new event to the calendar
$('extAdd').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || tab === 'session') return;
  const value = e.target.value.trim();
  if (!value) return;
  const key = sourceOf(tab);
  const src = ext[key];
  e.target.disabled = true;
  const res = await window.api.addToSource(key, value);
  e.target.disabled = false;
  if (res.error) src.error = res.error;
  else {
    src.error = '';
    e.target.value = '';
    // the new item's due date or time is decided by the other app, so re-read the list
    await loadExternal(key, true);
    if (key === 'todoist' && src.filter === 'today') { src.filter = 'all'; }
  }
  renderExternal();
  e.target.focus();
});

$('tabSession').onclick = () => showTab('session');
$('tabTasks').onclick = () => { showTab('tasks'); loadExternal(taskApp); };
// switching the app is remembered, so the dropdown only needs touching once
function chooseTaskApp(app) {
  if (app !== 'todoist' && app !== 'notion') return;
  taskApp = app;
  window.api.updateSettings({ taskApp: app });
  if (tab === 'tasks') { showTab('tasks'); loadExternal(taskApp); }
}
$('taskApp').onchange = (e) => chooseTaskApp(e.target.value);
$('taskAppSetting').onchange = (e) => chooseTaskApp(e.target.value);
$('tabCalendar').onclick = () => { showTab('calendar'); loadExternal('calendar'); };
$('extRefresh').onclick = () => loadExternal(sourceOf(tab), true);
$('extOpen').onclick = () => { if (tab !== 'session') window.api.openSource(sourceOf(tab)); };
$('extFilter').onclick = () => {
  if (tab === 'session') return;
  const src = ext[sourceOf(tab)];
  src.filter = src.filter === 'today' ? 'all' : 'today';
  renderExternal();
};

// settings for those lists: tokens are sent to the main process and never shown again
for (const id of ['todoistToken', 'notionToken']) {
  $(id).addEventListener('change', (e) => {
    const value = e.target.value.trim();
    if (!value) return;
    window.api.updateSettings({ [id]: value });
    e.target.value = '';
    ext[id === 'todoistToken' ? 'todoist' : 'notion'].items = null;
  });
}
$('notionLink').addEventListener('change', (e) => {
  window.api.updateSettings({ notionLink: e.target.value });
  ext.notion.items = null;
});
$('todoistOff').onclick = (e) => { e.preventDefault(); window.api.updateSettings({ todoistToken: '' }); ext.todoist.items = null; };
$('notionOff').onclick = (e) => { e.preventDefault(); window.api.updateSettings({ notionToken: '' }); ext.notion.items = null; };
$('calendarLink').addEventListener('change', (e) => {
  const value = e.target.value.trim();
  if (!value) return;
  window.api.updateSettings({ calendarLink: value });
  e.target.value = '';
  ext.calendar.items = null;
});
$('calendarOff').onclick = (e) => { e.preventDefault(); window.api.updateSettings({ calendarLink: '' }); ext.calendar.items = null; };

// ---------- Google sign-in (for adding and deleting calendar events) ----------
$('googleClientSecret').addEventListener('change', (e) => {
  const value = e.target.value.trim();
  if (!value) return;
  window.api.updateSettings({ googleClientSecret: value });
  e.target.value = '';
});
$('googleConnect').onclick = () => {
  if (current && current.google.connected) window.api.googleDisconnect();
  else window.api.googleConnect();
  ext.calendar.items = null;
};

// ---------- dragging the corner to resize the window ----------
{
  const grip = $('winGrip');
  let from = null;
  let pending = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // keep receiving the pointer even when it moves outside the window
    grip.setPointerCapture(e.pointerId);
    from = { x: e.screenX, y: e.screenY, w: window.innerWidth, h: window.innerHeight };
  });
  grip.addEventListener('pointermove', (e) => {
    if (!from) return;
    const size = { w: from.w + (e.screenX - from.x), h: from.h + (e.screenY - from.y) };
    if (!pending) requestAnimationFrame(() => { window.api.resizeWindow(pending); pending = null; });
    pending = size;
  });
  const end = (e) => {
    if (!from) return;
    from = null;
    if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
    window.api.resizeWindowEnd();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => window.api.resetWindowSize());
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
    pic.innerHTML = c.svg;
    const name = document.createElement('span');
    name.textContent = c.name;
    item.append(pic, name);
    item.onclick = () => {
      charMenu.hidden = true;
      window.api.updateSettings({ character: id, ...(current && !current.settings.showPet ? { showPet: true } : {}) });
    };
    charMenu.append(item);
  }
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
$('checkUpdates').onclick = () => window.api.checkUpdates();
$('toggle').onclick = () => window.api.toggle();
$('reset').onclick = () => window.api.reset();
$('skip').onclick = () => window.api.skip();
$('min').onclick = () => window.api.minimize();
$('close').onclick = () => window.api.close();
$('gear').onclick = () => showSettings($('settings').hidden);
$('done').onclick = () => showSettings(false);
$('spot').onclick = () => {
  if (current && current.spotify.connected) window.api.spotifyPlayNow();
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
window.api.getState().then(render);
