"""Vérifie la place de l’aperçu sans webcam ni image personnelle."""
import ctypes
from ctypes import wintypes
import os
import subprocess
import sys
import time
import unittest
from unittest.mock import Mock, patch
import tkinter as tk

from centre_orbit import OrbitCenter
import embedded_preview
from embedded_preview import fit_preview


class CameraGeometryTests(unittest.TestCase):
    def test_fit_keeps_the_original_image_ratio_and_stays_inside(self):
        for area, image in (((528, 240), (640, 480)),
                            ((308, 174), (640, 480)),
                            ((308, 174), (1920, 1080)),
                            ((528, 240), (1080, 1920))):
            x, y, width, height = fit_preview(*area, *image)
            self.assertGreaterEqual(x, 0)
            self.assertGreaterEqual(y, 0)
            self.assertLessEqual(x + width, area[0])
            self.assertLessEqual(y + height, area[1])
            self.assertLessEqual(abs(width * image[1] - height * image[0]), max(image))

    def test_running_camera_follows_from_home_to_space_and_back(self):
        root = tk.Tk()
        root.attributes('-alpha', 0)
        try:
            with patch.object(OrbitCenter, 'refresh'):
                centre = OrbitCenter(root)
            root.update()
            self.assertEqual(centre.preview.pack_info()['in'], centre.camera_slot)
            centre.child = Mock()
            centre.child.poll.return_value = None
            centre.space = Mock()
            centre.space.status = 'ready'
            centre.open_space()
            root.update()
            self.assertTrue(centre.camera_side.winfo_ismapped())
            self.assertEqual(centre.preview.pack_info()['in'], centre.side_slot)
            centre.show_home()
            root.update()
            self.assertEqual(centre.preview.pack_info()['in'], centre.camera_slot)
            centre.child.poll.return_value = 0
            centre.open_space()
            root.update()
            self.assertFalse(centre.camera_side.winfo_ismapped())
            centre.open_space(together=True)
            root.update()
            self.assertTrue(centre.camera_side.winfo_ismapped())
            self.assertEqual(centre.preview.pack_info()['in'], centre.side_slot)
        finally:
            root.destroy()

    @unittest.skipUnless(os.name == 'nt', 'Intégration de fenêtre Windows')
    def test_synthetic_window_stays_embedded_as_preview_moves(self):
        title = 'ORBIT - apercu synthetique sans camera'
        program = r"""
import ctypes
from ctypes import wintypes
user = ctypes.WinDLL('user32', use_last_error=True)
kernel = ctypes.WinDLL('kernel32', use_last_error=True)
proc_type = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
class WindowClass(ctypes.Structure):
    _fields_ = [('style', wintypes.UINT), ('proc', proc_type), ('extra', ctypes.c_int),
                ('window_extra', ctypes.c_int), ('instance', wintypes.HINSTANCE),
                ('icon', wintypes.HANDLE), ('cursor', wintypes.HANDLE),
                ('background', wintypes.HANDLE), ('menu', wintypes.LPCWSTR),
                ('name', wintypes.LPCWSTR)]
user.DefWindowProcW.restype = ctypes.c_ssize_t
user.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user.DestroyWindow.argtypes = [wintypes.HWND]
@proc_type
def callback(hwnd, message, wparam, lparam):
    if message == 0x0010:
        user.DestroyWindow(hwnd)
        user.PostQuitMessage(0)
        return 0
    return user.DefWindowProcW(hwnd, message, wparam, lparam)
kernel.GetModuleHandleW.restype = wintypes.HINSTANCE
instance = kernel.GetModuleHandleW(None)
wc = WindowClass(0, callback, 0, 0, instance, None, None, None, None, 'OrbitSyntheticCamera')
user.RegisterClassW(ctypes.byref(wc))
user.CreateWindowExW.restype = wintypes.HWND
user.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.HWND, wintypes.HMENU,
    wintypes.HINSTANCE, ctypes.c_void_p]
handle = user.CreateWindowExW(0, wc.name, 'ORBIT - apercu synthetique sans camera',
    0x00CF0000, 0, 0, 320, 180, None, None, instance, None)
if not handle: raise OSError(ctypes.get_last_error())
message = wintypes.MSG()
while user.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
    user.TranslateMessage(ctypes.byref(message))
    user.DispatchMessageW(ctypes.byref(message))
"""
        root = tk.Tk()
        root.attributes('-alpha', 0)
        process = None
        try:
            with patch.object(OrbitCenter, 'refresh'):
                centre = OrbitCenter(root)
            root.update()
            process = subprocess.Popen([sys.executable, '-c', program],
                                       creationflags=subprocess.CREATE_NO_WINDOW)
            view = embedded_preview.EmbeddedPreview(centre.preview, process.pid)
            with patch.object(embedded_preview, 'TITLE', title):
                deadline = time.monotonic() + 12
                while time.monotonic() < deadline and not view.attach():
                    self.assertIsNone(process.poll(), 'La fenêtre de test s’est arrêtée.')
                    root.update()
                    time.sleep(.03)
            self.assertTrue(view.handle, 'La fenêtre synthétique doit être intégrée.')
            user = ctypes.WinDLL('user32', use_last_error=True)
            user.GetParent.argtypes = [wintypes.HWND]
            user.GetParent.restype = wintypes.HWND
            self.assertEqual(user.GetParent(view.handle), centre.preview.winfo_id())
            centre.embedded = view
            centre.child = process
            centre.space = Mock()
            centre.space.status = 'ready'
            centre.open_space()
            root.update()
            view.resize()
            self.assertEqual(centre.preview.pack_info()['in'], centre.side_slot)
            self.assertEqual(user.GetParent(view.handle), centre.preview.winfo_id())
            self.assertGreater(view.last_geometry[2], 1)
            self.assertLessEqual(abs(view.last_geometry[2] * 9 - view.last_geometry[3] * 16), 16)
            centre.show_home()
            root.update()
            view.resize()
            self.assertEqual(centre.preview.pack_info()['in'], centre.camera_slot)
            self.assertEqual(user.GetParent(view.handle), centre.preview.winfo_id())
            self.assertTrue(view._owned(view.handle), 'La fenêtre reste la propriété du processus de test.')
            view.request_close()
            deadline = time.monotonic() + 10
            while process.poll() is None and time.monotonic() < deadline:
                root.update()
                time.sleep(.03)
            self.assertIsNotNone(process.poll(), 'La fenêtre de test doit se fermer normalement.')
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
            root.destroy()


if __name__ == '__main__':
    unittest.main()
