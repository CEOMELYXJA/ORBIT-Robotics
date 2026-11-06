import math
import ctypes
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from mouse_core import MouseController, screen_position, _windows_release_left


class FakeMouse:
    def __init__(self):
        self.events = []
        self.fail_move = False

    def moveTo(self, x, y):
        if self.fail_move:
            raise RuntimeError('simulated backend failure')
        self.events.append(('move', x, y))

    def mouseDown(self, button):
        self.events.append(('down', button))

    def mouseUp(self, button):
        self.events.append(('up', button))

    def click(self, button):
        self.events.append(('click', button))

    def scroll(self, amount):
        self.events.append(('scroll', amount))


def hand(left=False, right=False):
    p = [SimpleNamespace(x=.5, y=.5) for _ in range(21)]
    p[0] = SimpleNamespace(x=.5, y=.8)
    p[9] = SimpleNamespace(x=.5, y=.4)
    p[5] = SimpleNamespace(x=.5, y=.5)
    p[4] = SimpleNamespace(x=.3, y=.5)
    p[8] = SimpleNamespace(x=.31 if left else .7, y=.5)
    p[12] = SimpleNamespace(x=.31 if right else .7, y=.5)
    return p


class MappingTests(unittest.TestCase):
    def test_bounds_and_clamping(self):
        self.assertEqual(screen_position(-1, -1, 1920, 1080), (3, 3))
        self.assertEqual(screen_position(2, 2, 1920, 1080), (1916, 1076))
        self.assertEqual(screen_position(.5, .5, 1920, 1080), (960, 540))

    def test_invalid_values_rejected(self):
        for args in [(math.nan, 0, 100, 100), (0, 0, 2, 2), (0, 0, 100, 100, .5)]:
            with self.assertRaises(ValueError):
                screen_position(*args)


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.backend = FakeMouse()
        self.control = MouseController(self.backend, (1920, 1080), min_frames=3)

    def test_starts_paused_and_no_input(self):
        self.assertEqual(self.control.update(hand(left=True)), 'PAUSE')
        self.assertEqual(self.backend.events, [])

    def test_pointer_direction_can_reverse_without_changing_input(self):
        self.control.start()
        p = hand()
        p[5].x = .25
        self.control.update(p)
        left_x = self.backend.events[-1][1]
        self.control.position = None
        self.control.invert_x = True
        self.control.update(p)
        right_x = self.backend.events[-1][1]
        self.assertLess(left_x, right_x)
        self.assertEqual(p[5].x, .25)

    def test_pinch_debounce_drag_release_and_stop(self):
        self.control.start()
        for _ in range(2):
            self.control.update(hand(left=True))
        self.assertNotIn(('down', 'left'), self.backend.events)
        self.control.update(hand(left=True))
        self.assertIn(('down', 'left'), self.backend.events)
        self.control.stop()
        self.assertEqual(self.backend.events[-1], ('up', 'left'))
        self.assertTrue(self.control.paused)
        self.control.stop()
        self.assertEqual(self.backend.events.count(('up', 'left')), 1)

    def test_release_on_lost_hand_and_reacquire_without_click(self):
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        self.assertEqual(self.control.update(None), 'RECHERCHE MAIN')
        self.assertEqual(self.backend.events[-1], ('up', 'left'))
        self.assertFalse(self.control.paused)
        for _ in range(5):
            self.assertEqual(self.control.update(hand(left=True)), 'OUVRIR LA MAIN')
        self.assertEqual(self.backend.events.count(('down', 'left')), 1)
        self.control.update(hand())
        for _ in range(3): self.control.update(hand(left=True))
        self.assertEqual(self.backend.events.count(('down', 'left')), 2)

    def test_right_click_once_until_unpinched(self):
        self.control.start()
        for _ in range(6): self.control.update(hand(right=True))
        self.assertEqual(self.backend.events.count(('click', 'right')), 1)
        self.control.update(hand())
        for _ in range(3): self.control.update(hand(right=True))
        self.assertEqual(self.backend.events.count(('click', 'right')), 2)

    def test_failure_releases_and_pauses(self):
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        self.backend.fail_move = True
        with self.assertRaises(RuntimeError): self.control.update(hand())
        self.assertTrue(self.control.paused)
        self.assertEqual(self.backend.events[-1], ('up', 'left'))

    def test_corner_failsafe_uses_native_release_without_disabling_failsafe(self):
        class FailSafeException(Exception): pass
        self.backend.FailSafeException = FailSafeException
        released = []
        self.control.emergency_release = lambda: released.append('native-up')
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        self.backend.mouseUp = lambda button: (_ for _ in ()).throw(FailSafeException())
        self.control.stop()
        self.assertEqual(released, ['native-up'])
        self.assertFalse(self.control.left_down)
        self.assertTrue(self.control.paused)

    def test_failed_emergency_release_preserves_state_for_retry(self):
        class FailSafeException(Exception): pass
        self.backend.FailSafeException = FailSafeException
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        self.backend.mouseUp = lambda button: (_ for _ in ()).throw(FailSafeException())
        self.control.emergency_release = lambda: (_ for _ in ()).throw(OSError('blocked'))
        with self.assertRaises(OSError): self.control.stop()
        self.assertTrue(self.control.paused)
        self.assertTrue(self.control.left_down)
        released = []
        self.control.emergency_release = lambda: released.append(True)
        self.control.stop()
        self.assertEqual(released, [True])
        self.assertFalse(self.control.left_down)

    def test_unrelated_release_error_does_not_inject_native_input(self):
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        self.backend.mouseUp = lambda button: (_ for _ in ()).throw(RuntimeError('failure'))
        released = []
        self.control.emergency_release = lambda: released.append(True)
        with self.assertRaises(RuntimeError): self.control.stop()
        self.assertEqual(released, [])
        self.assertTrue(self.control.left_down)

    def test_invalid_landmarks_pause_and_release(self):
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        with self.assertRaises(ValueError): self.control.update([])
        self.assertTrue(self.control.paused)
        self.assertEqual(self.backend.events[-1], ('up', 'left'))

    def test_scroll_releases_drag_and_limits_steps(self):
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        p = hand()
        p[8].y = .2
        p[12].y = .2
        self.assertEqual(self.control.update(p), 'DEFILER')
        self.assertEqual(self.backend.events[-1], ('up', 'left'))
        p[9].y = .2
        self.control.update(p)
        self.assertEqual(self.backend.events[-1], ('scroll', 4))


@unittest.skipUnless(os.name == 'nt', 'Windows SendInput only')
class NativeReleaseTests(unittest.TestCase):
    def test_sends_only_left_button_release(self):
        class FakeSendInput:
            def __init__(self): self.calls = []
            def __call__(self, count, event, size):
                self.calls.append((count, event._obj.type, event._obj.data.mi.dwFlags, size))
                return 1
        fake = FakeSendInput()
        with patch.object(ctypes.windll.user32, 'SendInput', fake):
            _windows_release_left()
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(fake.calls[0][:3], (1, 0, 0x0004))
        self.assertEqual(fake.calls[0][3], 40 if ctypes.sizeof(ctypes.c_void_p) == 8 else 28)

    def test_rejected_release_raises(self):
        class Rejected:
            def __call__(self, *args): return 0
        with patch.object(ctypes.windll.user32, 'SendInput', Rejected()):
            with self.assertRaises(OSError):
                _windows_release_left()


if __name__ == '__main__':
    unittest.main()


