const test = require('node:test');
const assert = require('node:assert');
const { fetchTodoist, fetchNotion, notionId, notionRowToTask } = require('../src/task-sources');

const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const day = (offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ---------- Todoist ----------

test('Todoist: reads every page and sorts by due date, undated last', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    if (!url.includes('cursor=')) {
      return reply(200, { results: [
        { id: '1', content: 'No date', priority: 1 },
        { id: '2', content: 'Tomorrow', due: { date: day(1) }, priority: 1 },
      ], next_cursor: 'abc' });
    }
    return reply(200, { results: [
      { id: '3', content: 'Overdue', due: { date: day(-2) }, priority: 1 },
      { id: '4', content: 'Today low', due: { date: day(0) }, priority: 1 },
      { id: '5', content: 'Today urgent', due: { date: `${day(0)}T09:00:00` }, priority: 4 },
      { id: '6', content: 'Already done', checked: true },
    ], next_cursor: null });
  };
  const tasks = await fetchTodoist('secret');
  assert.deepStrictEqual(tasks.map((t) => t.text), ['Overdue', 'Today urgent', 'Today low', 'Tomorrow', 'No date']);
  assert.deepStrictEqual(tasks.map((t) => t.label), ['overdue', 'today', 'today', day(1).slice(5).replace('-', '/'), '']);
  assert.deepStrictEqual(tasks.map((t) => t.today), [true, true, true, false, false]);
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0].auth, 'Bearer secret');
  assert.match(calls[0].url, /^https:\/\/api\.todoist\.com\/api\/v1\/tasks\?/);
  assert.match(calls[1].url, /cursor=abc/);
});

test('Todoist: also understands a plain list reply', async () => {
  global.fetch = async () => reply(200, [{ id: 9, content: 'Plain' }]);
  assert.deepStrictEqual((await fetchTodoist('t')).map((t) => [t.id, t.text]), [['9', 'Plain']]);
});

test('Todoist: a wrong token, a missing token and no internet each get a clear message', async () => {
  global.fetch = async () => reply(401, {});
  await assert.rejects(fetchTodoist('bad'), /didn't accept that token/);
  await assert.rejects(fetchTodoist(''), /Add your Todoist token/);
  global.fetch = async () => { throw new Error('ENOTFOUND'); };
  await assert.rejects(fetchTodoist('t'), /Couldn't reach Todoist/);
});

// ---------- Notion ----------

const ID = '0123456789abcdef0123456789abcdef';
const row = (title, extra = {}) => ({ id: `row-${title}`, properties: { Name: { type: 'title', title: [{ plain_text: title }] }, ...extra } });

test('Notion: ids are found in the usual link shapes', () => {
  assert.strictEqual(notionId(`https://www.notion.so/me/My-Tasks-${ID}?v=fedcba9876543210fedcba9876543210`), ID);
  assert.strictEqual(notionId(`https://www.notion.so/${ID}`), ID);
  assert.strictEqual(notionId('01234567-89ab-cdef-0123-456789abcdef'), ID);
  assert.strictEqual(notionId('not a link'), '');
});

test('Notion: a database lists its open rows and skips finished ones', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push(`${init.method} ${url.replace('https://api.notion.com/v1', '')} v${init.headers['Notion-Version']}`);
    const body = JSON.parse(init.body);
    if (!body.start_cursor) {
      return reply(200, { results: [
        row('Write report', { Status: { type: 'status', status: { name: 'In progress' } } }),
        row('Old thing', { Status: { type: 'status', status: { name: 'Done' } } }),
        row('Ticked', { Done: { type: 'checkbox', checkbox: true } }),
      ], has_more: true, next_cursor: 'c2' });
    }
    return reply(200, { results: [row('Call the vet', { Done: { type: 'checkbox', checkbox: false } })], has_more: false });
  };
  const tasks = await fetchNotion('secret', `https://www.notion.so/Tasks-${ID}`);
  assert.deepStrictEqual(tasks.map((t) => [t.text, t.label]), [['Write report', 'In progress'], ['Call the vet', '']]);
  assert.deepStrictEqual(calls, [`POST /databases/${ID}/query v2022-06-28`, `POST /databases/${ID}/query v2022-06-28`]);
});

test('Notion: a database with several data sources falls back to the newer API', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    const path = url.replace('https://api.notion.com/v1', '');
    calls.push(`${init.method} ${path} v${init.headers['Notion-Version']}`);
    if (path === `/databases/${ID}/query`) return reply(400, { message: 'Databases with multiple data sources are not supported in this API version.' });
    if (path === `/databases/${ID}`) return reply(200, { data_sources: [{ id: 'src1' }, { id: 'src2' }] });
    if (path === '/data_sources/src1/query') return reply(200, { results: [row('From one')], has_more: false });
    if (path === '/data_sources/src2/query') return reply(200, { results: [row('From two')], has_more: false });
    return reply(500, {});
  };
  const tasks = await fetchNotion('secret', ID);
  assert.deepStrictEqual(tasks.map((t) => t.text), ['From one', 'From two']);
  assert.ok(calls.includes(`GET /databases/${ID} v2025-09-03`));
});

test('Notion: a plain page gives its unchecked to-do boxes, including nested ones', async () => {
  const todo = (id, text, checked, hasChildren = false) => ({ id, type: 'to_do', has_children: hasChildren, to_do: { rich_text: [{ plain_text: text }], checked } });
  global.fetch = async (url) => {
    const path = url.replace('https://api.notion.com/v1', '');
    if (path.startsWith(`/databases/${ID}/query`)) return reply(400, { message: 'is a page, not a database' });
    if (path === `/databases/${ID}`) return reply(400, { message: 'is a page, not a database' });
    if (path.startsWith(`/blocks/${ID}/children`)) {
      return reply(200, { results: [
        { id: 'p1', type: 'paragraph', has_children: false, paragraph: {} },
        todo('a', 'Buy hay', false),
        todo('b', 'Already bought', true),
        { id: 'tog', type: 'toggle', has_children: true, toggle: {} },
      ], has_more: false });
    }
    if (path.startsWith('/blocks/tog/children')) return reply(200, { results: [todo('c', 'Inside a toggle', false)], has_more: false });
    return reply(404, {});
  };
  const tasks = await fetchNotion('secret', ID);
  assert.deepStrictEqual(tasks.map((t) => t.text), ['Buy hay', 'Inside a toggle']);
});

test('Notion: an unshared page explains how to connect the integration', async () => {
  global.fetch = async () => reply(404, { message: 'Could not find database' });
  await assert.rejects(fetchNotion('secret', ID), /Connections/);
});

test('Notion: missing pieces and a wrong token each get a clear message', async () => {
  await assert.rejects(fetchNotion('', ID), /integration secret/);
  await assert.rejects(fetchNotion('secret', 'nope'), /Paste the link/);
  global.fetch = async () => reply(401, { message: 'API token is invalid.' });
  await assert.rejects(fetchNotion('bad', ID), /didn't accept that token/);
});

test('Notion: rows without a title are skipped', () => {
  assert.strictEqual(notionRowToTask({ id: 'x', properties: { Name: { type: 'title', title: [] } } }), null);
});
