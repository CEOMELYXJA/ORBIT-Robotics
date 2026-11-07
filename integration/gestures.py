"""Deliberate hand gestures for pausing and resuming cursor control."""
import math
import time


def positive_finite(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value) and value > 0
    except OverflowError:
        return False


def is_closed_fist(landmarks):
    """Conservative screen-space check: four fingertips curled toward wrist."""
    if landmarks is None:
        return False
    try:
        if len(landmarks) < 21:
            return False
        wrist = landmarks[0]
        distance = lambda p: math.hypot(p.x - wrist.x, p.y - wrist.y)
        if not all(not isinstance(v, bool) and math.isfinite(v) for p in landmarks for v in (p.x, p.y)):
            return False
        scale = distance(landmarks[9])
        if scale < .015:
            return False
        return all(distance(landmarks[tip]) < distance(landmarks[pip]) * .92
                   for tip, pip in ((8, 6), (12, 10), (16, 14), (20, 18)))
    except (AttributeError, TypeError, ValueError, OverflowError):
        return False


class GestureSwitch:
    """One fist pauses; two fists resume only after a sustained gesture."""
    def __init__(self, clock=time.monotonic, pause_seconds=1.2, resume_seconds=2.0,
                 max_gap=.75, pause_observations=4, resume_observations=6):
        if (not all(positive_finite(v) for v in (pause_seconds, resume_seconds, max_gap))
                or not all(isinstance(v, int) and not isinstance(v, bool) and v >= 2
                           for v in (pause_observations, resume_observations))):
            raise ValueError('Invalid gesture timing configuration')
        self.clock, self.pause_seconds, self.resume_seconds = clock, pause_seconds, resume_seconds
        self.max_gap = max_gap
        self.pause_observations, self.resume_observations = pause_observations, resume_observations
        self.candidate = None
        self.since = None
        self.last_seen = None
        self.observations = 0
        self.latched = False

    def update(self, hands, paused):
        hands = hands or []
        fists = sum(is_closed_fist(getattr(h, 'landmark', None)) for h in hands)
        candidate = ('resume' if paused and len(hands) == 2 and fists == 2 else
                     'pause' if not paused and fists >= 1 else None)
        if candidate is None:
            self.candidate = self.since = self.last_seen = None
            self.observations = 0
            if fists == 0:
                self.latched = False
            return None, False
        if self.latched:
            return None, True
        now = self.clock()
        if (candidate != self.candidate or self.last_seen is None
                or now < self.last_seen or now - self.last_seen > self.max_gap):
            self.candidate, self.since = candidate, now
            self.observations = 1
        else:
            self.observations += 1
        self.last_seen = now
        required = self.resume_seconds if candidate == 'resume' else self.pause_seconds
        minimum = self.resume_observations if candidate == 'resume' else self.pause_observations
        if now - self.since >= required and self.observations >= minimum:
            self.latched = True
            self.candidate = self.since = self.last_seen = None
            self.observations = 0
            return candidate, True
        return None, True
