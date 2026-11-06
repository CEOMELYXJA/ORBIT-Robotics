"""Moteur de souris indépendant du transport et du matériel.

Aucune commande shell n'est acceptée. Tous les déplacements sont relatifs,
limités et arrêtés automatiquement lorsque le téléphone ne répond plus.
"""
import math
import time


class MouseController:
    def __init__(self, backend, clock=time.monotonic):
        self.mouse = backend
        self.clock = clock
        self.paused = True
        self.buttons = set()
        self.last_activity = self.clock()
        self.last_move = 0.0

    @staticmethod
    def number(value, limit):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        if not math.isfinite(value):
            return None
        return max(-limit, min(limit, value))

    def release(self):
        for button in list(self.buttons):
            try:
                self.mouse.mouseUp(button=button)
            finally:
                self.buttons.discard(button)

    def stop(self):
        self.paused = True
        self.release()

    def dispatch(self, data):
        if not isinstance(data, dict):
            return False
        action = data.get("type")
        if action == "pause":
            self.stop()
            return True
        if action == "resume":
            self.stop()
            self.paused = False
            self.last_activity = self.clock()
            return True
        if self.paused:
            return False

        now = self.clock()
        self.last_activity = now
        if action == "move":
            dx = self.number(data.get("dx"), 55)
            dy = self.number(data.get("dy"), 55)
            if dx is None or dy is None:
                return False
            if now - self.last_move < 0.012:
                return False
            self.last_move = now
            if abs(dx) >= 0.2 or abs(dy) >= 0.2:
                # PyAutoGUI garde son coin de secours actif (FAILSAFE=True).
                self.mouse.moveRel(round(dx), round(dy), duration=0)
            return True

        if action == "button":
            button = data.get("button")
            down = data.get("down")
            if button not in ("left", "right") or type(down) is not bool:
                return False
            if down and button not in self.buttons:
                self.mouse.mouseDown(button=button)
                self.buttons.add(button)
            elif not down and button in self.buttons:
                self.mouse.mouseUp(button=button)
                self.buttons.remove(button)
            return True

        if action == "click":
            button = data.get("button")
            if button not in ("left", "right"):
                return False
            if button in self.buttons:
                return False
            self.mouse.click(button=button)
            return True

        if action == "scroll":
            steps = self.number(data.get("steps"), 4)
            if steps is None:
                return False
            if abs(steps) >= 1:
                self.mouse.scroll(round(steps))
            return True
        return False

    def watchdog(self, timeout=1.5):
        if not self.paused and self.clock() - self.last_activity > timeout:
            self.stop()
            return True
        return False

