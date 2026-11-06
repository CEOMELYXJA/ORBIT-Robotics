@echo off
cd /d "%~dp0"
title ORBIT Robotics v0.1
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv
  if errorlevel 1 (
    echo.
    echo Python 3.11 est requis. Installez Python 3.11, puis relancez ce fichier.
    pause
    exit /b 1
  )
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Installation des bibliotheques impossible. Verifiez votre connexion Internet.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" orbit.py
if errorlevel 1 pause

