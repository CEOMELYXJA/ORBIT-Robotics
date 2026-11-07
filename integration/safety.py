"""Surveillance indépendante du traitement vidéo ; F8 arrête la souris."""
import ctypes
import threading
import time


class SafetyGuard:
    def __init__(self, controller, key_pressed, clock=time.monotonic, timeout=2):
        self.controller, self.key_pressed, self.clock, self.timeout = controller, key_pressed, clock, timeout
        self.lock = threading.RLock()
        self.last_frame = clock()
        self.done = threading.Event()
        self.error = None
        # Starting the application or pressing F8 never arms the mouse by gesture.
        self.manual_rearm_required = True

    def check(self):
        with self.lock:
            if self.key_pressed() or self.clock() - self.last_frame > self.timeout:
                self.manual_rearm_required = True
                self.controller.stop()

    def frame(self, landmarks):
        with self.lock:
            self.last_frame = self.clock()
            return self.controller.update(landmarks)

    def toggle(self, *, by_gesture=False):
        with self.lock:
            # Never re-enable after the safety monitor fails or has closed, and
            # never enable while the emergency key is held down.
            key_down = self.key_pressed()
            if key_down:
                self.manual_rearm_required = True
            if self.error or self.done.is_set() or key_down:
                self.controller.stop()
                return False
            if by_gesture and self.manual_rearm_required:
                self.controller.stop()
                return False
            if self.controller.paused:
                self.controller.start()
                self.last_frame = self.clock()
                if not by_gesture:
                    self.manual_rearm_required = False
            else:
                self.controller.stop()
                if not by_gesture:
                    self.manual_rearm_required = True
            return True

    def pause(self):
        with self.lock:
            self.controller.stop()

    def toggle_horizontal(self):
        """Change pointer direction without changing the displayed image."""
        with self.lock:
            self.controller.update(None)
            self.controller.invert_x = not self.controller.invert_x
            return self.controller.invert_x

    def start_monitor(self):
        def run():
            while not self.done.wait(.03):
                try:
                    self.check()
                except Exception as exc:
                    self.error = str(exc)
                    try:
                        with self.lock:
                            self.controller.stop()
                    except Exception:
                        pass
                    self.done.set()
        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def close(self):
        self.done.set()
        with self.lock:
            self.controller.stop()
        if hasattr(self, 'thread'):
            self.thread.join(timeout=1)


def windows_f8():
    return bool(ctypes.windll.user32.GetAsyncKeyState(0x77) & 0x8000)

