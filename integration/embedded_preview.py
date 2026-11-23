"""Présente la fenêtre locale HandsWizard dans le cadre de l'accueil Windows."""
import ctypes
import os
from ctypes import wintypes

TITLE = 'ORBIT Robotics v0.1'
WIDTH_PROP = 'ORBIT.FrameWidth'
HEIGHT_PROP = 'ORBIT.FrameHeight'


def fit_preview(container_width, container_height, image_width, image_height):
    """Center an image inside a rectangle without changing its proportions."""
    width, height = max(1, container_width), max(1, container_height)
    if image_width <= 0 or image_height <= 0:
        image_width, image_height = 16, 9
    scale = min(width / image_width, height / image_height)
    out_width, out_height = max(1, round(image_width * scale)), max(1, round(image_height * scale))
    return (width - out_width) // 2, (height - out_height) // 2, out_width, out_height


class EmbeddedPreview:
    def __init__(self, parent, launcher_pid):
        if os.name != 'nt':
            raise OSError('L’aperçu intégré nécessite Windows.')
        self.parent = parent
        self.launcher_pid = launcher_pid
        self.user = ctypes.WinDLL('user32', use_last_error=True)
        self.user.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
        self.user.FindWindowW.restype = wintypes.HWND
        self.user.SetParent.argtypes = [wintypes.HWND, wintypes.HWND]
        self.user.SetParent.restype = wintypes.HWND
        self.user.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
        self.user.GetWindowLongW.restype = wintypes.LONG
        self.user.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.LONG]
        self.user.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
        self.user.IsWindow.argtypes = [wintypes.HWND]
        self.user.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
        self.user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        self.user.GetPropW.argtypes = [wintypes.HWND, wintypes.LPCWSTR]
        self.user.GetPropW.restype = wintypes.HANDLE
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        self.kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        self.kernel.OpenProcess.restype = wintypes.HANDLE
        self.kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.ntdll = ctypes.WinDLL('ntdll')
        self.ntdll.NtQueryInformationProcess.argtypes = [wintypes.HANDLE, wintypes.ULONG, ctypes.c_void_p, wintypes.ULONG, ctypes.c_void_p]
        self.ntdll.NtQueryInformationProcess.restype = ctypes.c_long
        self.handle = None
        self.last_geometry = None

    def _owned(self, handle):
        """Accept the launched process or its venv child; fail closed on errors."""
        class BasicInfo(ctypes.Structure):
            _fields_ = [('exit_status', ctypes.c_void_p), ('peb', ctypes.c_void_p),
                        ('affinity', ctypes.c_void_p), ('priority', ctypes.c_void_p),
                        ('pid', ctypes.c_void_p), ('parent_pid', ctypes.c_void_p)]
        pid = wintypes.DWORD()
        self.user.GetWindowThreadProcessId(handle, ctypes.byref(pid))
        current = pid.value
        for _ in range(3):
            if current == self.launcher_pid:
                return True
            if not current:
                return False
            process = self.kernel.OpenProcess(0x1000, False, current)
            if not process:
                return False
            try:
                info = BasicInfo()
                if self.ntdll.NtQueryInformationProcess(process, 0, ctypes.byref(info), ctypes.sizeof(info), None) != 0:
                    return False
                current = info.parent_pid or 0
            finally:
                self.kernel.CloseHandle(process)
        return False

    def attach(self):
        """Attach only the explicitly launched tracking window, never another app."""
        handle = self.user.FindWindowW(None, TITLE)
        if not handle or not self._owned(handle):
            return False
        style = self.user.GetWindowLongW(handle, -16)
        ctypes.set_last_error(0)
        self.user.SetParent(handle, self.parent.winfo_id())
        error = ctypes.get_last_error()
        if error:
            raise OSError(error, 'Impossible d’intégrer l’aperçu.')
        # Embedded child: remove frame and title without changing the camera.
        self.user.SetWindowLongW(handle, -16, (style & ~0x00CF0000) | 0x40000000)
        self.handle = handle
        self.resize()
        return True

    def resize(self, _event=None):
        if not self.handle or not self.user.IsWindow(self.handle):
            return
        image_width = self.user.GetPropW(self.handle, WIDTH_PROP) or 0
        image_height = self.user.GetPropW(self.handle, HEIGHT_PROP) or 0
        x, y, width, height = fit_preview(self.parent.winfo_width(), self.parent.winfo_height(), image_width, image_height)
        geometry = (x, y, width, height)
        if geometry != self.last_geometry and self.user.SetWindowPos(self.handle, None, x, y, width, height, 0x0074):
            self.last_geometry = geometry

    def request_close(self):
        handle = self.handle or self.user.FindWindowW(None, TITLE)
        if handle and self.user.IsWindow(handle) and self._owned(handle):
            self.user.PostMessageW(handle, 0x0010, 0, 0)

    @staticmethod
    def close_existing_tracking():
        """Ask the standalone ORBIT tracking window to close normally."""
        if os.name != 'nt':
            return False
        user = ctypes.WinDLL('user32', use_last_error=True)
        user.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
        user.FindWindowW.restype = wintypes.HWND
        user.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
        handle = user.FindWindowW(None, TITLE)
        return bool(handle and user.PostMessageW(handle, 0x0010, 0, 0))
