"""Lance l'interface spatiale locale dans un profil de navigateur séparé."""
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent


def find_edge(environ=os.environ):
    for key in ('PROGRAMFILES(X86)', 'PROGRAMFILES', 'LOCALAPPDATA'):
        root = environ.get(key)
        if root:
            path = Path(root) / 'Microsoft' / 'Edge' / 'Application' / 'msedge.exe'
            if path.is_file():
                return path
    return None


def spatial_command(edge, root=ROOT):
    index = root / 'spatial' / 'index.html'
    if not index.is_file():
        raise FileNotFoundError('Les fichiers de l’espace spatial sont absents.')
    return [str(edge), '--user-data-dir=' + str(root / '.orbit-spatial-profile'),
            '--no-first-run', '--no-default-browser-check', '--new-window',
            '--app=' + index.resolve().as_uri(), '--start-maximized']


def launch_spatial():
    edge = find_edge()
    if edge is None:
        raise FileNotFoundError('Microsoft Edge est introuvable.')
    return subprocess.Popen(spatial_command(edge), cwd=str(ROOT),
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

