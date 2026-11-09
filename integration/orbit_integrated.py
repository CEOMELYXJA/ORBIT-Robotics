import csv
import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import mediapipe as mp
from mouse_core import MouseController
from safety import SafetyGuard, windows_f8
from hand_selector import HandSelector
from monitors import windows_monitors
from gestures import GestureSwitch

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'enregistrements'
WINDOW_TITLE = 'ORBIT Robotics v0.1'


def mouse_button_rect(width, height):
    return (max(0, width - 250), max(0, height - 58), width - 8, height - 8)


def toggle_mouse(guard, selected):
    """Pausing is always allowed; resuming needs a detected hand and guard."""
    if not guard:
        return 'SOURIS INDISPONIBLE'
    if guard.controller.paused and selected is None:
        return 'MONTRE UNE MAIN POUR ACTIVER'
    return 'COMMANDE RECUE' if guard.toggle() else 'REPRISE IMPOSSIBLE'


def start_mouse_guard():
    """Return a monitored mouse controller, or disable mouse on setup failure."""
    candidate = None
    try:
        import pyautogui
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0
        try:
            monitors = windows_monitors()
            print('Ecrans detectes :', len(monitors), flush=True)
        except Exception as exc:
            print('Ecrans : utilisation de l’écran principal :', exc, flush=True)
            monitors = None
        candidate = SafetyGuard(MouseController(pyautogui, pyautogui.size(), monitors=monitors), windows_f8)
        candidate.start_monitor()
        return candidate
    except Exception as exc:
        if candidate is not None:
            try:
                candidate.close()
            except Exception:
                pass
        print('Souris indisponible, capture seule :', exc, flush=True)
        return None


def tracking_image(frame, max_width=640):
    """Limit inference size; normalised landmarks still match the full image."""
    height, width = frame.shape[:2]
    if width <= max_width:
        return frame
    return cv2.resize(frame, (max_width, max(1, round(height * max_width / width))),
                      interpolation=cv2.INTER_AREA)


def process_hand_control(guard, gestures, hands, selected, changed):
    """Handle gesture actions without issuing input for an ambiguous pose."""
    if guard.error:
        raise RuntimeError('Arret de securite indisponible: ' + guard.error)
    action, blocked = gestures.update(hands, guard.controller.paused)
    if blocked:
        guard.frame(None)
    if action == 'pause':
        guard.pause()
    elif action == 'resume':
        if selected is None or not guard.toggle(by_gesture=True):
            return 'REPRISE IMPOSSIBLE'
        guard.frame(None)
    if blocked:
        if action == 'resume':
            return 'OUVRIR LA MAIN'
        if action == 'pause':
            return 'PAUSE PAR GESTE'
        return '2 POINGS: REPRISE' if guard.controller.paused else 'POING: PAUSE'
    if selected is not None and changed and not guard.controller.paused:
        guard.frame(None)
    return guard.frame(selected)


def main():
    parser = argparse.ArgumentParser(description='ORBIT et HandsWizard : camera locale')
    parser.add_argument('--camera', type=int, default=0, help='numero de camera Windows')
    parser.add_argument('--backend', choices=['msmf', 'dshow'], default='msmf')
    parser.add_argument('--mirror', action='store_true', help='inverser horizontalement la video et le curseur')
    args = parser.parse_args()
    guard = start_mouse_guard()
    selector = HandSelector()
    gestures = GestureSwitch()
    gestures_enabled = False
    mirror = args.mirror
    print('Camera : ouvrir Camo sur le PC et sur le telephone, puis connecter le telephone.', flush=True)
    camera = cv2.VideoCapture
    cap = camera(args.camera, cv2.CAP_MSMF if args.backend == 'msmf' else cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap.release()
        cap = camera(args.camera, cv2.CAP_DSHOW if args.backend == 'msmf' else cv2.CAP_MSMF)
    if not cap.isOpened():
        print('Impossible d’ouvrir la webcam. Vérifiez les permissions Windows et fermez les autres applications utilisant la caméra.')
        cap.release()
        if guard:
            guard.close()
        return 1
    hands_api = mp.solutions.hands
    drawing = mp.solutions.drawing_utils
    session = None
    last_error = None
    button_registered = False
    button_requested = False
    button_rect = (0, 0, 0, 0)
    user_message = ''
    user_message_until = 0.0

    def on_window_mouse(event, x, y, _flags, _param):
        nonlocal button_requested
        left, top, right, bottom = button_rect
        if event == cv2.EVENT_LBUTTONUP and left <= x <= right and top <= y <= bottom:
            button_requested = True

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
        with hands_api.Hands(max_num_hands=2, model_complexity=0, min_detection_confidence=0.5, min_tracking_confidence=0.5) as hands:
            fps_ema = 0.0
            last_frame_time = time.monotonic()
            while True:
                ok, frame = cap.read()
                if not ok:
                    print('La webcam ne fournit plus d’image.')
                    last_error = RuntimeError('Camera interrompue')
                    break
                if mirror:
                    frame = cv2.flip(frame, 1)
                result = hands.process(cv2.cvtColor(tracking_image(frame), cv2.COLOR_BGR2RGB))
                detected = []
                for idx, hand in enumerate(result.multi_hand_landmarks or []):
                    handed = result.multi_handedness[idx].classification[0]
                    points = [{'id': i, 'x': p.x, 'y': p.y, 'z': p.z} for i, p in enumerate(hand.landmark)]
                    detected.append({'main': handed.label, 'confiance': handed.score, 'points': points})
                    drawing.draw_landmarks(frame, hand, hands_api.HAND_CONNECTIONS)
                mouse_status = 'SOURIS INDISPONIBLE'
                selected, changed = selector.select(result.multi_hand_landmarks, result.multi_handedness)
                if guard:
                    if gestures_enabled:
                        mouse_status = process_hand_control(guard, gestures, result.multi_hand_landmarks, selected, changed)
                    else:
                        if guard.error:
                            raise RuntimeError('Arret de securite indisponible: ' + guard.error)
                        if selected is not None and changed and not guard.controller.paused:
                            guard.frame(None)
                        mouse_status = guard.frame(selected)
                if session:
                    elapsed = time.monotonic() - session['start']
                    record = {'image': session['frames'], 'temps_secondes': elapsed, 'miroir': mirror, 'mains': detected}
                    session['json_file'].write(json.dumps(record, ensure_ascii=False) + '\n')
                    for hand in detected:
                        for p in hand['points']:
                            session['csv'].writerow([session['frames'], elapsed, hand['main'], hand['confiance'], p['id'], p['x'], p['y'], p['z']])
                    session['video'].write(frame)
                    session['frames'] += 1
                status = 'ENREGISTREMENT' if session else 'PRET'
                cv2.putText(frame, f'ORBIT | {status} | R: enregistrer/arreter | Q: quitter', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 0, 255) if session else (0, 220, 0), 2)
                cv2.putText(frame, 'Camo : verifiez la connexion du telephone si aucune image.', (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
                cv2.putText(frame, f'{mouse_status} | P souris | F8 arret | M image | H sens', (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 2)
                now = time.monotonic()
                fps_now = 1.0 / max(now - last_frame_time, .001)
                fps_ema = fps_now if not fps_ema else .9 * fps_ema + .1 * fps_now
                last_frame_time = now
                cv2.putText(frame, f'{fps_ema:.0f} images/s', (10, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
                gesture_help = ('G: gestes ACTIFS | 1 poing: pause | 2 poings: reprise'
                                if gestures_enabled else 'G: activer gestes de pause (experimental)')
                cv2.putText(frame, gesture_help, (10, 128), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
                height, width = frame.shape[:2]
                button_rect = mouse_button_rect(width, height)
                left, top, right, bottom = button_rect
                paused = guard is None or guard.controller.paused
                cv2.rectangle(frame, (left, top), (right, bottom), (50, 80, 180) if paused else (65, 145, 65), -1)
                button_label = ('SOURIS INDISPONIBLE' if guard is None else
                                'CLIQUER : ACTIVER' if paused else 'CLIQUER : PAUSE')
                cv2.putText(frame, button_label, (left + 8, top + 32), cv2.FONT_HERSHEY_SIMPLEX, .55, (255, 255, 255), 2)
                if user_message and time.monotonic() < user_message_until:
                    cv2.putText(frame, user_message, (10, 153), cv2.FONT_HERSHEY_SIMPLEX, .52, (0, 230, 255), 2)
                cv2.imshow(WINDOW_TITLE, frame)
                if not button_registered:
                    try:
                        cv2.setMouseCallback(WINDOW_TITLE, on_window_mouse)
                        button_registered = True
                    except cv2.error:
                        pass  # P and F8 still work if the window backend cannot register a button.
                key = cv2.waitKey(1) & 0xff
                if cv2.getWindowProperty(WINDOW_TITLE, cv2.WND_PROP_VISIBLE) < 1:
                    break
                if key in (ord('p'), ord('P')) or button_requested:
                    button_requested = False
                    user_message = toggle_mouse(guard, selected)
                    user_message_until = time.monotonic() + 2.5
                if key in (ord('m'), ord('M')):
                    mirror = not mirror
                    selector = HandSelector()
                    if guard:
                        guard.frame(None)
                if key in (ord('h'), ord('H')) and guard:
                    guard.toggle_horizontal()
                if key in (ord('g'), ord('G')):
                    gestures_enabled = not gestures_enabled
                    gestures = GestureSwitch()
                    if guard:
                        guard.frame(None)
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
                        session = {'dir': folder, 'video': video, 'csv_file': cf, 'json_file': jf, 'csv': writer, 'start': time.monotonic(), 'frames': 0, 'meta': {'debut': datetime.now().astimezone().isoformat(), 'largeur': width, 'hauteur': height, 'fps_video': fps, 'coordonnees': 'MediaPipe normalisées ; orientation miroir indiquée par image dans JSONL'}}
                        print('Enregistrement commencé :', folder)
    except Exception as exc:
        last_error = exc
        print('Erreur :', exc)
    finally:
        try:
            stop()
        finally:
            try:
                if guard:
                    guard.close()
            finally:
                cap.release()
                cv2.destroyAllWindows()
    return 1 if last_error else 0


if __name__ == '__main__':
    sys.exit(main())


