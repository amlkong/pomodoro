// Spotify remote control: tells whichever Spotify app you already have open
// to play or pause. Uses the PKCE login flow, so no client secret is needed.
const http = require('http');
const crypto = require('crypto');

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-modify-playback-state user-read-playback-state';

let clientId = '';
let refreshToken = '';
let accessToken = '';
let expiresAt = 0;
let onRefreshToken = () => {};
let contextSent = false;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function init(opts) {
  clientId = opts.clientId || '';
  refreshToken = opts.refreshToken || '';
  onRefreshToken = opts.onRefreshToken || (() => {});
  accessToken = '';
  expiresAt = 0;
}

const isConnected = () => Boolean(clientId && refreshToken);

async function tokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `Spotify login failed (${res.status})`);
  accessToken = data.access_token;
  expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (data.refresh_token) {
    refreshToken = data.refresh_token;
    onRefreshToken(refreshToken);
  }
}

// Opens the Spotify login page in the browser and waits for it to come back.
function connect(id, openUrl) {
  clientId = id;
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const stateParam = b64url(crypto.randomBytes(12));

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, REDIRECT);
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const done = (msg, err) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<body style="font-family:sans-serif;text-align:center;padding-top:80px"><h2>${msg}</h2><p>You can close this tab.</p></body>`);
        clearTimeout(timer);
        server.close();
        err ? reject(err) : resolve();
      };
      if (url.searchParams.get('state') !== stateParam || !url.searchParams.get('code')) {
        return done('Spotify login was cancelled', new Error('Spotify login was cancelled'));
      }
      try {
        await tokenRequest({
          grant_type: 'authorization_code',
          code: url.searchParams.get('code'),
          redirect_uri: REDIRECT,
          code_verifier: verifier,
        });
        done('Pomo is connected to Spotify 🍅');
      } catch (e) {
        done('Something went wrong connecting to Spotify', e);
      }
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('Spotify login timed out')); }, 3 * 60 * 1000);
    server.on('error', (e) => { clearTimeout(timer); reject(e); });
    server.listen(PORT, '127.0.0.1', () => {
      const q = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: REDIRECT,
        scope: SCOPES,
        state: stateParam,
        code_challenge_method: 'S256',
        code_challenge: challenge,
      });
      openUrl(`https://accounts.spotify.com/authorize?${q}`);
    });
  });
}

function disconnect() {
  refreshToken = '';
  accessToken = '';
  expiresAt = 0;
  contextSent = false;
}

// One call to the Spotify Web API. Returns { status, data } and never throws
// for an HTTP error, so callers can decide what a 404 or 403 means for them.
async function request(method, path, body) {
  if (!isConnected()) throw new Error('Not connected to Spotify');
  if (!accessToken || Date.now() > expiresAt) {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

const reasonOf = (r) => (r.data && r.data.error && r.data.error.reason) || '';
const noDevice = (r) => r.status === 404 || reasonOf(r) === 'NO_ACTIVE_DEVICE';

function fail(r) {
  if (reasonOf(r) === 'PREMIUM_REQUIRED') return new Error('Spotify only allows remote control on Premium accounts');
  return new Error((r.data && r.data.error && r.data.error.message) || `Spotify error ${r.status}`);
}

// Turns a pasted playlist or album link into a spotify: URI.
function toUri(link) {
  if (!link) return '';
  const s = link.trim();
  if (/^spotify:(playlist|album):[A-Za-z0-9]+$/.test(s)) return s;
  const m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album)\/([A-Za-z0-9]+)/);
  return m ? `spotify:${m[1]}:${m[2]}` : '';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every Spotify app the account can play on right now (computer, phone, speaker).
async function listDevices() {
  const r = await request('GET', '/me/player/devices');
  if (!r.ok) throw fail(r);
  return (r.data.devices || []).filter((d) => d.id && !d.is_restricted);
}

// Prefer whatever is already active, then this computer, then anything else.
const pickDevice = (devices) => devices.find((d) => d.is_active)
  || devices.find((d) => d.type === 'Computer')
  || devices[0]
  || null;

// Finds a Spotify app to play on. If none is open, asks for the desktop app to
// be opened and waits for it to show up.
async function findDevice({ openApp, onStatus, waitMs = 25000, pollMs = 1500 } = {}) {
  let device = pickDevice(await listDevices());
  if (device) return device;
  if (!openApp) return null;
  if (onStatus) onStatus('Opening Spotify…');
  await openApp();
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    device = pickDevice(await listDevices());
    if (device) return device;
  }
  return null;
}

// Starts the music. If Spotify isn't the active player (or isn't open at all),
// this wakes it up first, so there is no need to press play there beforehand.
async function play(playlistLink, opts = {}) {
  const uri = toUri(playlistLink);
  const wantsContext = Boolean(uri && !contextSent);
  // Only start the playlist the first time. After that just resume where it left off.
  let r = await request('PUT', '/me/player/play', wantsContext ? { context_uri: uri } : undefined);

  if (noDevice(r)) {
    const device = await findDevice(opts);
    if (!device) throw new Error('Couldn\'t find Spotify. Open the Spotify app once, then try again');
    if (opts.onStatus) opts.onStatus('Starting your music…');
    const target = `?device_id=${encodeURIComponent(device.id)}`;
    if (uri) {
      // a freshly opened app has nothing queued, so always hand it the playlist
      r = await request('PUT', `/me/player/play${target}`, { context_uri: uri });
    } else {
      // no playlist chosen: pick up whatever was playing last, on that device
      r = await request('PUT', '/me/player', { device_ids: [device.id], play: true });
      if (r.ok || r.status === 403) r = await request('PUT', `/me/player/play${target}`);
    }
    // a just-launched app can take a moment before it accepts commands
    for (let i = 0; i < 3 && (noDevice(r) || r.status === 502 || r.status === 503); i++) {
      await sleep(opts.pollMs || 1500);
      r = await request('PUT', `/me/player/play${target}`, uri ? { context_uri: uri } : undefined);
    }
    if (noDevice(r)) {
      throw new Error(uri
        ? 'Spotify opened but didn\'t start. Press play there once, then try again'
        : 'Spotify has nothing queued. Paste a playlist link in settings so Pomo knows what to play');
    }
  }

  // 403 with no reason usually means "already playing", which is fine.
  if (!r.ok && !(r.status === 403 && reasonOf(r) !== 'PREMIUM_REQUIRED')) throw fail(r);
  if (uri) contextSent = true;
}

async function pause() {
  const r = await request('PUT', '/me/player/pause');
  // nothing playing, or already paused: both are exactly what was wanted
  if (r.ok || noDevice(r) || (r.status === 403 && reasonOf(r) !== 'PREMIUM_REQUIRED')) return;
  throw fail(r);
}

const resetContext = () => { contextSent = false; };

module.exports = { init, isConnected, connect, disconnect, play, pause, resetContext, toUri, listDevices, pickDevice, REDIRECT };
