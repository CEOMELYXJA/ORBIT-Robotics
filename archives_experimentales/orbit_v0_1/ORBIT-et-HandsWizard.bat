@echo off
cd /d "%~dp0"
title ORBIT et HandsWizard
if not exist ".venv311\Scripts\python.exe" (
  echo Environnement Python introuvable. Consultez les instructions d'installation.
  pause
  exit /b 1
)
echo 1. ORBIT - suivi et enregistrement
echo 2. HandsWizard - souris webcam (demarre en pause)
echo Q. Quitter
choice /c 12Q /n /m "Choix : "
if errorlevel 3 exit /b
if errorlevel 2 goto mouse
".venv311\Scripts\python.exe" orbit.py
goto end
:mouse
".venv311\Scripts\python.exe" handswizard_webcam.py
:end
if errorlevel 1 pause

