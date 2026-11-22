@echo off
rem Double-click me: gets the latest version of Pomo, then opens it.
setlocal
title Pomo
cd /d "%~dp0"

if not exist package.json goto nofolder
where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist .git goto ready
where git >nul 2>nul
if errorlevel 1 goto ready
echo Checking for updates...
git pull --ff-only
if errorlevel 1 echo Could not check for updates, so opening the version you already have.

:ready
echo Getting things ready. The very first time this takes a minute or two.
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto failed

if defined POMO_NO_START goto done
echo Opening Pomo. Keep this window open - closing it closes Pomo too.
call npm start
if errorlevel 1 goto failed

:done
exit /b 0

:nofolder
echo This file only works from inside the whole pomodoro folder.
echo Download or clone the full project, then run it from there.
goto stop

:nonode
echo Pomo needs Node.js, and it is not installed yet.
echo Get the LTS version from https://nodejs.org, install it, then try again.
goto stop

:failed
echo.
echo Something went wrong. The messages above say what happened.

:stop
echo.
pause
exit /b 1
