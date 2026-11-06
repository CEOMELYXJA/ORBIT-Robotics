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

    def check(self):
        with self.lock:
            if self.key_pressed() or self.clock() - self.last_frame > self.timeout:
                self.controller.stop()

    def frame(self, landmarks):
        with self.lock:
            self.last_frame = self.clock()
            return self.controller.update(landmarks)

    def toggle(self):
        with self.lock:
            if self.controller.paused:
                self.controller.start()
                self.last_frame = self.clock()
            else:
                self.controller.stop()

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

