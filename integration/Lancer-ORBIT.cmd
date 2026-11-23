@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "ORBIT_PY=%~dp0.venv\Scripts\python.exe"
if not exist "%ORBIT_PY%" set "ORBIT_PY=%USERPROFILE%\Desktop\ORBIT_Robotics_v0.1\.venv311\Scripts\python.exe"
set "ORBIT_VIEW="
if /i "%~1"=="--terre" set "ORBIT_VIEW=--terre"
if /i "%~1"=="--mains" set "ORBIT_VIEW=--mains"
if exist "%ORBIT_PY%" (
  for %%I in ("%ORBIT_PY%") do set "ORBIT_PYW=%%~dpIpythonw.exe"
) else (
  set "ORBIT_PYW="
)
if exist "%ORBIT_PYW%" (
  start "" "%ORBIT_PYW%" "%~dp0centre_orbit.py" %ORBIT_VIEW%
) else (
  py -3.11 "%~dp0centre_orbit.py" %ORBIT_VIEW%
)
set "ORBIT_RESULT=%errorlevel%"
if not "%ORBIT_RESULT%"=="0" (
  echo Verifie Python 3.11 ou lance Installer-ORBIT.cmd depuis ce dossier.
  pause
)
exit /b %ORBIT_RESULT%

