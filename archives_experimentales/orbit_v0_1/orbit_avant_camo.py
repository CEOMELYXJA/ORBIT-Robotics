import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import mediapipe as mp

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'enregistrements'


def main():
    camera = cv2.VideoCapture  # Keep the fallback available for different webcams.
    cap = camera(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap.release()
        cap = camera(0)
    if not cap.isOpened():
        print('Impossible d’ouvrir la webcam. Vérifiez les permissions Windows et fermez les autres applications utilisant la caméra.')
        return 1
    hands_api = mp.solutions.hands
    drawing = mp.solutions.drawing_utils
    session = None
    last_error = None

    def stop():
        nonlocal session
        if session:
            session['video'].release()
            session['csv_file'].close()
            session['json_file'].close()
            meta = session['meta']
            meta.update(fin=datetime.now().astimezone().isoformat(), images=session['frames'])
            (session['dir'] / 'metadata.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
            print('Enregistrement sauvegardé :', session['dir'])
            session = None

    try:
        with hands_api.Hands(max_num_hands=2, min_detection_confidence=0.5, min_tracking_confidence=0.5) as hands:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print('La webcam ne fournit plus d’image.')
                    break
                frame = cv2.flip(frame, 1)
                result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                detected = []
                for idx, hand in enumerate(result.multi_hand_landmarks or []):
                    handed = result.multi_handedness[idx].classification[0]
                    points = [{'id': i, 'x': p.x, 'y': p.y, 'z': p.z} for i, p in enumerate(hand.landmark)]
                    detected.append({'main': handed.label, 'confiance': handed.score, 'points': points})
                    drawing.draw_landmarks(frame, hand, hands_api.HAND_CONNECTIONS)
                if session:
                    elapsed = time.monotonic() - session['start']
                    record = {'image': session['frames'], 'temps_secondes': elapsed, 'mains': detected}
                    session['json_file'].write(json.dumps(record, ensure_ascii=False) + '\n')
                    for hand in detected:
                        for p in hand['points']:
                            session['csv'].writerow([session['frames'], elapsed, hand['main'], hand['confiance'], p['id'], p['x'], p['y'], p['z']])
                    session['video'].write(frame)
                    session['frames'] += 1
                status = 'ENREGISTREMENT' if session else 'PRET'
                cv2.putText(frame, f'ORBIT | {status} | R: enregistrer/arreter | Q: quitter', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 0, 255) if session else (0, 220, 0), 2)
                cv2.imshow('ORBIT Robotics v0.1', frame)
                key = cv2.waitKey(1) & 0xff
                if key in (ord('q'), ord('Q')):
                    break
                if key in (ord('r'), ord('R')):
                    if session:
                        stop()
                    else:
                        OUTPUT.mkdir(exist_ok=True)
                        folder = OUTPUT / datetime.now().strftime('%Y-%m-%d_%H-%M-%S-%f')
                        folder.mkdir()
                        height, width = frame.shape[:2]
                        fps = cap.get(cv2.CAP_PROP_FPS)
                        if not 1 <= fps <= 120:
                            fps = 30.0
                        video = cv2.VideoWriter(str(folder / 'video.mp4'), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
                        if not video.isOpened():
                            video.release()
                            print('Impossible de créer la vidéo MP4.')
                            continue
                        cf = (folder / 'points.csv').open('w', newline='', encoding='utf-8')
                        jf = (folder / 'images.jsonl').open('w', encoding='utf-8')
                        writer = csv.writer(cf)
                        writer.writerow(['image', 'temps_secondes', 'main', 'confiance', 'point', 'x', 'y', 'z'])
                        session = {'dir': folder, 'video': video, 'csv_file': cf, 'json_file': jf, 'csv': writer, 'start': time.monotonic(), 'frames': 0, 'meta': {'debut': datetime.now().astimezone().isoformat(), 'largeur': width, 'hauteur': height, 'fps_video': fps, 'coordonnees': 'MediaPipe normalisées; image miroir'}}
                        print('Enregistrement commencé :', folder)
    except Exception as exc:
        last_error = exc
        print('Erreur :', exc)
    finally:
        stop()
        cap.release()
        cv2.destroyAllWindows()
    return 1 if last_error else 0


if __name__ == '__main__':
    sys.exit(main())

