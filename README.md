# Pomo 🦦🐱

A cute pomodoro timer for Windows and Mac. A little animated buddy keeps you company while you work: wandering around when you're idle, settling down quietly while you focus, and dancing when it's break time. It also has a to-do list and can play and pause your Spotify for you.

<p><img src="docs/timer.png" width="220" alt="The timer window with Daphne the cat living inside it"> <img src="docs/character-menu.png" width="220" alt="The character menu"></p>
<p><img src="docs/pomo-moves.png" width="640" alt="Pomo the otter's moves"></p>
<p><img src="docs/daphne-moves.png" width="640" alt="Daphne the cat's moves"></p>
<p><img src="docs/maple-moves.png" width="640" alt="Maple the red panda's moves"></p>
<p><img src="docs/ash-moves.png" width="640" alt="Ash the wolf pup's moves"></p>
<p><img src="docs/aki-moves.png" width="640" alt="Aki the bunny's moves"></p>

## Contents

- [Install on Windows](#install-on-windows)
- [Install on Mac](#install-on-mac)
- [Getting a newer version](#getting-a-newer-version)
- [Using Pomo](#using-pomo)
- [Set up Spotify](#set-up-spotify-optional)
- [Always-latest mode](#always-latest-mode-optional)
- [If something isn't working](#if-something-isnt-working)
- [For tinkering](#for-tinkering)

## Install on Windows

1. Open the **[latest release](https://github.com/amlkong/pomodoro/releases/latest)**.
2. Under **Assets**, click `Pomo-Setup-x.x.x.exe` to download it.
3. Double-click the downloaded file.
4. If a blue "Windows protected your PC" box appears, click **More info**, then **Run anyway**. It shows up because the app isn't signed with a paid Microsoft certificate, which is normal for personal apps.

That's it. Pomo opens by itself, and from now on you start it from the **Pomo icon on your desktop** or from the Start menu. You only do this once: after that, Pomo keeps itself up to date.

## Install on Mac

1. Open the **[latest release](https://github.com/amlkong/pomodoro/releases/latest)**.
2. Under **Assets**, download the `.dmg`: `arm64` for Apple Silicon (M1/M2/M3/M4), `x64` for older Intel Macs. Apple menu → About This Mac tells you which you have.
3. Open the `.dmg` and drag Pomo into Applications.
4. In Applications, right-click Pomo and choose **Open**, then **Open** again.
5. If it still won't open: System Settings → Privacy & Security → scroll down → **Open Anyway**.

## Getting a newer version

Every change to this repo automatically publishes a new release.

**Windows: nothing to do.** Just open Pomo from its desktop icon. Each time it opens, it checks for a newer version. If there is one, a pill at the top says **✨ Getting version x.x.x…**, and a few seconds later Pomo restarts itself into the new version. So double-clicking the icon always lands you on the latest one.

If an update arrives while you're in the middle of a round, Pomo doesn't interrupt you. The pill changes to **✨ Version x.x.x is ready · restart**. Click it when you like, or ignore it and the new version is there next time you open Pomo.

**Mac:** the pill says **✨ Version x.x.x is out · download** and takes you to the download page. Install the new `.dmg` the same way as the first time. (Apple only allows silent updates for apps signed with a paid developer certificate.)

Either way, your settings, to-do list and Spotify connection are kept.

## Using Pomo

### The timer

- **Start / Pause / Resume**: the big button, or press the space bar.
- **↺** resets the current round. **⏭** skips to the next one.
- **Focus / Short break / Long break** tabs jump straight to that kind of round.
- The dots show how many focus rounds you've done toward the next long break.
- When a round ends, a soft chime plays and a desktop notification pops up. You can turn the chime off in ⚙ (**Alarm sound when a round ends**).
- **□** at the top right makes the window fill the screen, with everything bigger. Click it again to go back to the small window.
- **⚙** opens settings: how long each round is, how many rounds before a long break, whether the next round starts by itself, and Spotify.

### The to-do list

- Type a task under the timer and press **Enter**.
- Tick the box when it's done. Your buddy celebrates.
- Hover a task and click **×** to remove it, or **clear done** to sweep away the finished ones.
- The list is saved, so it's still there next time you open the app.

### Your buddy

Two buttons at the top of the window control the character:

- **The round arrows button opens the character menu.** Pick whoever you like:
  - 🦦 **Pomo**, a samurai otter. Practices sword moves, bows, and meditates while you focus.
  - 🐱 **Daphne**, a happy tabby cat. Bats at things, washes a paw, stretches, and naps in a loaf while you focus.
  - 🍁 **Maple**, a red panda. Does the famous arms-up "I'm very scary" pose, wiggles, and curls up asleep while you focus.
  - 🐺 **Ash**, a fluffy grey wolf pup. Throws his head back and howls, wiggles down and pounces, and curls up asleep while you focus.
  - 🐰 **Aki**, a lop-eared bunny. Stands up on his back legs for a look around, munches a leafy treat, does binkies, and loafs asleep while you focus.
- **The pill next to it chooses where they live.** Click to cycle:
  - **on screen**: walks along the bottom of your screen, on top of your other windows. Your clicks pass straight through to whatever is underneath.
  - **in window**: stays inside the timer window on a little floor.
  - **hidden**: goes away until you click again.

During a focus round your buddy settles down quietly, then every five minutes or so gets up, wanders to a new spot, and settles again.

Click your buddy for a little hello. You can also pick them up with the mouse, carry them anywhere, and drop them.

**Changing their size:** hover over your buddy and a small round handle appears at the top corner. Drag it up to make them bigger, down to make them smaller. There's also a **Character size** slider in ⚙. The size is remembered.

## Set up Spotify (optional)

Pomo works like a remote control for the Spotify app you already have open: it presses play when you start focusing and pause on breaks. You need **Spotify Premium** (Spotify only allows remote control on Premium) and this one-time setup, about five minutes:

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in with your normal Spotify account.
2. Click **Create app**. Any name and description are fine, for example "Pomo".
3. In **Redirect URIs**, paste this exactly and click **Add**:
   ```
   http://127.0.0.1:8888/callback
   ```
4. If it asks which API you're planning to use, tick **Web API**. Save.
5. Open your new app's **Settings** and copy the **Client ID**.
6. In Pomo, click **⚙** and paste the Client ID into the Spotify box.
7. Optional: paste a link to a focus playlist in the box below it (in Spotify: Share → Copy link to playlist). Pomo starts that playlist on your first focus round. Searching Spotify for "deep focus" or "binaural beats focus" turns up good ones.
8. Click **Connect Spotify**, then log in and click **Agree** on the page that opens in your browser.

Day to day: keep the Spotify app open on your computer or phone. Start a focus round and the music plays; breaks pause it. If you'd like music during breaks too, turn on **Keep music on during breaks** in ⚙.

## Always-latest mode (optional)

On Windows the installed app already updates itself, so most people can skip this. It's here for Mac, or for running straight from the code. You keep a copy of the code on your computer and open Pomo with a launcher that fetches the newest version every time it starts.

### One-time setup (Windows)

1. Install [Node.js](https://nodejs.org) (the **LTS** version). Click through the installer with the default options.
2. Install [Git for Windows](https://git-scm.com/downloads/win), also with the default options.
3. Open **Command Prompt** (press the Windows key, type `cmd`, press Enter) and run:
   ```
   git clone https://github.com/amlkong/pomodoro.git
   ```
   This creates a `pomodoro` folder inside your user folder (`C:\Users\<you>\pomodoro`).
4. Open that folder and double-click **`make-desktop-shortcut.bat`**. It puts a **Pomo (latest)** icon on your desktop.

From then on, double-click **Pomo (latest)** on your desktop. A small helper window opens minimized in the taskbar, checks for updates, and starts Pomo. The very first start takes a minute or two.

### One-time setup (Mac)

1. Install [Node.js](https://nodejs.org) (the **LTS** version).
2. Open **Terminal** and run `git clone https://github.com/amlkong/pomodoro.git`.
3. From then on, double-click **`start-mac.command`** in the `pomodoro` folder. The first time, right-click it and choose **Open**.

Good to know: in this mode, a helper window stays open while Pomo runs. Closing it closes Pomo. The installed version doesn't have that, so it's the nicer one for everyday use.

## If something isn't working

**`start-windows.bat` opens and closes, or does nothing.** It now stays open and tells you what's wrong. The usual causes:
- *"Pomo needs Node.js"*: install Node.js from [nodejs.org](https://nodejs.org), then try again.
- *"This file only works from inside the whole pomodoro folder"*: the file was downloaded by itself. You need the whole project (step 3 of always-latest mode).
- *"Could not check for updates"*: you're offline, or Git isn't installed. Pomo still opens with the version you have.

**Windows says "Windows protected your PC".** Click **More info** → **Run anyway**.

**Mac says the app can't be opened.** Right-click → **Open**, or System Settings → Privacy & Security → **Open Anyway**.

**Spotify says "Open Spotify and play something once".** Spotify needs an active device. Play any song for a second in the Spotify app, then start your focus round again.

**Spotify connect fails with a redirect error.** The Redirect URI in the Spotify dashboard has to match exactly: `http://127.0.0.1:8888/callback`

**The character isn't showing.** Click the pill at the top of the window until it says **on screen** or **in window**.

**Pomo isn't updating itself on Windows.** Look at the small version number next to "pomo" at the top left. Versions before 0.1.8 don't have the updater, so install the newest `Pomo-Setup` once by hand and it takes care of itself from then on. On newer versions, open ⚙ and click **Check for updates**: the line underneath says exactly what's happening, including any error. Updates only work in the installed app, not when running from the code.

## For tinkering

Run it from the code:

```bash
npm install
npm start
```

Build an installer for the computer you're on (lands in `dist/`):

```bash
npm run dist
```

### Adding a character

Each character is two files in `src/characters/`:

- `name.js`: the drawing (an SVG), its name and emoji, what it says, and its extra moves
- `name.css`: the animations for each pose

Every character needs these poses: `walking`, `dancing`, `sitting` (focus time), `jumping` (celebrating) and `held` (picked up). On top of that it can have its own extras, listed in `idleActions` and `breakActions`, like the otter's `slashing` or the cat's `licking`.

To add one, copy `cat.js` and `cat.css`, change the drawing and animations, then add the two files to both `src/timer/index.html` and `src/pet/pet.html` next to the existing ones. It shows up in the character menu automatically.

### Project layout

```
src/main.js          timer logic, windows, to-do storage, music control
src/spotify.js       Spotify login and play/pause
src/characters/      one .js and one .css per character
src/pet/             how a character behaves (shared by the screen overlay and the timer window)
src/timer/           the timer window
build/               app icon and installer helpers
start-windows.bat    always-latest launcher for Windows
start-mac.command    always-latest launcher for Mac
```
