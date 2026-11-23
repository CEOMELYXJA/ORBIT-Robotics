"""Choix nominatif de Camo par backend OpenCV, sans capturer d'image."""
import os
from pathlib import Path
import subprocess


class CamoDeviceError(RuntimeError):
    """Une source Camo unique ou son application n'est pas disponible."""


_CAMO_NAMES = {'camo', 'camo camera', 'camo studio', 'reincubate camo', 'reincubate camo camera'}


def _list_devices(backend):
    try:
        import cv2
        from cv2_enumerate_cameras import enumerate_cameras
    except (ImportError, OSError) as exc:
        raise CamoDeviceError('La détection de Camo est incomplète. Lance Installer-ORBIT.cmd.') from exc
    backend_id = {'msmf': cv2.CAP_MSMF, 'dshow': cv2.CAP_DSHOW}[backend]
    # CAP_ANY encode le backend dans l'index ; une API explicite donne son index local.
    return enumerate_cameras(backend_id)


def resolve_camo(preferred='msmf'):
    """Retourne (index local, backend) pour le périphérique nommé Camo."""
    if preferred not in ('msmf', 'dshow'):
        raise ValueError('Backend caméra inconnu.')
    if os.name != 'nt':
        raise CamoDeviceError('La caméra Camo de cet accueil nécessite Windows.')
    alternate = 'dshow' if preferred == 'msmf' else 'msmf'
    for backend in (preferred, alternate):
        try:
            devices = _list_devices(backend)
        except CamoDeviceError:
            raise
        except (OSError, RuntimeError):
            continue
        indices = [d.index for d in devices if d.name.strip().casefold() in _CAMO_NAMES]
        if len(indices) > 1:
            raise CamoDeviceError('Plusieurs caméras Camo sont présentes. Vérifie les périphériques Camo actifs.')
        if indices:
            return indices[0], backend
    raise CamoDeviceError('Caméra Camo introuvable. Ouvre Camo Studio et sélectionne ton iPad.')


_START_CAMO = r"""
$ErrorActionPreference = 'Stop'
$session = [Diagnostics.Process]::GetCurrentProcess().SessionId
if (Get-Process -Name CamoStudio -ErrorAction SilentlyContinue | Where-Object SessionId -eq $session) { exit 0 }
$entry = @(Get-StartApps -Name 'Camo Studio')
if ($entry.Count -ne 1) { exit 2 }
Start-Process -FilePath "$env:WINDIR\explorer.exe" -ArgumentList ("shell:AppsFolder\" + $entry[0].AppID)
exit 10
"""


def ensure_camo_studio():
    """False si déjà démarré dans la session, True si Windows a reçu la demande."""
    if os.name != 'nt':
        raise CamoDeviceError('Camo Studio nécessite Windows.')
    exe = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    try:
        result = subprocess.run(
            [str(exe), '-NoProfile', '-NonInteractive', '-Command', _START_CAMO],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=15, creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CamoDeviceError('Windows ne répond pas à la demande d’ouverture de Camo Studio.') from exc
    if result.returncode == 0:
        return False
    if result.returncode == 10:
        return True
    if result.returncode == 2:
        raise CamoDeviceError('Camo Studio est introuvable dans le menu Démarrer.')
    raise CamoDeviceError('Impossible d’ouvrir Camo Studio. Ouvre-le depuis le menu Démarrer.')
