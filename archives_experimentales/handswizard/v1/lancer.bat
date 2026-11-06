@echo off
cd /d "%~dp0"
if not exist .venv (
  echo Premiere installation, ca peut prendre quelques minutes...
  py -3 -m venv .venv
)
call .venv\Scripts\activate
pip install -q -r requirements.txt
python handtracking_souris.py
pause

