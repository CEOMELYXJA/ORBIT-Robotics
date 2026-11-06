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
echo ORBIT et HandsWizard - traitement local
echo 1. Démarrer : suivi, enregistrement et souris facultative
echo 2. Diagnostic et tests, sans caméra
echo 3. Diagnostic avec test de la caméra
echo Q. Quitter
choice /c 123Q /n /m "Choix : "
if errorlevel 4 exit /b
if errorlevel 3 goto camera
if errorlevel 2 goto diag
"%ORBIT_PY%" orbit_integrated.py
goto end
:camera
"%ORBIT_PY%" diagnostic.py --camera
goto end
:diag
"%ORBIT_PY%" diagnostic.py
:end
pause

