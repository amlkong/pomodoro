// Views of tasks kept in other apps (Todoist, Notion), so they can be looked at
// inside Pomo and picked into the session's to-do list. Reading is all it does
// by default. Changing Todoist (completing, adding, deleting a task) only
// happens when the person has switched that on in settings.

const TODOIST_URL = 'https://api.todoist.com/api/v1/tasks';
const NOTION_URL = 'https://api.notion.com/v1';
const NOTION_OLD = '2022-06-28'; // works for ordinary single-source databases
const NOTION_NEW = '2025-09-03'; // needed for databases with several data sources
const MAX_ITEMS = 300;

let retryMs = 800;
const setRetryDelay = (ms) => { retryMs = ms; }; // tests use this so they don't wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One request. A dropped connection or a "the server tripped over" answer
// (500, 502, 503, 504) or "slow down" (429) is tried again a couple of times
// before giving up, since those usually clear up by themselves within seconds.
async function getJson(url, init, service) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(retryMs * attempt);
    let res;
    try {
      res = await fetch(url, init);
    } catch {
      last = null;
      continue;
    }
    const data = await res.json().catch(() => ({}));
    last = { status: res.status, ok: res.ok, data };
    if (res.status < 500 && res.status !== 429) return last;
  }
  if (!last) throw new Error(`Couldn't reach ${service}. Check your internet connection`);
  return last;
}

// What to say when the other service itself is having a bad moment.
const serverTrouble = (service, status) => (status === 429
  ? `${service} asked Pomo to slow down. Wait a minute, then press ↻`
  : `${service} is having trouble on its side right now (error ${status}). Wait a minute, then press ↻`);

// ---------- Todoist ----------

const todayString = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function todoistLabel(due, today) {
  if (!due) return '';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return due.slice(5).replace('-', '/'); // 03/14
}

async function fetchTodoist(token) {
  if (!token) throw new Error('Todoist isn\'t connected yet. Click ⚙ and paste your Todoist token');
  const headers = { Authorization: `Bearer ${token}` };
  const tasks = [];
  let cursor = '';
  for (let page = 0; page < 6 && tasks.length < MAX_ITEMS; page++) {
    const url = `${TODOIST_URL}?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const r = await getJson(url, { headers }, 'Todoist');
    if (r.status === 401 || r.status === 403) throw new Error('Todoist didn\'t accept that token. Copy it again from Todoist settings');
    if (r.status >= 500 || r.status === 429) throw new Error(serverTrouble('Todoist', r.status));
    if (!r.ok) throw new Error(`Todoist answered with an error (${r.status})`);
    const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
    tasks.push(...list);
    cursor = Array.isArray(r.data) ? '' : (r.data.next_cursor || '');
    if (!cursor) break;
  }
  const today = todayString();
  return tasks
    .filter((t) => t && t.content && !t.checked && !t.is_completed && !t.is_deleted)
    .map((t) => {
      const due = t.due && typeof t.due.date === 'string' ? t.due.date.slice(0, 10) : '';
      return { id: String(t.id), text: String(t.content).slice(0, 140), due, label: todoistLabel(due, today), today: Boolean(due) && due <= today, priority: Number(t.priority) || 1 };
    })
    // due soonest first, then the ones without a date, most important first within a day
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.priority - a.priority)
    .slice(0, MAX_ITEMS);
}

// Marks a Todoist task done, or brings it back. Only ever called when the
// person has switched on "also complete it in Todoist".
async function setTodoistDone(token, id, done) {
  if (!token) throw new Error('Todoist isn\'t connected yet. Click ⚙ and paste your Todoist token');
  const r = await getJson(`${TODOIST_URL}/${encodeURIComponent(id)}/${done ? 'close' : 'reopen'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, 'Todoist');
  if (r.ok) return;
  if (r.status === 401 || r.status === 403) throw new Error('Todoist didn\'t accept that token. Copy it again from Todoist settings');
  if (r.status === 404) throw new Error('Todoist couldn\'t find that task. It may have been deleted or finished already');
  if (r.status >= 500 || r.status === 429) throw new Error(serverTrouble('Todoist', r.status));
  throw new Error(`Todoist couldn't ${done ? 'complete' : 'reopen'} that task (${r.status})`);
}

// What went wrong, for the Todoist calls that change something.
function todoistFail(r, doing) {
  if (r.status === 401 || r.status === 403) return new Error('Todoist didn\'t accept that token. Copy it again from Todoist settings');
  if (r.status === 404) return new Error('Todoist couldn\'t find that task. It may have been deleted or finished already');
  if (r.status >= 500 || r.status === 429) return new Error(serverTrouble('Todoist', r.status));
  return new Error(`Todoist couldn't ${doing} (${r.status})`);
}

// Creates a new task in Todoist's Inbox. Returns it in the same shape as the list.
async function addTodoist(token, text) {
  if (!token) throw new Error('Todoist isn\'t connected yet. Click ⚙ and paste your Todoist token');
  const content = String(text || '').trim().slice(0, 140);
  if (!content) throw new Error('Type what the task is first');
  const r = await getJson(TODOIST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  }, 'Todoist');
  if (!r.ok) throw todoistFail(r, 'add that task');
  return { id: String(r.data.id || ''), text: String(r.data.content || content), due: '', label: '', today: false, priority: 1 };
}

// Deletes a task from Todoist for good. Todoist has no undo for this.
async function deleteTodoist(token, id) {
  if (!token) throw new Error('Todoist isn\'t connected yet. Click ⚙ and paste your Todoist token');
  const r = await getJson(`${TODOIST_URL}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }, 'Todoist');
  if (!r.ok) throw todoistFail(r, 'delete that task');
}

// ---------- Notion ----------

// Pulls the 32-character id out of a Notion link (or accepts a bare id).
function notionId(link) {
  const s = String(link || '').trim().split('?')[0].replace(/-/g, '');
  const m = s.match(/[0-9a-fA-F]{32}(?!.*[0-9a-fA-F]{32})/);
  return m ? m[0].toLowerCase() : '';
}

const plain = (rich) => (Array.isArray(rich) ? rich.map((r) => r.plain_text || '').join('') : '').trim();

const DONE_WORDS = /^(done|complete|completed|finished|archived|cancell?ed)$/i;

// A row of a Notion database -> a task, or null if it is already done.
function notionRowToTask(page) {
  const props = page.properties || {};
  let text = '';
  let label = '';
  for (const p of Object.values(props)) {
    if (p.type === 'title') text = plain(p.title);
    else if (p.type === 'checkbox' && p.checkbox === true) return null;
    else if (p.type === 'status' && p.status) {
      if (DONE_WORDS.test(p.status.name || '')) return null;
      label = p.status.name || label;
    } else if (p.type === 'select' && p.select && DONE_WORDS.test(p.select.name || '')) return null;
  }
  if (!text) return null;
  return { id: String(page.id), text: text.slice(0, 140), label: label.slice(0, 18), today: true };
}

async function notionRequest(token, method, path, version, body) {
  return getJson(`${NOTION_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': version, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }, 'Notion');
}

function notionFail(r) {
  if (r.status === 401) return new Error('Notion didn\'t accept that token. Copy the integration secret again');
  if (r.status === 404) return new Error('Notion can\'t see that page. Open it in Notion, click ••• → Connections, and add your integration');
  if (r.status >= 500 || r.status === 429) return new Error(serverTrouble('Notion', r.status));
  return new Error((r.data && r.data.message) ? `Notion: ${String(r.data.message).slice(0, 120)}` : `Notion answered with an error (${r.status})`);
}

async function queryAll(token, path, version) {
  const rows = [];
  let cursor;
  for (let page = 0; page < 5 && rows.length < MAX_ITEMS; page++) {
    const r = await notionRequest(token, 'POST', path, version, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    if (!r.ok) return { error: r, rows };
    rows.push(...(r.data.results || []));
    if (!r.data.has_more || !r.data.next_cursor) break;
    cursor = r.data.next_cursor;
  }
  return { rows };
}

// Unchecked to-do checkboxes on a plain Notion page, including ones tucked
// inside toggles or columns a couple of levels down.
async function notionPageTodos(token, blockId, depth = 0, out = []) {
  let cursor = '';
  for (let page = 0; page < 5 && out.length < MAX_ITEMS; page++) {
    const r = await notionRequest(token, 'GET', `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`, NOTION_OLD);
    if (!r.ok) {
      if (depth === 0) throw notionFail(r);
      return out;
    }
    for (const block of r.data.results || []) {
      if (block.type === 'to_do' && block.to_do) {
        const text = plain(block.to_do.rich_text);
        if (text && !block.to_do.checked) out.push({ id: String(block.id), text: text.slice(0, 140), label: '', today: true });
      }
      const container = ['toggle', 'column_list', 'column', 'synced_block', 'callout', 'quote', 'bulleted_list_item', 'numbered_list_item', 'to_do']
        .includes(block.type) || /^heading_/.test(block.type || '');
      if (block.has_children && container && depth < 2) await notionPageTodos(token, block.id, depth + 1, out);
    }
    if (!r.data.has_more || !r.data.next_cursor) break;
    cursor = r.data.next_cursor;
  }
  return out;
}

async function fetchNotion(token, link) {
  if (!token) throw new Error('Notion isn\'t connected yet. Click ⚙ and paste your Notion secret and page link');
  const id = notionId(link);
  if (!id) throw new Error('Almost there. Click ⚙ and paste the link to your Notion page or database');

  // 1. A database, the ordinary way.
  let q = await queryAll(token, `/databases/${id}/query`, NOTION_OLD);
  if (q.error && q.error.status === 401) throw notionFail(q.error);

  // 2. A database with several data sources needs the newer API: look up its
  //    sources and read each of them.
  if (q.error && q.error.status !== 404) {
    const db = await notionRequest(token, 'GET', `/databases/${id}`, NOTION_NEW);
    const sources = db.ok && Array.isArray(db.data.data_sources) ? db.data.data_sources : [];
    if (sources.length) {
      const rows = [];
      for (const src of sources.slice(0, 5)) {
        const part = await queryAll(token, `/data_sources/${src.id}/query`, NOTION_NEW);
        if (part.error) throw notionFail(part.error);
        rows.push(...part.rows);
      }
      q = { rows };
    }
  }
  if (!q.error) return q.rows.map(notionRowToTask).filter(Boolean).slice(0, MAX_ITEMS);

  // 3. Not a database: treat it as a page and collect its to-do checkboxes.
  return (await notionPageTodos(token, id)).slice(0, MAX_ITEMS);
}

module.exports = { setRetryDelay, fetchTodoist, setTodoistDone, addTodoist, deleteTodoist, fetchNotion, notionId, notionRowToTask, todoistLabel };
