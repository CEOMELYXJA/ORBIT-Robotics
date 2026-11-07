"""Diagnostic local ORBIT : ne sauvegarde aucune image ni donnée caméra.

Lancer avec Python 3.11 : python diagnostic.py [--camera]. Le contrôle du
curseur et l'inférence sur une main réelle ne sont jamais activés ici.
"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run_command(args, timeout=45, cwd=ROOT):
    try:
        result = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                                encoding='utf-8', errors='replace', timeout=timeout)
        return {'code': result.returncode, 'sortie': (result.stdout + result.stderr)[-12000:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {'code': None, 'sortie': f'{type(exc).__name__}: {exc}'}


def version(package):
    try:
        return importlib.metadata.version(package)
    except importlib.metadata.PackageNotFoundError:
        return None


def camera_check():
    # Processus séparé borné : un pilote peut bloquer à l'ouverture ou lecture.
    # Le signal non noir ne prouve ni un flux en direct ni la présence d'une main.
    code = r'''import cv2, json
result = []
for name, backend in [('MSMF', cv2.CAP_MSMF), ('DSHOW', cv2.CAP_DSHOW)]:
    cap = cv2.VideoCapture(0, backend)
    ok, frame = cap.read() if cap.isOpened() else (False, None)
    result.append({'methode': name, 'image_lue': bool(ok), 'luminosite_moyenne': round(float(frame.mean()), 2) if ok else None})
    cap.release()
print(json.dumps(result))'''
    return run_command([sys.executable, '-c', code], timeout=25)


def main():
    parser = argparse.ArgumentParser(description='Diagnostic local sans transmission de données.')
    parser.add_argument('--camera', action='store_true', help='essayer la caméra 0, sans enregistrer d’image')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'rapports')
    args = parser.parse_args()
    tests_dir = ROOT / 'tests'
    tests = (run_command([sys.executable, '-m', 'unittest', 'discover', '-s', str(tests_dir), '-v'], timeout=120)
             if tests_dir.is_dir() and any(tests_dir.glob('test*.py'))
             else {'code': None, 'sortie': 'Aucun test découvert : non exécuté.'})
    gpu = run_command(['nvidia-smi', '--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'], timeout=15)
    packages = {p: version(p) for p in ('mediapipe', 'opencv-python', 'opencv-contrib-python', 'numpy', 'PyAutoGUI')}
    report = {
        'date_locale': datetime.now().astimezone().isoformat(),
        'python': {'version': platform.python_version(), 'architecture': platform.architecture()[0], 'executable': sys.executable},
        'windows': platform.platform(), 'dependances': packages,
        'gpu_nvidia': gpu,
        'tests_automatises': tests,
        'camera': camera_check() if args.camera else {'code': None, 'sortie': 'Non exécuté : préciser --camera.'},
        'non_executes': [
            'Reconnaissance réelle des mains et précision des gestes.',
            'Déplacement réel du curseur hors application.',
            'Arrêt d’urgence physique et relâchement effectif sous Windows.',
            'Validation vidéo, CSV et JSONL avec démonstration réelle.',
            'Accélération GPU MediaPipe : la présence NVIDIA ne prouve pas son utilisation.',
        ],
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = args.output_dir / ('diagnostic_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.json')
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Rapport local :', target)
    state = ('réussis' if tests['code'] == 0 else
             'incomplets' if tests['code'] is None and tests['sortie'].startswith('TimeoutExpired:') else
             'non exécutés' if tests['code'] is None else 'échecs')
    print('Tests :', state)
    print('Caméra réelle et curseur : voir les limites du rapport.')
    if tests['code'] is None:
        return 2  # Incomplet, distinct d'une suite réussie.
    return 0 if tests['code'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())


