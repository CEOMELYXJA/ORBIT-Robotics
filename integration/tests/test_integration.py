import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
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
    def test_gestures_are_disabled_until_explicitly_enabled(self):
        cap = Cap()
        guard = Mock()
        guard.error = None
        guard.controller.paused = True
        gesture = Mock()
        with patch.object(sys, 'argv', ['orbit']), patch.object(app, 'start_mouse_guard', return_value=guard), \
             patch.object(app, 'GestureSwitch', return_value=gesture), \
             patch.object(app.cv2, 'VideoCapture', return_value=cap), \
             patch.object(app.mp.solutions.hands, 'Hands', return_value=Hands()), \
             patch.object(app.cv2, 'imshow'), patch.object(app.cv2, 'destroyAllWindows'), \
             patch.object(app.cv2, 'getWindowProperty', return_value=1), \
             patch.object(app.cv2, 'waitKey', return_value=ord('q')):
            self.assertEqual(app.main(), 0)
        gesture.update.assert_not_called()

    def test_pause_gesture_releases_before_pausing(self):
        guard = Mock()
        guard.error = None
        guard.controller.paused = False
        gestures = Mock()
        gestures.update.return_value = ('pause', True)
        self.assertEqual(app.process_hand_control(guard, gestures, [], None, False), 'PAUSE PAR GESTE')
        guard.frame.assert_called_once_with(None)
        guard.pause.assert_called_once()

    def test_resume_gesture_requires_open_hand_and_refuses_failure(self):
        guard = Mock()
        guard.error = None
        guard.controller.paused = True
        guard.toggle.return_value = True
        gestures = Mock()
        gestures.update.return_value = ('resume', True)
        self.assertEqual(app.process_hand_control(guard, gestures, [], [1], False), 'OUVRIR LA MAIN')
        self.assertEqual(guard.frame.call_count, 2)
        guard.toggle.return_value = False
        self.assertEqual(app.process_hand_control(guard, gestures, [], [1], False), 'REPRISE IMPOSSIBLE')

    def test_resume_does_not_activate_without_identified_hand(self):
        guard = Mock()
        guard.error = None
        guard.controller.paused = True
        gestures = Mock()
        gestures.update.return_value = ('resume', True)
        app.process_hand_control(guard, gestures, [], None, False)
        guard.toggle.assert_not_called()

    def test_tracking_image_scales_without_distortion(self):
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        self.assertEqual(app.tracking_image(frame).shape, (360, 640, 3))
        small = np.zeros((100, 200, 3), dtype=np.uint8)
        self.assertIs(app.tracking_image(small), small)

    def test_mouse_disabled_if_monitor_fails_to_start(self):
        candidate = Mock()
        candidate.start_monitor.side_effect = RuntimeError('moniteur indisponible')
        fake_mouse = SimpleNamespace(size=lambda: (1920, 1080))
        with patch.dict(sys.modules, {'pyautogui': fake_mouse}), \
             patch.object(app, 'MouseController', return_value=Mock()), \
             patch.object(app, 'SafetyGuard', return_value=candidate):
            self.assertIsNone(app.start_mouse_guard())
        candidate.close.assert_called_once()

    def test_mouse_stays_disabled_if_monitor_cleanup_also_fails(self):
        candidate = Mock()
        candidate.start_monitor.side_effect = RuntimeError('moniteur indisponible')
        candidate.close.side_effect = RuntimeError('fermeture impossible')
        fake_mouse = SimpleNamespace(size=lambda: (1920, 1080))
        with patch.dict(sys.modules, {'pyautogui': fake_mouse}), \
             patch.object(app, 'MouseController', return_value=Mock()), \
             patch.object(app, 'SafetyGuard', return_value=candidate):
            self.assertIsNone(app.start_mouse_guard())

    def test_ambiguous_two_hands_cannot_activate_mouse(self):
        cap = Cap()
        point = SimpleNamespace(x=.5, y=.5, z=0)
        hand = SimpleNamespace(landmark=[point] * 21)
        side = SimpleNamespace(classification=[SimpleNamespace(label='Left', score=.9)])
        detector = Hands()
        detector.process = Mock(return_value=SimpleNamespace(
            multi_hand_landmarks=[hand, hand], multi_handedness=[side, side]))
        guard = Mock()
        guard.error = None
        guard.frame.return_value = 'PAUSE'
        with patch.object(sys, 'argv', ['orbit']), patch.object(app, 'start_mouse_guard', return_value=guard), \
             patch.object(app.cv2, 'VideoCapture', return_value=cap), \
             patch.object(app.mp.solutions.hands, 'Hands', return_value=detector), \
             patch.object(app.mp.solutions.drawing_utils, 'draw_landmarks'), \
             patch.object(app.cv2, 'imshow'), patch.object(app.cv2, 'destroyAllWindows'), \
             patch.object(app.cv2, 'getWindowProperty', return_value=1), \
             patch.object(app.cv2, 'waitKey', side_effect=[ord('p'), ord('q')]):
            self.assertEqual(app.main(), 0)
        self.assertEqual(guard.frame.call_count, 2)
        guard.frame.assert_called_with(None)
        guard.toggle.assert_not_called()
        guard.close.assert_called_once()

    def test_two_distinct_hands_select_one_and_can_activate(self):
        cap = Cap()
        point = SimpleNamespace(x=.5, y=.5, z=0)
        first = SimpleNamespace(landmark=[point] * 21)
        second = SimpleNamespace(landmark=[point] * 21)
        left = SimpleNamespace(classification=[SimpleNamespace(label='Left', score=.9)])
        right = SimpleNamespace(classification=[SimpleNamespace(label='Right', score=.9)])
        detector = Hands()
        detector.process = Mock(return_value=SimpleNamespace(
            multi_hand_landmarks=[first, second], multi_handedness=[left, right]))
        guard = Mock()
        guard.error = None
        guard.controller.paused = True
        guard.frame.return_value = 'PAUSE'
        with patch.object(sys, 'argv', ['orbit']), patch.object(app, 'start_mouse_guard', return_value=guard), \
             patch.object(app.cv2, 'VideoCapture', return_value=cap), \
             patch.object(app.mp.solutions.hands, 'Hands', return_value=detector), \
             patch.object(app.mp.solutions.drawing_utils, 'draw_landmarks'), \
             patch.object(app.cv2, 'imshow'), patch.object(app.cv2, 'destroyAllWindows'), \
             patch.object(app.cv2, 'getWindowProperty', return_value=1), \
             patch.object(app.cv2, 'flip', wraps=app.cv2.flip) as flip, \
             patch.object(app.cv2, 'waitKey', side_effect=[ord('p'), ord('q')]):
            self.assertEqual(app.main(), 0)
        guard.frame.assert_called_with(first.landmark)
        guard.toggle.assert_called_once()
        flip.assert_not_called()

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

