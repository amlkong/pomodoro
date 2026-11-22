# Creates the "Pomo (latest)" desktop shortcut. Run through make-desktop-shortcut.bat.
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE 'Desktop' }
if (-not (Test-Path $desktop)) { New-Item -ItemType Directory -Path $desktop | Out-Null }

$path = Join-Path $desktop 'Pomo (latest).lnk'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
$shortcut.TargetPath = Join-Path $root 'start-windows.bat'
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = Join-Path $root 'build\icon.ico'
$shortcut.WindowStyle = 7   # start the helper window minimized
$shortcut.Description = 'Pomo, always the latest version'
$shortcut.Save()

if (Test-Path $path) {
  Write-Host "Done! Look for 'Pomo (latest)' on your desktop."
  exit 0
}
Write-Host 'Could not create the shortcut.'
exit 1
