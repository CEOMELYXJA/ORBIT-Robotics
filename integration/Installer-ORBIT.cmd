@echo off
chcp 65001 >nul
set "ORBIT_DIR=%~dp0"
set "ORBIT_BASE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not exist "%ORBIT_BASE%" (
  echo Python 3.11 introuvable dans son emplacement habituel.
  pause
  exit /b 1
)
if not exist "%ORBIT_DIR%.venv\Scripts\python.exe" "%ORBIT_BASE%" -m venv "%ORBIT_DIR%.venv"
if errorlevel 1 goto error
"%ORBIT_DIR%.venv\Scripts\python.exe" -m pip install "mediapipe==0.10.21" "opencv-contrib-python==4.11.0.86" "numpy<2" "pyautogui==0.9.54"
if errorlevel 1 goto error
echo Installation terminée. Lancez Lancer-ORBIT.cmd.
pause
exit /b 0
:error
echo Installation impossible ; voir le message ci-dessus.
pause
exit /b 1

