"""Experimental, opt-in gesture recogniser; does not access audio or input APIs.

Events are semantic suggestions only. A separate, explicitly configured and
validated integration would be required to trigger an application shortcut.
"""
import math
import time
from gestures import positive_finite


def hand_pose(landmarks):
    """Return 'v', 'index' or None for conservative two-dimensional poses."""
    if landmarks is None:
        return None
    try:
        if len(landmarks) < 21:
            return None
        if not all(not isinstance(v, bool) and math.isfinite(v) for point in landmarks for v in (point.x, point.y)):
            return None
        wrist = landmarks[0]
        distance = lambda point: math.hypot(point.x - wrist.x, point.y - wrist.y)
        if distance(landmarks[9]) < .015:
            return None
        def state(tip, pip):
            a, b = distance(landmarks[tip]), distance(landmarks[pip])
            if a > 1.12 * b:
                return 'extended'
            if a < .92 * b:
                return 'curled'
            return 'uncertain'
        states = [state(tip, pip) for tip, pip in ((8, 6), (12, 10), (16, 14), (20, 18))]
        if states == ['extended', 'extended', 'curled', 'curled']:
            return 'v'
        if states == ['extended', 'curled', 'curled', 'curled']:
            return 'index'
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None
    return None


class VoiceGesturePrototype:
    """Emit at most one suggestion per deliberate two-hand gesture."""
    def __init__(self, enabled=False, clock=time.monotonic, hold_seconds=2.5,
                 max_gap=.75, minimum_observations=6, release_seconds=.5):
        if (not all(positive_finite(v) for v in (hold_seconds, max_gap, release_seconds))
                or not isinstance(minimum_observations, int) or isinstance(minimum_observations, bool)
                or minimum_observations < 2):
            raise ValueError('Invalid gesture timing')
        self.enabled, self.clock = enabled, clock
        self.hold_seconds, self.max_gap = hold_seconds, max_gap
        self.minimum_observations, self.release_seconds = minimum_observations, release_seconds
        self.pose = self.since = self.last_seen = self.clear_since = None
        self.observations = 0
        self.latched = False

    def update(self, hands):
        """Return (suggestion, block_pointer); never operate a microphone."""
        if not self.enabled:
            return None, False
        hands = hands or []
        poses = [hand_pose(getattr(hand, 'landmark', None)) for hand in hands]
        pose = poses[0] if len(poses) == 2 and poses[0] is not None and poses[0] == poses[1] else None
        now = self.clock()
        if self.latched:
            if pose is None:
                if self.clear_since is None or now < self.clear_since:
                    self.clear_since = now
                elif now - self.clear_since >= self.release_seconds:
                    self.latched = False
                    self.clear_since = None
                return None, False
            self.clear_since = None
            return None, True
        if pose is None:
            self.pose = self.since = self.last_seen = None
            self.observations = 0
            return None, False
        if (pose != self.pose or self.last_seen is None or now < self.last_seen
                or now - self.last_seen > self.max_gap):
            self.pose, self.since, self.observations = pose, now, 1
        else:
            self.observations += 1
        self.last_seen = now
        if now - self.since >= self.hold_seconds and self.observations >= self.minimum_observations:
            self.latched = True
            self.pose = self.since = self.last_seen = None
            self.observations = 0
            return ('conversation' if pose == 'v' else 'dictee'), True
        return None, True

