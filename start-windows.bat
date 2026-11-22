@echo off
rem Double-click me: gets the latest version of Pomo, then opens it.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Pomo needs Node.js. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

echo Checking for updates...
git pull --ff-only
if errorlevel 1 echo Could not check for updates, so opening the version you already have.

echo Getting things ready...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo Setup failed.
  pause
  exit /b 1
)

echo Opening Pomo. Closing this window closes Pomo too.
call npm start
