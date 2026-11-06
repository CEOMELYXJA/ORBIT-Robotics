"""
Souris mains libres : la caméra (ton iPhone utilisé comme webcam) suit ta main
et contrôle le curseur de l'ordi.

Gestes :
  - Main ouverte / index pointé : le curseur suit ta main (jointure de l'index)
  - Pincer pouce + index        : clic gauche (garde pincé = glisser-déposer)
  - Pincer pouce + majeur       : clic droit
  - Index + majeur levés (V)    : mode défilement, monte/descends la main

Touches dans la fenêtre d'aperçu :
  q = quitter      p = pause / reprendre
"""

import math

import cv2
import mediapipe as mp
import pyautogui

# ---------- Réglages ----------
CAMERA_INDEX = 0        # change à 1, 2... si c'est la mauvaise caméra
MARGIN = 0.18           # zone de la caméra ignorée sur les bords (plus grand = moins de mouvement requis)
SMOOTH = 0.30           # 0.1 = très lisse mais lent, 0.6 = nerveux
PINCH_ON = 0.30         # seuil pour déclencher le pincement (plus petit = pincer plus fort)
PINCH_OFF = 0.45        # seuil pour relâcher
SCROLL_SPEED = 2500     # vitesse du défilement

pyautogui.FAILSAFE = False   # on quitte avec la touche q à la place
pyautogui.PAUSE = 0

screen_w, screen_h = pyautogui.size()
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils


def dist(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def extended(lm, tip, pip):
    # Doigt "levé" si le bout est plus haut que l'articulation du milieu (main à l'endroit)
    return lm[tip].y < lm[pip].y


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("Impossible d'ouvrir la caméra. Essaie un autre CAMERA_INDEX.")
        return

    hands = mp_hands.Hands(
        max_num_hands=1,
        model_complexity=0,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    )

    cur_x, cur_y = screen_w / 2, screen_h / 2
    left_down = False
    right_down = False
    paused = False
    prev_scroll_y = None

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame = cv2.flip(frame, 1)  # effet miroir : main à droite = curseur à droite
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = hands.process(rgb)
        status = "pause" if paused else "aucune main"

        if result.multi_hand_landmarks:
            hand = result.multi_hand_landmarks[0]
            lm = hand.landmark
            mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)

            if not paused:
                size = dist(lm[0], lm[9]) or 1e-6  # taille de la main (poignet -> base du majeur)
                pinch_l = dist(lm[4], lm[8]) / size   # pouce-index
                pinch_r = dist(lm[4], lm[12]) / size  # pouce-majeur

                index_up = extended(lm, 8, 6)
                middle_up = extended(lm, 12, 10)
                ring_up = extended(lm, 16, 14)
                pinky_up = extended(lm, 20, 18)

                scroll_mode = (
                    index_up and middle_up and not ring_up and not pinky_up
                    and pinch_l > 0.6 and pinch_r > 0.6
                )

                if scroll_mode:
                    status = "defilement"
                    y = lm[9].y
                    if prev_scroll_y is not None:
                        delta = prev_scroll_y - y  # main qui monte = défile vers le haut
                        if abs(delta) > 0.004:
                            pyautogui.scroll(int(delta * SCROLL_SPEED))
                    prev_scroll_y = y
                else:
                    prev_scroll_y = None
                    status = "curseur"

                    # Position : jointure de l'index (stable pendant le pincement)
                    nx = clamp((lm[5].x - MARGIN) / (1 - 2 * MARGIN), 0, 1)
                    ny = clamp((lm[5].y - MARGIN) / (1 - 2 * MARGIN), 0, 1)
                    tx, ty = nx * (screen_w - 1), ny * (screen_h - 1)
                    cur_x += (tx - cur_x) * SMOOTH
                    cur_y += (ty - cur_y) * SMOOTH
                    pyautogui.moveTo(int(cur_x), int(cur_y))

                    # Clic gauche / glisser (avec hystérésis pour éviter les clics fantômes)
                    if not left_down and pinch_l < PINCH_ON:
                        pyautogui.mouseDown(button="left")
                        left_down = True
                    elif left_down and pinch_l > PINCH_OFF:
                        pyautogui.mouseUp(button="left")
                        left_down = False

                    # Clic droit
                    if not right_down and pinch_r < PINCH_ON and not left_down:
                        pyautogui.mouseDown(button="right")
                        right_down = True
                    elif right_down and pinch_r > PINCH_OFF:
                        pyautogui.mouseUp(button="right")
                        right_down = False

                    if left_down:
                        status = "clic / glisser"
                    elif right_down:
                        status = "clic droit"
        else:
            # Main perdue : on relâche tout par sécurité
            if left_down:
                pyautogui.mouseUp(button="left")
                left_down = False
            if right_down:
                pyautogui.mouseUp(button="right")
                right_down = False
            prev_scroll_y = None

        cv2.putText(frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        cv2.imshow("Souris mains libres  (q = quitter, p = pause)", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == ord("p"):
            paused = not paused
            if paused:
                if left_down:
                    pyautogui.mouseUp(button="left")
                    left_down = False
                if right_down:
                    pyautogui.mouseUp(button="right")
                    right_down = False

    if left_down:
        pyautogui.mouseUp(button="left")
    if right_down:
        pyautogui.mouseUp(button="right")
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

