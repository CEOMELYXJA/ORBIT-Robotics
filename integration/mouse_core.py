"""Local hand-to-mouse control, independent of camera and UI.

The caller must provide an explicit, always available stop key/button and call
stop() on shutdown, frame loss, or errors. Control is disabled on startup.
Coordinates are normalised MediaPipe image coordinates from the displayed image.
"""
import math
import ctypes
import os


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
    def __init__(self, backend, screen_size, smoothing=.27, margin=.16,
                 pinch_on=.27, pinch_off=.43, min_frames=3, emergency_release=None):
        if not 0 < smoothing <= 1 or not 0 <= pinch_on < pinch_off or min_frames < 1:
            raise ValueError("Invalid controller configuration")
        self.backend = backend
        self.emergency_release = emergency_release or _windows_release_left
        self.width, self.height = screen_size
        screen_position(.5, .5, self.width, self.height, margin)
        self.smoothing, self.margin = smoothing, margin
        self.pinch_on, self.pinch_off, self.min_frames = pinch_on, pinch_off, min_frames
        self.paused = True
        self.left_down = False
        self.right_triggered = False
        self.left_count = self.right_count = 0
        self.position = None
        self.last_scroll = None
        self.wait_for_open = False
        self.invert_x = False

    def start(self):
        """Resume only after an explicit user action."""
        self.stop()
        self.paused = False

    def stop(self):
        """Pause immediately and release a held drag; safe to call repeatedly."""
        self.paused = True
        self.position = None
        self.last_scroll = None
        self.left_count = self.right_count = 0
        self.right_triggered = False
        self.wait_for_open = False
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
            self.wait_for_open = True
            return 'RECHERCHE MAIN'
        try:
            if len(landmarks) < 21:
                raise ValueError('Expected 21 hand landmarks')
            for point in landmarks:
                if not math.isfinite(point.x) or not math.isfinite(point.y):
                    raise ValueError('Invalid hand landmark')
            scale = max(_distance(landmarks[0], landmarks[9]), .0001)
            left = _distance(landmarks[4], landmarks[8]) / scale
            right = _distance(landmarks[4], landmarks[12]) / scale
            if self.wait_for_open:
                if left > self.pinch_off and right > self.pinch_off:
                    self.wait_for_open = False
                else:
                    return 'OUVRIR LA MAIN'
            index_up = landmarks[8].y < landmarks[6].y
            middle_up = landmarks[12].y < landmarks[10].y
            ring_up = landmarks[16].y < landmarks[14].y
            pinky_up = landmarks[20].y < landmarks[18].y
            scroll = index_up and middle_up and not ring_up and not pinky_up and left > .6 and right > .6
            if scroll:
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
            x, y = screen_position(input_x, landmarks[5].y,
                                   self.width, self.height, self.margin)
            if self.position is None:
                current = getattr(self.backend, 'position', None)
                self.position = tuple(current()) if callable(current) else (x, y)
            px, py = self.position
            # Bound per-frame travel, including after reacquiring a different hand.
            self.position = (px + _clamp((x - px) * self.smoothing, -80, 80),
                             py + _clamp((y - py) * self.smoothing, -80, 80))
            self.backend.moveTo(round(self.position[0]), round(self.position[1]))
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


