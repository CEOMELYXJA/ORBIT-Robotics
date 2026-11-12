"""Commandes Windows prédéfinies pour une future intégration, désactivées par défaut.

Ce module n'ouvre aucun fichier, n'accepte aucun chemin arbitraire et ne démarre
aucun service. L'interface qui recueillera le clic explicite reste à intégrer.
"""
from dataclasses import dataclass
import os
from pathlib import PureWindowsPath
import subprocess
from typing import Callable


APPLICATIONS = {
    'calculatrice': ('Calculatrice Windows', 'calc.exe'),
    'bloc_notes': ('Bloc-notes Windows', 'notepad.exe'),
    'paint': ('Paint Windows', 'mspaint.exe'),
}


@dataclass(frozen=True)
class Result:
    ok: bool
    message: str


class ApplicationLauncher:
    """Allow only explicit, fixed commands; never start anything on construction."""

    def __init__(self, *, enabled=False, windows_directory=r'C:\Windows', runner: Callable = subprocess.Popen):
        self.enabled = enabled
        self.windows_directory = PureWindowsPath(windows_directory)
        self.runner = runner
        if self.windows_directory != PureWindowsPath(r'C:\Windows'):
            raise ValueError('Seul le dossier Windows standard sur C: est pris en charge.')

    def list_applications(self):
        return tuple((key, value[0]) for key, value in APPLICATIONS.items())

    def open(self, application_id, *, user_requested=False):
        if not isinstance(application_id, str) or application_id not in APPLICATIONS:
            return Result(False, 'Application non reconnue.')
        if not self.enabled:
            return Result(False, 'Le lancement est désactivé dans cette version.')
        if user_requested is not True:
            return Result(False, 'Un clic explicite est nécessaire.')
        if os.name != 'nt':
            return Result(False, 'Cette action nécessite Windows.')
        label, executable = APPLICATIONS[application_id]
        path = self.windows_directory / 'System32' / executable
        try:
            self.runner([str(path)], shell=False, close_fds=True)
        except (OSError, ValueError):
            return Result(False, f'Impossible d’ouvrir {label}.')
        return Result(True, f'Demande d’ouverture envoyée : {label}.')
