@echo off
setlocal
set "APP=%~dp0dist\win-x64-recovery\Winmap.DesktopHost.exe"
if not exist "%APP%" (
  echo The native application has not been built yet.
  echo Run Build-Winmap-Native.cmd first.
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Check-NativeLaunch.ps1" -ExecutablePath "%APP%"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
set "WINMAP_WEBVIEW2_USER_DATA=%~dp0dist\win-x64-recovery\.webview2-profile"
start "" "%APP%" --desktop

