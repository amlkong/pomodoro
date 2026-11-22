@echo off
rem Double-click me once: puts a "Pomo (latest)" icon on your desktop.
rem That icon runs start-windows.bat, so Pomo always opens on the newest version.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build\make-shortcut.ps1"
set RESULT=%errorlevel%
echo.
pause
exit /b %RESULT%
