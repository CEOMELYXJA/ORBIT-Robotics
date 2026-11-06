import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
import orbit_integrated as app


class Cap:
    def __init__(self, opened=True): self.opened = opened; self.released = False
    def isOpened(self): return self.opened
    def read(self): return True, np.zeros((64, 64, 3), dtype=np.uint8)
    def release(self): self.released = True


class Hands:
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def process(self, image): return SimpleNamespace(multi_hand_landmarks=None, multi_handedness=None)


class IntegrationTests(unittest.TestCase):
    def test_frame_is_processed_and_shutdown_releases_camera(self):
        cap = Cap()
        with patch.object(sys, 'argv', ['orbit']), patch.object(app.cv2, 'VideoCapture', return_value=cap), \
             patch.object(app.mp.solutions.hands, 'Hands', return_value=Hands()), \
             patch.object(app.cv2, 'imshow'), patch.object(app.cv2, 'destroyAllWindows'), \
             patch.object(app.cv2, 'getWindowProperty', return_value=1), \
             patch.object(app.cv2, 'waitKey', return_value=ord('q')):
            self.assertEqual(app.main(), 0)
        self.assertTrue(cap.released)

    def test_close_button_exits_and_releases_camera(self):
        cap = Cap()
        with patch.object(sys, 'argv', ['orbit']), patch.object(app.cv2, 'VideoCapture', return_value=cap), \
             patch.object(app.mp.solutions.hands, 'Hands', return_value=Hands()), \
             patch.object(app.cv2, 'imshow'), patch.object(app.cv2, 'destroyAllWindows'), \
             patch.object(app.cv2, 'getWindowProperty', return_value=0), \
             patch.object(app.cv2, 'waitKey', return_value=255):
            self.assertEqual(app.main(), 0)
        self.assertTrue(cap.released)

    def test_unavailable_cameras_fail_and_release(self):
        cameras = [Cap(False), Cap(False)]
        with patch.object(sys, 'argv', ['orbit']), patch.object(app.cv2, 'VideoCapture', side_effect=cameras):
            self.assertEqual(app.main(), 1)
        self.assertTrue(all(c.released for c in cameras))

if __name__ == '__main__': unittest.main()

