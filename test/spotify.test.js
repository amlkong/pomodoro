const test = require('node:test');
const assert = require('node:assert');

// A stand-in for Spotify's servers. `player` describes what is "really" going on.
function fakeSpotify(player) {
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null;
    calls.push(`${init.method || 'GET'} ${u.pathname.replace('/v1', '')}${u.search}${body && body.context_uri ? ' +playlist' : ''}`);
    const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
    if (u.host === 'accounts.spotify.com') return reply(200, { access_token: 'token', expires_in: 3600 });
    if (u.pathname.endsWith('/me/player/devices')) return reply(200, { devices: player.devices });
    const active = player.devices.find((d) => d.is_active);
    const targeted = u.searchParams.get('device_id') || (body && body.device_ids && body.device_ids[0]);
    if (u.pathname.endsWith('/me/player/pause')) {
      if (!active) return reply(404, { error: { status: 404, reason: 'NO_ACTIVE_DEVICE' } });
      player.playing = false;
      return reply(204);
    }
    // play, or transfer playback
    if (player.premium === false) return reply(403, { error: { status: 403, reason: 'PREMIUM_REQUIRED' } });
    const device = targeted ? player.devices.find((d) => d.id === targeted) : active;
    if (!device) return reply(404, { error: { status: 404, reason: 'NO_ACTIVE_DEVICE' } });
    if (!body || (!body.context_uri && !player.hasQueue && !body.device_ids)) {
      if (!player.hasQueue) return reply(404, { error: { status: 404, reason: 'NO_ACTIVE_DEVICE' } });
    }
    player.devices.forEach((d) => { d.is_active = d === device; });
    player.playing = true;
    if (body && body.context_uri) { player.context = body.context_uri; player.hasQueue = true; }
    return reply(204);
  };
  return calls;
}

function freshSpotify() {
  delete require.cache[require.resolve('../src/spotify')];
  const spotify = require('../src/spotify');
  spotify.init({ clientId: 'id', refreshToken: 'refresh' });
  return spotify;
}

const PLAYLIST = 'https://open.spotify.com/playlist/abc123';
const computer = (extra = {}) => ({ id: 'pc', type: 'Computer', is_active: false, is_restricted: false, ...extra });
const fast = { pollMs: 5, waitMs: 400 };

test('Spotify already playing on this computer: one simple play call', async () => {
  const player = { devices: [computer({ is_active: true })], hasQueue: true };
  const calls = fakeSpotify(player);
  await freshSpotify().play('', fast);
  assert.ok(player.playing);
  assert.deepStrictEqual(calls.filter((c) => c.includes('/me/player')), ['PUT /me/player/play']);
});

test('Spotify is open but idle: Pomo wakes it up, no need to press play there first', async () => {
  const player = { devices: [computer()], hasQueue: true };
  fakeSpotify(player);
  await freshSpotify().play('', fast);
  assert.ok(player.playing);
  assert.ok(player.devices[0].is_active);
});

test('Spotify is closed: Pomo opens it, waits for it, then plays the playlist', async () => {
  const player = { devices: [] };
  fakeSpotify(player);
  let opened = 0;
  const statuses = [];
  await freshSpotify().play(PLAYLIST, {
    ...fast,
    openApp: async () => { opened++; setTimeout(() => player.devices.push(computer()), 20); },
    onStatus: (s) => statuses.push(s),
  });
  assert.strictEqual(opened, 1);
  assert.ok(player.playing);
  assert.strictEqual(player.context, 'spotify:playlist:abc123');
  assert.deepStrictEqual(statuses, ['Opening Spotify…', 'Starting your music…']);
});

test('Spotify is closed and never appears: a clear message instead of hanging', async () => {
  fakeSpotify({ devices: [] });
  await assert.rejects(
    freshSpotify().play(PLAYLIST, { ...fast, openApp: async () => {} }),
    /Couldn't find Spotify/,
  );
});

test('a freshly opened Spotify with nothing queued and no playlist explains what to do', async () => {
  const player = { devices: [], hasQueue: false };
  fakeSpotify(player);
  await assert.rejects(
    freshSpotify().play('', { ...fast, openApp: async () => { player.devices.push(computer()); } }),
    /Paste a playlist link/,
  );
});

test('the playlist is only started once, later plays just resume', async () => {
  const player = { devices: [computer({ is_active: true })], hasQueue: true };
  const calls = fakeSpotify(player);
  const spotify = freshSpotify();
  await spotify.play(PLAYLIST, fast);
  await spotify.pause();
  await spotify.play(PLAYLIST, fast);
  const plays = calls.filter((c) => c.startsWith('PUT /me/player/play'));
  assert.deepStrictEqual(plays, ['PUT /me/player/play +playlist', 'PUT /me/player/play']);
});

test('pausing when nothing is playing is not an error', async () => {
  fakeSpotify({ devices: [] });
  await freshSpotify().pause();
});

test('a free account gets a plain explanation', async () => {
  fakeSpotify({ devices: [computer({ is_active: true })], hasQueue: true, premium: false });
  await assert.rejects(freshSpotify().play('', fast), /Premium/);
});

test('an active phone is used rather than waking the computer', async () => {
  const spotify = freshSpotify();
  const phone = { id: 'phone', type: 'Smartphone', is_active: true };
  assert.strictEqual(spotify.pickDevice([computer(), phone]).id, 'phone');
  assert.strictEqual(spotify.pickDevice([{ id: 'tv', type: 'TV' }, computer()]).id, 'pc');
  assert.strictEqual(spotify.pickDevice([]), null);
});

test('playlist links are understood in their common forms', () => {
  const { toUri } = freshSpotify();
  assert.strictEqual(toUri('https://open.spotify.com/playlist/abc123?si=xyz'), 'spotify:playlist:abc123');
  assert.strictEqual(toUri('https://open.spotify.com/intl-de/album/Zz9'), 'spotify:album:Zz9');
  assert.strictEqual(toUri('spotify:playlist:abc123'), 'spotify:playlist:abc123');
  assert.strictEqual(toUri('not a link'), '');
});
