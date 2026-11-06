"""Deliberate hand gestures for pausing and resuming cursor control."""
import math
import time


def is_closed_fist(landmarks):
    """Conservative screen-space check: four fingertips curled toward wrist."""
    if landmarks is None or len(landmarks) < 21:
        return False
    try:
        wrist = landmarks[0]
        distance = lambda p: math.hypot(p.x - wrist.x, p.y - wrist.y)
        if not all(math.isfinite(v) for p in landmarks for v in (p.x, p.y)):
            return False
        scale = distance(landmarks[9])
        if scale < .015:
            return False
        return all(distance(landmarks[tip]) < distance(landmarks[pip]) * .92
                   for tip, pip in ((8, 6), (12, 10), (16, 14), (20, 18)))
    except (AttributeError, TypeError, ValueError):
        return False


class GestureSwitch:
    """One fist pauses; two fists resume only after a sustained gesture."""
    def __init__(self, clock=time.monotonic, pause_seconds=1.2, resume_seconds=2.0):
        self.clock, self.pause_seconds, self.resume_seconds = clock, pause_seconds, resume_seconds
        self.candidate = None
        self.since = None
        self.latched = False

    def update(self, hands, paused):
        hands = hands or []
        fists = sum(is_closed_fist(getattr(h, 'landmark', None)) for h in hands)
        candidate = ('resume' if paused and len(hands) == 2 and fists == 2 else
                     'pause' if not paused and fists >= 1 else None)
        if candidate is None:
            self.candidate = self.since = None
            if fists == 0:
                self.latched = False
            return None, False
        if self.latched:
            return None, True
        now = self.clock()
        if candidate != self.candidate:
            self.candidate, self.since = candidate, now
        required = self.resume_seconds if candidate == 'resume' else self.pause_seconds
        if now - self.since >= required:
            self.latched = True
            self.candidate = self.since = None
            return candidate, True
        return None, True

