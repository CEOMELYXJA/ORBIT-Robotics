@echo off
setlocal
set "APP_PATH=%~dp0index.html"
if not exist "%APP_PATH%" (
  echo Winmap ne trouve pas index.html. Garde ce lanceur a cote des fichiers du projet.
  pause
  exit /b 1
)
for %%I in ("%APP_PATH%") do set "APP_URL=file:///%%~fI"
set "APP_URL=%APP_URL:\=/%"
set "EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"
if defined EDGE set "EDGE_PROFILE=%~dp0.winmap-edge-profile"
if defined EDGE if not exist "%EDGE_PROFILE%" md "%EDGE_PROFILE%"
if defined EDGE (
  start "" "%EDGE%" --user-data-dir="%EDGE_PROFILE%" --no-first-run --new-window --app="%APP_URL%" --start-maximized
) else (
  start "" "%~dp0index.html"
)

