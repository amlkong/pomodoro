# Pomo 🦦

A cute pomodoro timer for Mac and Windows. Pomo, a tiny samurai otter, keeps you company: wandering around, practicing sword moves and bowing when you're idle, meditating quietly while you focus, and dancing when it's break time.

<p><img src="docs/timer.png" width="230" alt="The timer window with Pomo dancing inside it"> <img src="docs/pomo-moves.png" width="520" alt="Pomo's moves"></p>

## Install it

### The easy way: download the installer

Every change to this repo automatically builds fresh installers.

1. Open the [Actions tab](https://github.com/amlkong/pomodoro/actions) (you need to be signed in to GitHub).
2. Click the newest run with a green check.
3. Under **Artifacts**, download **Pomo-mac** or **Pomo-windows** and unzip it.

**Mac:** open the `.dmg` (`arm64` for Apple Silicon M1/M2/M3/M4, `x64` for older Intel Macs) and drag Pomo into Applications. The first time, right-click Pomo and choose **Open**. If macOS still says no, go to System Settings → Privacy & Security and click **Open Anyway**. You only do this once.

**Windows:** run the `.exe`. If a blue "Windows protected your PC" box appears, click **More info** → **Run anyway**.

Those one-time prompts show up because the app isn't signed with a paid Apple or Microsoft developer certificate. That's normal for personal apps.

### Or run it from the code

You need [Node.js](https://nodejs.org) (18 or newer). Same steps on Mac and Windows:

```bash
git clone https://github.com/amlkong/pomodoro.git
cd pomodoro
npm install
npm start
```

`npm run dist` builds an installer for the computer you're on, into `dist/`.

## What it does

- Focus / short break / long break timer, with a long break every 4 rounds (all adjustable in ⚙)
- Desktop notification when a round ends
- Space bar starts and pauses
- Music that follows the timer: on while you focus, off on breaks (or keep it on, your call)

### Pomo

The 🦦 button at the top of the timer chooses where he lives. Click it to cycle:

- **whole screen**: he walks along the bottom of your screen, on top of your other windows. Your clicks pass straight through to whatever is underneath.
- **in window**: he stays inside the timer window on his own little floor.
- **hidden**: he takes a nap offscreen.

Click him for a little hello. You can also pick him up with the mouse, carry him anywhere, and drop him.

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
src/pet/           Pomo's behaviour (shared by the screen overlay and the timer window)
build/             app icon and installer helpers
```
