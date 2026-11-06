import math
import unittest
from types import SimpleNamespace

from mouse_core import MouseController, screen_position


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

    def test_release_on_lost_hand_requires_explicit_resume(self):
        self.control.start()
        for _ in range(3): self.control.update(hand(left=True))
        self.assertEqual(self.control.update(None), 'MAIN PERDUE - PAUSE')
        self.assertEqual(self.backend.events[-1], ('up', 'left'))
        self.assertTrue(self.control.paused)
        self.control.update(hand())
        self.assertEqual(self.backend.events[-1], ('up', 'left'))

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


if __name__ == '__main__':
    unittest.main()

