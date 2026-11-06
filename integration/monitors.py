"""Read Windows monitor rectangles; no screen contents are captured."""
import ctypes
import math
from ctypes import wintypes


class MONITORINFO(ctypes.Structure):
    _fields_ = [('cbSize', wintypes.DWORD), ('rcMonitor', wintypes.RECT),
                ('rcWork', wintypes.RECT), ('dwFlags', wintypes.DWORD)]


def windows_monitors():
    user32 = ctypes.windll.user32
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMONITOR,
                                     wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)
    found = []

    @callback_type
    def callback(handle, _dc, _rect, _param):
        info = MONITORINFO()
        info.cbSize = ctypes.sizeof(info)
        if user32.GetMonitorInfoW(handle, ctypes.byref(info)):
            r = info.rcMonitor
            found.append((r.left, r.top, r.right, r.bottom))
        return True

    if not user32.EnumDisplayMonitors(None, None, callback, 0) or not found:
        raise OSError('Windows ne fournit pas les écrans')
    return sorted(found, key=lambda r: (r[0], r[1]))


def map_to_monitors(x, y, monitors, margin=.16, inset=3):
    """Map camera X across monitor widths and Y within the selected screen."""
    if not monitors or not all(math.isfinite(v) for v in (x, y, margin)) or not 0 <= margin < .5:
        raise ValueError('Invalid display configuration')
    spans = [right - left for left, top, right, bottom in monitors]
    if any(w <= 2 * inset + 1 or bottom - top <= 2 * inset + 1
           for w, (left, top, right, bottom) in zip(spans, monitors)):
        raise ValueError('Invalid monitor rectangle')
    nx = max(0., min(1., (x - margin) / (1 - 2 * margin)))
    ny = max(0., min(1., (y - margin) / (1 - 2 * margin)))
    offset = min(nx * sum(spans), sum(spans) - 1e-9)
    for width, (left, top, right, bottom) in zip(spans, monitors):
        if offset < width:
            local_x = offset / width
            return (round(left + inset + local_x * (width - 1 - 2 * inset)),
                    round(top + inset + ny * (bottom - top - 1 - 2 * inset)))
        offset -= width
    raise ValueError('Invalid monitor selection')

