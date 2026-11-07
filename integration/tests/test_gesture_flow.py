import unittest
from unittest.mock import Mock
from mouse_core import MouseController
from safety import SafetyGuard
from orbit_integrated import process_hand_control
from test_mouse import FakeMouse, hand


class GestureFlowTests(unittest.TestCase):
    def test_pause_releases_drag_and_resume_requires_open_hand(self):
        backend = FakeMouse()
        controller = MouseController(backend, (1920, 1080), min_frames=3)
        guard = SafetyGuard(controller, lambda: False)
        guard.toggle()
        for _ in range(3):
            guard.frame(hand(left=True))
        self.assertTrue(controller.left_down)
        gesture = Mock()
        gesture.update.return_value = ('pause', True)
        process_hand_control(guard, gesture, [], None, False)
        self.assertTrue(controller.paused)
        self.assertFalse(controller.left_down)
        self.assertEqual(backend.events[-1], ('up', 'left'))
        gesture.update.return_value = ('resume', True)
        process_hand_control(guard, gesture, [], hand(left=True), False)
        self.assertFalse(controller.paused)
        for _ in range(4):
            guard.frame(hand(left=True))
        self.assertEqual(backend.events.count(('down', 'left')), 1)
        guard.frame(hand())
        for _ in range(3):
            guard.frame(hand(left=True))
        self.assertEqual(backend.events.count(('down', 'left')), 2)
        guard.close()

    def test_resume_gesture_cannot_override_pressed_emergency_key(self):
        backend = FakeMouse()
        controller = MouseController(backend, (1920, 1080))
        guard = SafetyGuard(controller, lambda: True)
        gesture = Mock()
        gesture.update.return_value = ('resume', True)
        self.assertEqual(process_hand_control(guard, gesture, [], hand(), False), 'REPRISE IMPOSSIBLE')
        self.assertTrue(controller.paused)
        self.assertEqual(backend.events, [])

if __name__ == '__main__': unittest.main()
