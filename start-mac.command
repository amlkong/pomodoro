#!/bin/bash
# Double-click me: gets the latest version of Pomo, then opens it.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Pomo needs Node.js. Install it from https://nodejs.org and try again."
  read -r -p "Press Enter to close."
  exit 1
fi

echo "Checking for updates..."
git pull --ff-only || echo "Couldn't check for updates, so opening the version you already have."

echo "Getting things ready..."
npm install --no-audit --no-fund --loglevel=error || { read -r -p "Setup failed. Press Enter to close."; exit 1; }

echo "Opening Pomo. Closing this window closes Pomo too."
npm start
