@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "ORBIT_PY=%~dp0.venv\Scripts\python.exe"
if not exist "%ORBIT_PY%" set "ORBIT_PY=%USERPROFILE%\Desktop\ORBIT_Robotics_v0.1\.venv311\Scripts\python.exe"
if not exist "%ORBIT_PY%" (
  echo Environnement Python introuvable. Lancez Installer-ORBIT.cmd.
  pause
  exit /b 1
)
"%ORBIT_PY%" centre_orbit.py
if errorlevel 1 pause

