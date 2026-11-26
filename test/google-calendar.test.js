const test = require('node:test');
const assert = require('node:assert');

const NOW = new Date(2026, 10, 23, 10, 0, 0); // a Monday, 10:00 local time
const pad = (n) => String(n).padStart(2, '0');
const ymd = (off) => { const d = new Date(2026, 10, 23 + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const at = (off, h, m = 0) => new Date(2026, 10, 23 + off, h, m).toISOString();
const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

// A stand-in for Google. `handler` answers calendar calls; sign-in calls are answered here.
function fakeGoogle(handler, { token = () => reply(200, { access_token: 'access-1', expires_in: 3600 }) } = {}) {
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.host === 'oauth2.googleapis.com') { calls.push(`TOKEN ${new URLSearchParams(init.body).get('grant_type')}`); return token(new URLSearchParams(init.body)); }
    const line = `${init.method || 'GET'} ${u.pathname.replace('/calendar/v3/calendars/primary', '')}`;
    calls.push(line);
    return handler({ line, query: u.searchParams, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.Authorization });
  };
  return calls;
}

function fresh(opts = {}) {
  delete require.cache[require.resolve('../src/google-calendar')];
  const g = require('../src/google-calendar');
  g.init({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', ...opts });
  return g;
}

test('not signed in until there is a client id, a secret and a saved sign-in', () => {
  assert.strictEqual(fresh().isConnected(), true);
  assert.strictEqual(fresh({ refreshToken: '' }).isConnected(), false);
  assert.strictEqual(fresh({ clientSecret: '' }).isConnected(), false);
});

test('listing: asks for the coming week as single occurrences and formats the rows', async () => {
  let asked;
  fakeGoogle(({ query }) => {
    asked = query;
    return reply(200, { items: [
      { id: 'b', summary: 'Lunch with Sam', start: { dateTime: at(0, 12, 30) }, end: { dateTime: at(0, 13, 30) } },
      { id: 'a', summary: 'Rent due', start: { date: ymd(0) }, end: { date: ymd(1) } },
      { id: 'c', summary: 'Dentist', start: { dateTime: at(2, 15) }, end: { dateTime: at(2, 16) } },
      { id: 'd', status: 'cancelled', start: { dateTime: at(0, 9) } },
      { id: 'e', start: { dateTime: at(0, 16) }, end: { dateTime: at(0, 17) } },
    ] });
  });
  const items = await fresh().listEvents(NOW);
  assert.deepStrictEqual(items.map((i) => [i.id, i.text, i.today]), [
    ['a', 'Rent due', true], ['b', 'Lunch with Sam', true], ['e', '(no title)', true], ['c', 'Dentist', false],
  ]);
  assert.strictEqual(items[0].label, 'all day');
  assert.strictEqual(asked.get('singleEvents'), 'true');
  assert.strictEqual(asked.get('orderBy'), 'startTime');
  assert.strictEqual(new Date(asked.get('timeMin')).getTime(), new Date(2026, 10, 23).getTime());
});

test('listing: follows extra pages', async () => {
  let page = 0;
  fakeGoogle(({ query }) => (page++ === 0
    ? reply(200, { items: [{ id: '1', summary: 'One', start: { dateTime: at(0, 11) }, end: { dateTime: at(0, 12) } }], nextPageToken: 'p2' })
    : reply(200, { items: [{ id: '2', summary: `Two via ${query.get('pageToken')}`, start: { dateTime: at(0, 13) }, end: { dateTime: at(0, 14) } }] })));
  assert.deepStrictEqual((await fresh().listEvents(NOW)).map((i) => i.text), ['One', 'Two via p2']);
});

test('adding from a sentence uses Google\'s quick add', async () => {
  const calls = fakeGoogle(({ query }) => reply(200, { id: 'new1', summary: `parsed: ${query.get('text')}` }));
  const ev = await fresh().quickAdd('  Dentist tomorrow 3pm ');
  assert.deepStrictEqual(ev, { id: 'new1', text: 'parsed: Dentist tomorrow 3pm' });
  assert.deepStrictEqual(calls, ['TOKEN refresh_token', 'POST /events/quickAdd']);
  await assert.rejects(fresh().quickAdd('   '), /Type what the event is/);
});

test('logging a focus round creates an event with exact times', async () => {
  let sent;
  fakeGoogle(({ body }) => { sent = body; return reply(200, { id: 'f1' }); });
  const start = new Date(2026, 10, 23, 9, 0); const end = new Date(2026, 10, 23, 9, 25);
  assert.deepStrictEqual(await fresh().createEvent({ summary: 'Focus session', start, end }), { id: 'f1' });
  assert.strictEqual(sent.summary, 'Focus session');
  assert.strictEqual(sent.start.dateTime, start.toISOString());
  assert.strictEqual(sent.end.dateTime, end.toISOString());
  assert.ok(sent.start.timeZone);
});

test('deleting an event calls the right address with the sign-in attached', async () => {
  let auth;
  const calls = fakeGoogle((c) => { auth = c.auth; return reply(204, {}); });
  await fresh().deleteEvent('abc_20261123T090000Z');
  assert.deepStrictEqual(calls, ['TOKEN refresh_token', 'DELETE /events/abc_20261123T090000Z']);
  assert.strictEqual(auth, 'Bearer access-1');
});

test('a stale sign-in is refreshed once and the call repeated', async () => {
  let n = 0;
  const calls = fakeGoogle(() => (n++ === 0 ? reply(401, {}) : reply(200, { items: [] })));
  assert.deepStrictEqual(await fresh().listEvents(NOW), []);
  assert.deepStrictEqual(calls, ['TOKEN refresh_token', 'GET /events', 'TOKEN refresh_token', 'GET /events']);
});

test('an expired sign-in signs Pomo out and says to sign in again', async () => {
  let cleared = 'unchanged';
  fakeGoogle(() => reply(200, {}), { token: () => reply(400, { error: 'invalid_grant' }) });
  const g = fresh({ onRefreshToken: (t) => { cleared = t; } });
  await assert.rejects(g.listEvents(NOW), /signed Pomo out/);
  assert.strictEqual(cleared, '');
  assert.strictEqual(g.isConnected(), false);
});

test('each kind of problem gets a clear message', async () => {
  fakeGoogle(() => reply(403, { error: { message: 'Google Calendar API has not been used in project 123 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] } }));
  await assert.rejects(fresh().listEvents(NOW), /isn't switched on for your Google Cloud project/);
  fakeGoogle(() => reply(404, { error: { message: 'Not Found' } }));
  await assert.rejects(fresh().deleteEvent('x'), /couldn't find that event/);
  fakeGoogle(() => reply(410, { error: { message: 'Resource has been deleted' } }));
  await assert.rejects(fresh().deleteEvent('x'), /couldn't find that event/);
  fakeGoogle(() => reply(503, {}));
  await assert.rejects(fresh().listEvents(NOW), /trouble on its side/);
  fakeGoogle(() => reply(200, {}), { token: () => reply(401, { error: 'invalid_client' }) });
  await assert.rejects(fresh().listEvents(NOW), /didn't accept that Client ID or secret/);
  await assert.rejects(fresh({ refreshToken: '' }).listEvents(NOW), /Sign in with Google first/);
  global.fetch = async (url) => { if (String(url).includes('oauth2')) return reply(200, { access_token: 'a', expires_in: 3600 }); throw new Error('offline'); };
  await assert.rejects(fresh().listEvents(NOW), /Couldn't reach Google Calendar/);
});

test('signing in: opens Google\'s page, then trades the returned code for a lasting sign-in', async () => {
  let saved = '';
  let tokenBody;
  fakeGoogle(() => reply(200, {}), { token: (body) => { tokenBody = body; return reply(200, { access_token: 'a1', refresh_token: 'lasting', expires_in: 3600 }); } });
  const realFetch = global.fetch;
  const g = fresh({ refreshToken: '', onRefreshToken: (t) => { saved = t; } });
  const http = require('http');
  await g.connect((authUrl) => {
    const u = new URL(authUrl);
    assert.strictEqual(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.strictEqual(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.events');
    assert.strictEqual(u.searchParams.get('access_type'), 'offline');
    assert.strictEqual(u.searchParams.get('code_challenge_method'), 'S256');
    assert.match(u.searchParams.get('redirect_uri'), /^http:\/\/127\.0\.0\.1:\d+$/);
    // play the part of the browser coming back from Google
    http.get(`${u.searchParams.get('redirect_uri')}/?state=${u.searchParams.get('state')}&code=the-code`, (res) => res.resume());
  });
  global.fetch = realFetch;
  assert.strictEqual(saved, 'lasting');
  assert.strictEqual(g.isConnected(), true);
  assert.strictEqual(tokenBody.get('code'), 'the-code');
  assert.strictEqual(tokenBody.get('client_secret'), 'secret');
  assert.ok(tokenBody.get('code_verifier').length > 40);
});

test('signing in: cancelling on Google\'s page is reported plainly', async () => {
  fakeGoogle(() => reply(200, {}));
  const http = require('http');
  await assert.rejects(fresh({ refreshToken: '' }).connect((authUrl) => {
    const u = new URL(authUrl);
    http.get(`${u.searchParams.get('redirect_uri')}/?error=access_denied`, (res) => res.resume());
  }), /cancelled/);
  await assert.rejects(fresh({ clientId: '', refreshToken: '' }).connect(() => {}), /Client ID and Client secret first/);
});
