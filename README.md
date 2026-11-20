# Pomo 🍅

A cute pomodoro timer for your desktop. A little tomato named Pomo lives at the bottom of your screen: wandering around when you're idle, sitting quietly with headphones while you focus, and dancing when it's break time.

<p><img src="docs/timer.png" width="240" alt="The timer window"> <img src="docs/pomo-dancing.png" width="300" alt="Pomo dancing"></p>

## Run it

You need [Node.js](https://nodejs.org) (18 or newer).

```bash
git clone https://github.com/amlkong/pomodoro.git
cd pomodoro
npm install
npm start
```

To build a real installable app for your computer: `npm run dist` (it lands in `dist/`).

## What it does

- Focus / short break / long break timer, with a long break every 4 rounds (all adjustable in ⚙)
- Pomo walks along the bottom of your screen on top of your other windows. Clicks pass through to whatever is underneath. Click Pomo for a little hello.
- Desktop notification when a round ends
- Space bar starts and pauses
- Music that follows the timer: on while you focus, off on breaks (or keep it on, your call)

## Music

### brain.fm

Click **🧠 brain.fm**. It opens brain.fm in its own window. Log in once (it remembers you), pick your focus music and press play. From then on Pomo mutes it during breaks and brings it back when you focus. Closing that window only hides it, so the music keeps going.

If "Continue with Google" doesn't work in that window, use your email and password instead. Google sometimes blocks logins inside apps.

### Spotify

Pomo works like a remote control for the Spotify app you already have open. This needs Spotify Premium (Spotify's rule for remote control) and a one time setup:

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app. Any name is fine.
2. Add this Redirect URI exactly: `http://127.0.0.1:8888/callback`
3. Copy the **Client ID**.
4. In Pomo: ⚙ → paste the Client ID → optionally paste a playlist link → **Connect Spotify**.
5. Log in on the page that opens.

After that, starting a focus round presses play and breaks press pause. Have Spotify open on your computer or phone so there's something to control.

## Project layout

```
src/main.js        timer logic, windows, music control
src/spotify.js     Spotify login and play/pause
src/pomo.js/.css   Pomo's drawing and animations
src/timer/         the timer window
src/pet/           the on-screen Pomo
```
