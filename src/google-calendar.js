// Google Calendar with sign-in: read the main calendar, add events, delete
// events. Used when the person has signed in with Google; otherwise the app
// falls back to the read-only private link (src/calendar-source.js).
//
// Sign-in is Google's "desktop app" flow: a page opens in the browser, and
// Google sends the result back to a tiny temporary server on this computer.
const http = require('http');
const crypto = require('crypto');
const { viewWindow, eventItem, finishItems } = require('./calendar-source');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary';
// events only: Pomo can read and change events, but not calendar settings or sharing
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

let clientId = '';
let clientSecret = '';
let refreshToken = '';
let accessToken = '';
let expiresAt = 0;
let onRefreshToken = () => {};

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function init(opts) {
  clientId = String(opts.clientId || '').trim();
  clientSecret = String(opts.clientSecret || '').trim();
  refreshToken = opts.refreshToken || '';
  onRefreshToken = opts.onRefreshToken || (() => {});
  accessToken = '';
  expiresAt = 0;
}

const isConnected = () => Boolean(clientId && clientSecret && refreshToken);

async function tokenRequest(params) {
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    });
  } catch {
    throw new Error('Couldn\'t reach Google. Check your internet connection');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'invalid_grant') {
      // the saved sign-in is no longer valid (Google expires it after 7 days for
      // projects left in "Testing", or it was revoked)
      refreshToken = '';
      onRefreshToken('');
      throw new Error('Google signed Pomo out. Click ⚙ and sign in with Google again');
    }
    if (data.error === 'invalid_client') throw new Error('Google didn\'t accept that Client ID or secret. Copy them again from Google Cloud');
    throw new Error(`Google sign-in failed: ${data.error_description || data.error || res.status}`);
  }
  accessToken = data.access_token;
  expiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
  if (data.refresh_token) {
    refreshToken = data.refresh_token;
    onRefreshToken(refreshToken);
  }
}

// Opens Google's sign-in page in the browser and waits for it to come back.
function connect(openUrl, { timeoutMs = 5 * 60 * 1000 } = {}) {
  if (!clientId || !clientSecret) return Promise.reject(new Error('Paste your Google Client ID and Client secret first'));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const stateParam = b64url(crypto.randomBytes(12));

  return new Promise((resolve, reject) => {
    let redirect = '';
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, redirect);
      if (url.pathname !== '/') { res.writeHead(404).end(); return; }
      const done = (msg, err) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<body style="font-family:sans-serif;text-align:center;padding-top:80px"><h2>${msg}</h2><p>You can close this tab.</p></body>`);
        clearTimeout(timer);
        server.close();
        if (err) reject(err); else resolve();
      };
      if (url.searchParams.get('state') !== stateParam || !url.searchParams.get('code')) {
        const why = url.searchParams.get('error') === 'access_denied' ? 'Google sign-in was cancelled' : 'Google sign-in didn\'t finish';
        return done(why, new Error(why));
      }
      try {
        await tokenRequest({
          grant_type: 'authorization_code',
          code: url.searchParams.get('code'),
          redirect_uri: redirect,
          code_verifier: verifier,
        });
        if (!refreshToken) throw new Error('Google didn\'t return a lasting sign-in. Try signing in again');
        done('Pomo is connected to Google Calendar');
      } catch (e) {
        done('Something went wrong connecting to Google', e);
      }
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('Google sign-in timed out')); }, timeoutMs);
    server.on('error', (e) => { clearTimeout(timer); reject(e); });
    // any free port: Google allows that for desktop apps on 127.0.0.1
    server.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${server.address().port}`;
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope: SCOPE,
        state: stateParam,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline', // so Pomo stays signed in
        prompt: 'consent',
      });
      openUrl(`${AUTH_URL}?${q}`);
    });
  });
}

function disconnect() {
  refreshToken = '';
  accessToken = '';
  expiresAt = 0;
}

function fail(status, data) {
  const err = (data && data.error) || {};
  const reason = (err.errors && err.errors[0] && err.errors[0].reason) || err.status || '';
  const message = String(err.message || '');
  if (status === 403 && (/accessNotConfigured/i.test(reason) || /has not been used|is disabled/i.test(message))) {
    return new Error('The Google Calendar API isn\'t switched on for your Google Cloud project yet. Enable it there, wait a minute, and try again');
  }
  if (status === 403 && /insufficient/i.test(`${reason} ${message}`)) return new Error('Pomo wasn\'t given permission to change your calendar. Sign out and sign in with Google again');
  if (status === 404 || status === 410) return new Error('Google Calendar couldn\'t find that event. It may have been deleted already');
  if (status >= 500 || status === 429) return new Error(`Google Calendar is having trouble on its side right now (error ${status}). Wait a minute, then press ↻`);
  return new Error(message ? `Google Calendar: ${message.slice(0, 120)}` : `Google Calendar answered with an error (${status})`);
}

async function api(method, path, { query, body } = {}) {
  if (!isConnected()) throw new Error('Sign in with Google first. Click ⚙ and look under Calendar');
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!accessToken || Date.now() > expiresAt) await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
    let res;
    try {
      res = await fetch(`${API}${path}${query ? `?${new URLSearchParams(query)}` : ''}`, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Couldn\'t reach Google Calendar. Check your internet connection');
    }
    if (res.status === 401 && attempt === 0) { accessToken = ''; continue; } // token went stale: get a fresh one once
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) throw fail(res.status, data);
    return data;
  }
  throw new Error('Google signed Pomo out. Click ⚙ and sign in with Google again');
}

// "2026-11-23" -> local midnight of that day
const localDay = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };

// Events on the main calendar for today and the six days after.
async function listEvents(now = new Date()) {
  const { from, to } = viewWindow(now);
  const items = [];
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const data = await api('GET', '/events', { query: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true', // repeating events come back as their separate occurrences
      orderBy: 'startTime',
      maxResults: '250',
      ...(pageToken ? { pageToken } : {}),
    } });
    for (const ev of data.items || []) {
      if (!ev || ev.status === 'cancelled' || !ev.start) continue;
      const allDay = Boolean(ev.start.date);
      const start = allDay ? localDay(ev.start.date) : new Date(ev.start.dateTime);
      // an all-day event's end date is the day after its last day
      const end = ev.end
        ? (allDay ? new Date(localDay(ev.end.date).getTime() - 1) : new Date(ev.end.dateTime))
        : start;
      const item = eventItem({ id: String(ev.id), title: ev.summary || '(no title)', start, end, allDay }, from, to);
      if (item) items.push(item);
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return finishItems(items);
}

// Adds an event from a plain sentence, e.g. "Dentist tomorrow 3pm". Google
// works out the date and time. With no time given, it starts now.
async function quickAdd(text) {
  const clean = String(text || '').trim().slice(0, 200);
  if (!clean) throw new Error('Type what the event is first');
  const ev = await api('POST', '/events/quickAdd', { query: { text: clean } });
  return { id: String(ev.id || ''), text: ev.summary || clean };
}

// Adds an event with exact start and end times (used to log focus rounds).
async function createEvent({ summary, start, end }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ev = await api('POST', '/events', { body: {
    summary: String(summary || 'Focus session').slice(0, 200),
    start: { dateTime: start.toISOString(), timeZone: zone },
    end: { dateTime: end.toISOString(), timeZone: zone },
  } });
  return { id: String(ev.id || '') };
}

// Deletes one event. For a repeating event this removes only that one occurrence.
const deleteEvent = (id) => api('DELETE', `/events/${encodeURIComponent(id)}`);

module.exports = { init, isConnected, connect, disconnect, listEvents, quickAdd, createEvent, deleteEvent, SCOPE };
