"""Souris Windows pilotée par la webcam.

Gestes : index=pointer ; pouce-index=maintenir/clic gauche ;
pouce-majeur=clic droit ; V=index+majeur=defiler.
P = pause/reprise ; Q ou Echap = quitter. Webcam locale (pas de cloud).
"""
import math
import time

import cv2
import mediapipe as mp
import pyautogui

CAMERA_INDEX = 0
MARGIN = .16
SMOOTHING = .27
PINCH_ON = .27
PINCH_OFF = .43
MIN_FRAMES = 3
LOST_FRAMES = 3
SCROLL_FACTOR = 100
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0


def length(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def clamp(value, low, high):
    return max(low, min(high, value))


def main():
    if not hasattr(mp, "solutions"):
        raise RuntimeError("MediaPipe incompatible. Installe la version de requirements.txt (Python 3.11).")
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    if not cap.isOpened():
        raise RuntimeError("Webcam introuvable : vérifie CAMERA_INDEX et les autorisations Windows.")

    width, height = pyautogui.size()
    posx, posy = width / 2, height / 2
    paused = True  # Démarrage en pause pour éviter les clics accidentels
    left_down = False
    pinch_counter = 0
    right_counter = 0
    right_triggered = False
    lost = 0
    last_scroll = None
    hands = mp.solutions.hands.Hands(max_num_hands=1, model_complexity=0,
        min_detection_confidence=.65, min_tracking_confidence=.65)

    try:
        while True:
            ok, image = cap.read()
            if not ok:
                break
            image = cv2.flip(image, 1)
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            found = hands.process(rgb)
            status = "PAUSE (P pour activer)" if paused else "Aucune main"
            lm = found.multi_hand_landmarks[0].landmark if found.multi_hand_landmarks else None
            if not paused and lm:
                lost = 0
                size = max(length(lm[0], lm[9]), .0001)
                lpinch = length(lm[4], lm[8]) / size
                rpinch = length(lm[4], lm[12]) / size
                index = lm[8].y < lm[6].y
                middle = lm[12].y < lm[10].y
                ring = lm[16].y < lm[14].y
                pinky = lm[20].y < lm[18].y
                scroll_mode = index and middle and not ring and not pinky and lpinch > .6 and rpinch > .6

                if scroll_mode:
                    if left_down:
                        pyautogui.mouseUp(button="left")
                        left_down = False
                    pinch_counter = right_counter = 0
                    y = lm[9].y
                    if last_scroll is not None:
                        amount = round(clamp((last_scroll-y)*SCROLL_FACTOR, -4, 4))
                        if amount:
                            pyautogui.scroll(amount)
                    last_scroll = y
                    status = "DEFILER"
                else:
                    last_scroll = None
                    x = clamp((lm[5].x-MARGIN)/(1-2*MARGIN), .01, .99)*(width-1)
                    y = clamp((lm[5].y-MARGIN)/(1-2*MARGIN), .01, .99)*(height-1)
                    posx += (x-posx)*SMOOTHING
                    posy += (y-posy)*SMOOTHING
                    pyautogui.moveTo(round(clamp(posx, 3, width-4)),
                                     round(clamp(posy, 3, height-4)))
                    pinch_counter = pinch_counter+1 if lpinch < PINCH_ON else 0
                    right_counter = right_counter+1 if rpinch < PINCH_ON and not left_down else 0
                    if not left_down and pinch_counter >= MIN_FRAMES:
                        pyautogui.mouseDown(button="left")
                        left_down = True
                    elif left_down and lpinch > PINCH_OFF:
                        pyautogui.mouseUp(button="left")
                        left_down = False
                    if right_counter >= MIN_FRAMES and not right_triggered:
                        pyautogui.click(button="right")
                        right_triggered = True
                    if rpinch > PINCH_OFF:
                        right_triggered = False
                    status = "GLISSER" if left_down else "POINTER"
            elif not paused:
                lost += 1
                if lost >= LOST_FRAMES:
                    if left_down:
                        pyautogui.mouseUp(button="left")
                        left_down = False
                    pinch_counter = right_counter = 0
                    right_triggered = False
                    last_scroll = None
            cv2.putText(image, status, (12, 34), cv2.FONT_HERSHEY_SIMPLEX,
                        .8, (0, 255, 180), 2)
            cv2.imshow("Handswizard - P=pause Q=quitter", image)
            key = cv2.waitKey(1) & 0xff
            if key in (ord("q"), 27):
                break
            if key == ord("p"):
                paused = not paused
                if left_down:
                    pyautogui.mouseUp(button="left")
                    left_down = False
                pinch_counter = right_counter = lost = 0
                right_triggered = False
                last_scroll = None
    except pyautogui.FailSafeException:
        print("Arret de securite PyAutoGUI : coin de l'ecran atteint.")
    finally:
        if left_down:
            pyautogui.mouseUp(button="left")
        hands.close()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

