"""Local hand-to-mouse control, independent of camera and UI.

The caller must provide an explicit, always available stop key/button and call
stop() on shutdown, frame loss, or errors. Control is disabled on startup.
Coordinates are normalised MediaPipe image coordinates from the displayed image.
"""
import math
import ctypes
import os
from monitors import map_to_monitors
from gestures import is_closed_fist


def _windows_release_left():
    """Release only the left mouse button without moving it.

    PyAutoGUI's corner fail-safe runs before mouseUp as well as before movement;
    use a single native release if that fail-safe prevents ending a drag. This
    is not used for ordinary mouse operations and does not disable the fail-safe.
    """
    if os.name != 'nt':
        raise RuntimeError('Native mouse release is available on Windows only')
    from ctypes import wintypes

    class MouseInput(ctypes.Structure):
        _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG),
                    ('mouseData', wintypes.DWORD), ('dwFlags', wintypes.DWORD),
                    ('time', wintypes.DWORD), ('dwExtraInfo', ctypes.c_size_t)]

    class InputData(ctypes.Union):
        _fields_ = [('mi', MouseInput)]

    class Input(ctypes.Structure):
        _fields_ = [('type', wintypes.DWORD), ('data', InputData)]

    event = Input(type=0, data=InputData(mi=MouseInput(0, 0, 0, 0x0004, 0, 0)))
    send_input = ctypes.windll.user32.SendInput
    send_input.argtypes = (wintypes.UINT, ctypes.POINTER(Input), ctypes.c_int)
    send_input.restype = wintypes.UINT
    if send_input(1, ctypes.byref(event), ctypes.sizeof(Input)) != 1:
        raise OSError('Windows rejected the emergency mouse-button release')


def _clamp(value, low, high):
    return max(low, min(high, value))


def screen_position(x, y, width, height, margin=0.16, inset=3):
    """Map normalised camera coordinates to safe screen pixels."""
    if not all(math.isfinite(v) for v in (x, y, margin)):
        raise ValueError("Non-finite coordinate")
    if width <= 2 * inset + 1 or height <= 2 * inset + 1 or not 0 <= margin < .5:
        raise ValueError("Invalid screen dimensions or margin")
    span = 1 - 2 * margin
    nx = _clamp((x - margin) / span, 0, 1)
    ny = _clamp((y - margin) / span, 0, 1)
    return (round(inset + nx * (width - 1 - 2 * inset)),
            round(inset + ny * (height - 1 - 2 * inset)))


def _distance(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


class MouseController:
    """A mouse backend implements moveTo, mouseDown, mouseUp and click.

    update receives the 21 MediaPipe landmarks, or None if hand is absent.
    Raises backend exceptions after attempting to release held buttons. The
    caller should display a fault and leave the controller stopped.
    """
    def __init__(self, backend, screen_size, smoothing=.18, margin=.16,
                 pinch_on=.27, pinch_off=.43, min_frames=3, emergency_release=None,
                 monitors=None):
        if not 0 < smoothing <= 1 or not 0 <= pinch_on < pinch_off or min_frames < 1:
            raise ValueError("Invalid controller configuration")
        self.backend = backend
        self.emergency_release = emergency_release or _windows_release_left
        self.width, self.height = screen_size
        self.monitors = monitors
        screen_position(.5, .5, self.width, self.height, margin)
        self.smoothing, self.margin = smoothing, margin
        self.pinch_on, self.pinch_off, self.min_frames = pinch_on, pinch_off, min_frames
        self.paused = True
        self.left_down = False
        self.right_triggered = False
        self.left_count = self.right_count = 0
        self.position = None
        self.last_sent_position = None
        self.last_scroll = None
        self.wait_for_open = False
        self.invert_x = False
        self.aim_anchor = None
        self.relative_mode = False
        self.relative_hand = None
        self.relative_target = None
        self.relative_open_needed = 0
        self.edge_x = self.edge_y = 0

    def start(self):
        """Resume only after an explicit user action."""
        self.stop()
        self.paused = False

    def stop(self):
        """Pause immediately and release a held drag; safe to call repeatedly."""
        self.paused = True
        self.position = None
        self.last_sent_position = None
        self.last_scroll = None
        self.left_count = self.right_count = 0
        self.right_triggered = False
        self.wait_for_open = False
        self.aim_anchor = None
        self.relative_hand = None
        self.relative_target = None
        self.relative_open_needed = 0
        self.edge_x = self.edge_y = 0
        if self.left_down:
            # Keep the state set if release fails so another stop can retry.
            self._release_left()
            self.left_down = False

    def _release_left(self):
        try:
            self.backend.mouseUp(button='left')
        except Exception as exc:
            failsafe = getattr(self.backend, 'FailSafeException', None)
            if not isinstance(failsafe, type) or not isinstance(exc, failsafe):
                raise
            self.emergency_release()

    def update(self, landmarks):
        if self.paused:
            return 'PAUSE'
        if landmarks is None:
            # Keep tracking armed, but never hold a click when a hand is lost.
            try:
                if self.left_down:
                    self._release_left()
                    self.left_down = False
            except Exception:
                self.stop()
                raise
            self.left_count = self.right_count = 0
            self.right_triggered = False
            self.position = self.last_scroll = None
            self.last_sent_position = None
            self.aim_anchor = None
            self.relative_hand = None
            self.relative_target = None
            self.relative_open_needed = 3 if self.relative_mode else 0
            self.edge_x = self.edge_y = 0
            self.wait_for_open = True
            return 'RECHERCHE MAIN'
        try:
            if len(landmarks) < 21:
                raise ValueError('Expected 21 hand landmarks')
            for point in landmarks:
                if not math.isfinite(point.x) or not math.isfinite(point.y):
                    raise ValueError('Invalid hand landmark')
            if self.relative_mode and is_closed_fist(landmarks):
                if self.left_down:
                    self._release_left()
                    self.left_down = False
                self.left_count = self.right_count = 0
                self.right_triggered = False
                self.relative_hand = self.relative_target = None
                self.edge_x = self.edge_y = 0
                self.aim_anchor = None
                self.wait_for_open = True
                self.relative_open_needed = 3
                return 'MAIN FERMEE : REPLACER'
            scale = max(_distance(landmarks[0], landmarks[9]), .0001)
            left = _distance(landmarks[4], landmarks[8]) / scale
            right = _distance(landmarks[4], landmarks[12]) / scale
            if self.wait_for_open:
                if left > self.pinch_off and right > self.pinch_off:
                    if self.relative_open_needed:
                        self.relative_open_needed -= 1
                        if self.relative_open_needed:
                            return 'OUVRIR LA MAIN'
                    self.wait_for_open = False
                else:
                    if self.relative_mode and self.relative_open_needed:
                        self.relative_open_needed = 3
                    return 'OUVRIR LA MAIN'
            index_up = landmarks[8].y < landmarks[6].y
            middle_up = landmarks[12].y < landmarks[10].y
            ring_up = landmarks[16].y < landmarks[14].y
            pinky_up = landmarks[20].y < landmarks[18].y
            scroll = index_up and middle_up and not ring_up and not pinky_up and left > .6 and right > .6
            if scroll:
                self.aim_anchor = None
                if self.left_down:
                    self._release_left()
                    self.left_down = False
                self.left_count = self.right_count = 0
                y = landmarks[9].y
                if self.last_scroll is not None:
                    steps = round(_clamp((self.last_scroll - y) * 100, -4, 4))
                    if steps:
                        self.backend.scroll(steps)
                self.last_scroll = y
                return 'DEFILER'
            self.last_scroll = None
            input_x = 1 - landmarks[5].x if self.invert_x else landmarks[5].x
            x, y = (map_to_monitors(input_x, landmarks[5].y, self.monitors, self.margin)
                    if self.monitors else screen_position(input_x, landmarks[5].y,
                                                          self.width, self.height, self.margin))
            if self.relative_mode:
                hand_position = (x, y)
                if self.relative_hand is None:
                    current = getattr(self.backend, 'position', None)
                    self.position = tuple(current()) if callable(current) else (x, y)
                    self.relative_target = self.position
                else:
                    dx = x - self.relative_hand[0]
                    dy = y - self.relative_hand[1]
                    if self.edge_x and dx * self.edge_x < 0:
                        self.relative_target = (self.position[0], self.relative_target[1])
                        self.edge_x = 0
                    if self.edge_y and dy * self.edge_y < 0:
                        self.relative_target = (self.relative_target[0], self.position[1])
                        self.edge_y = 0
                    tx = self.relative_target[0] + dx * 1.35
                    ty = self.relative_target[1] + dy * 1.35
                    displays = self.monitors or [(0, 0, self.width, self.height)]
                    tx = _clamp(tx, min(d[0] for d in displays) + 3, max(d[2] for d in displays) - 4)
                    ty = _clamp(ty, min(d[1] for d in displays) + 3, max(d[3] for d in displays) - 4)
                    # Reaching a camera edge deliberately overrides the accumulated
                    # offset, while re-opening the fist never triggers a jump.
                    edge = max(self.margin, .22)
                    if input_x <= edge and dx < 0:
                        tx = min(d[0] for d in displays) + 3
                        self.edge_x = -1
                    elif input_x >= 1 - edge and dx > 0:
                        tx = max(d[2] for d in displays) - 4
                        self.edge_x = 1
                    horizontal = min(displays, key=lambda d: abs(_clamp(tx, d[0], d[2] - 1) - tx))
                    if landmarks[5].y <= edge and dy < 0:
                        ty = horizontal[1] + 3
                        self.edge_y = -1
                    elif landmarks[5].y >= 1 - edge and dy > 0:
                        ty = horizontal[3] - 4
                        self.edge_y = 1
                    self.relative_target = (tx, ty)
                self.relative_hand = hand_position
                tx, ty = self.relative_target
                displays = self.monitors or [(0, 0, self.width, self.height)]
                candidates = [(_clamp(tx, l + 3, r - 4), _clamp(ty, t + 3, b - 4))
                              for l, t, r, b in displays]
                x, y = min(candidates, key=lambda p: (p[0] - tx) ** 2 + (p[1] - ty) ** 2)
            if self.position is None:
                current = getattr(self.backend, 'position', None)
                self.position = tuple(current()) if callable(current) else (x, y)
            px, py = self.position
            distance = math.hypot(x - px, y - py)
            # Hold the pointer when a pinch begins; drag resumes on deliberate movement.
            if left < .55 and self.aim_anchor is None:
                self.aim_anchor = self.position
            if left >= .55:
                self.aim_anchor = None
            if self.aim_anchor is not None and self.left_down and math.hypot(
                    x - self.aim_anchor[0], y - self.aim_anchor[1]) > 45:
                self.aim_anchor = None
            if self.aim_anchor is None and distance > 3:
                # Smoothly increase responsiveness as the target gets farther away.
                # A radial cap keeps diagonal moves as gentle as horizontal ones.
                blend = _clamp((distance - 8) / 160, 0, 1)
                blend = blend * blend * (3 - 2 * blend)
                alpha = self.smoothing + (max(self.smoothing, .48) - self.smoothing) * blend
                step = min(distance * alpha, 110.0)
                self.position = (px + (x - px) * step / distance,
                                 py + (y - py) * step / distance)
            point = (round(self.position[0]), round(self.position[1]))
            if point != self.last_sent_position:
                self.backend.moveTo(*point)
                self.last_sent_position = point
            self.left_count = self.left_count + 1 if left < self.pinch_on else 0
            self.right_count = self.right_count + 1 if right < self.pinch_on and not self.left_down else 0
            if not self.left_down and self.left_count >= self.min_frames:
                # Set before calling: if the backend partially succeeds and then
                # raises, exception handling still attempts the release.
                self.left_down = True
                self.backend.mouseDown(button='left')
            elif self.left_down and left > self.pinch_off:
                self._release_left()
                self.left_down = False
            if self.right_count >= self.min_frames and not self.right_triggered and not self.left_down:
                self.backend.click(button='right')
                self.right_triggered = True
            if right > self.pinch_off:
                self.right_triggered = False
            return 'GLISSER' if self.left_down else 'POINTER'
        except Exception:
            try:
                self.stop()
            except Exception:
                # Preserve the original fault; paused remains true and the UI
                # must report the failure instead of silently resuming.
                pass
            raise

