"""Échange de commandes locales avec le cadre WebView2 propre à ORBIT."""
import os
from pathlib import Path
import queue
import subprocess
import threading

ROOT = Path(__file__).resolve().parent
HELPER = ROOT / '.venv' / 'orbit-webview' / 'OrbitSpatialHost.exe'


class SpatialWebView:
    def __init__(self, parent):
        self.parent = parent
        self.process = None
        self.hwnd = None
        self.profile = Path(os.environ.get('LOCALAPPDATA', ROOT)) / 'ORBIT Robotics' / 'WinmapWebView'
        self._status = 'idle'
        self.error = ''
        self._messages = queue.SimpleQueue()

    @property
    def status(self):
        while True:
            try:
                message = self._messages.get_nowait()
            except queue.Empty:
                break
            if self._status == 'closed':
                continue
            if message.startswith('HWND ') and message[5:].isdigit():
                self.hwnd = int(message[5:])
            elif message == 'READY':
                self._status = 'ready'
            elif message == 'ERROR':
                self._failed()
        if self.process and self.process.poll() is not None and self._status in ('loading', 'ready'):
            self._failed()
        return self._status

    def _failed(self):
        self._status = 'error'
        self.error = 'La vue spatiale s’est arrêtée. Vérifie le runtime Microsoft Edge WebView2, puis réessaie.'

    def open(self, *, earth=False):
        if self.status in ('loading', 'ready'):
            if earth:
                self._send('earth')
            return
        if not HELPER.is_file():
            raise OSError('Le module spatial doit être installé avec Installer-ORBIT.cmd.')
        if not (ROOT / 'spatial/index.html').is_file():
            raise OSError('Les fichiers de la scène locale sont absents.')
        self.parent.update_idletasks()
        self._messages = queue.SimpleQueue()
        self.error = ''
        self.hwnd = None
        self.process = subprocess.Popen(
            [str(HELPER), str(self.parent.winfo_id()), str(ROOT / 'spatial'),
             str(self.profile), 'earth' if earth else 'home'],
            cwd=HELPER.parent, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding='ascii', errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW)
        self._status = 'loading'
        threading.Thread(target=self._read, args=(self.process.stdout, self._messages), daemon=True).start()

    @staticmethod
    def _read(stream, messages):
        with stream:
            for line in stream:
                messages.put(line.strip())

    def _send(self, command):
        stream = self.process.stdin if self.process else None
        if stream and not stream.closed:
            try:
                stream.write(command + '\n')
                stream.flush()
            except (OSError, ValueError):
                pass

    def resize(self, event=None):
        if self._status in ('loading', 'ready'):
            self._send('resize')

    def close(self):
        if self._status == 'closed':
            return
        self._send('close')
        if self.process and self.process.stdin:
            try:
                self.process.stdin.close()
            except OSError:
                pass
        self._status = 'closed'
        self.hwnd = None
