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

async function api(method, path, body) {
  if (!isConnected()) throw new Error('Not connected to Spotify');
  if (!accessToken || Date.now() > expiresAt) {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  const reason = data.error && data.error.reason;
  if (res.status === 404 || reason === 'NO_ACTIVE_DEVICE') throw new Error('Open Spotify and play something once so Pomo can find it');
  if (reason === 'PREMIUM_REQUIRED') throw new Error('Spotify only allows remote control on Premium accounts');
  // 403 with no reason usually means "already playing" or "already paused", which is fine.
  if (res.status === 403) return;
  throw new Error((data.error && data.error.message) || `Spotify error ${res.status}`);
}

// Turns a pasted playlist or album link into a spotify: URI.
function toUri(link) {
  if (!link) return '';
  const s = link.trim();
  if (/^spotify:(playlist|album):[A-Za-z0-9]+$/.test(s)) return s;
  const m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album)\/([A-Za-z0-9]+)/);
  return m ? `spotify:${m[1]}:${m[2]}` : '';
}

async function play(playlistLink) {
  const uri = toUri(playlistLink);
  // Only start the playlist the first time. After that just resume where it left off.
  if (uri && !contextSent) {
    await api('PUT', '/me/player/play', { context_uri: uri });
    contextSent = true;
  } else {
    await api('PUT', '/me/player/play');
  }
}

const pause = () => api('PUT', '/me/player/pause');
const resetContext = () => { contextSent = false; };

module.exports = { init, isConnected, connect, disconnect, play, pause, resetContext, toUri, REDIRECT };
