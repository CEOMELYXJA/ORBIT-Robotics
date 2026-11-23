"""Le test du moteur Windows s'active explicitement avec ORBIT_TEST_WEBVIEW=1."""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from spatial_webview import HELPER, ROOT, SpatialWebView


class SpatialWebViewTests(unittest.TestCase):
    def test_missing_module_gives_actionable_error_without_external_window(self):
        view = SpatialWebView(Mock())
        with patch.object(Path, 'is_file', return_value=False), patch('spatial_webview.subprocess.Popen') as run:
            with self.assertRaisesRegex(OSError, 'Installer-ORBIT.cmd'):
                view.open()
            run.assert_not_called()

    @unittest.skipUnless(os.name == 'nt' and os.environ.get('ORBIT_TEST_WEBVIEW') == '1',
                         'Essai du cadre WebView2 Windows sur demande')
    def test_real_window_belongs_to_tk_resizes_and_closes(self):
        import tkinter as tk
        self.assertTrue(HELPER.is_file())
        user = ctypes.WinDLL('user32', use_last_error=True)
        user.IsChild.argtypes = [wintypes.HWND, wintypes.HWND]
        user.IsWindow.argtypes = [wintypes.HWND]
        user.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        root = tk.Tk()
        root.title('ORBIT · validation du cadre spatial')
        root.geometry('520x320')
        root.attributes('-alpha', 0)
        frame = tk.Frame(root)
        frame.pack(fill='both', expand=True)
        root.update()
        view = SpatialWebView(frame)
        reports = ROOT / 'rapports'
        reports.mkdir(exist_ok=True)
        view.profile = Path(tempfile.mkdtemp(prefix='webview2-synthetique-', dir=reports))

        def wait(check, timeout=25):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                root.update()
                if check():
                    return True
                time.sleep(.03)
            return False

        def width():
            rect = wintypes.RECT()
            return rect.right if user.GetClientRect(view.hwnd, ctypes.byref(rect)) else 0

        try:
            view.open(earth=True)
            self.assertTrue(wait(lambda: view.status in ('ready', 'error')), view.status)
            self.assertEqual(view.status, 'ready', view.error)
            child = view.hwnd
            self.assertTrue(user.IsChild(frame.winfo_id(), child))
            root.geometry('640x400')
            view.resize()
            self.assertTrue(wait(lambda: width() == frame.winfo_width() == 640, 4))
            view.close()
            self.assertTrue(wait(lambda: view.process.poll() is not None, 8))
            self.assertEqual(view.process.returncode, 0)
            self.assertFalse(user.IsWindow(child))
            self.assertTrue(user.IsWindow(root.winfo_id()))
        finally:
            view.close()
            root.destroy()
