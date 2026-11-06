@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Creation de l'environnement Python 3.11...
  py -3.11 -m venv .venv
  if errorlevel 1 (
    echo Python 3.11 x64 est requis. Installer depuis python.org.
    pause
    exit /b 1
  )
)
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Installation incomplete. Verifie Python 3.11 et internet.
  pause
  exit /b 1
)
echo.
echo [1] Souris iPhone (gyroscope) - serveur prive
echo [2] Webcam (mains libres) - detection des doigts
choice /C 12 /M "Mode"
if errorlevel 2 (
  python handtracking_souris.py
) else (
  python iphone_server.py
)
pause

