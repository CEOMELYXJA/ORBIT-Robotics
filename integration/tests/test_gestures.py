import unittest
from types import SimpleNamespace
from gestures import GestureSwitch, is_closed_fist


def fist():
    points = [SimpleNamespace(x=.5, y=.5) for _ in range(21)]
    points[0] = SimpleNamespace(x=.5, y=.9)
    points[9] = SimpleNamespace(x=.5, y=.5)
    for tip, pip in ((8, 6), (12, 10), (16, 14), (20, 18)):
        points[pip] = SimpleNamespace(x=.5, y=.5)
        points[tip] = SimpleNamespace(x=.5, y=.7)
    return SimpleNamespace(landmark=points)


def open_hand():
    h = fist()
    for tip in (8, 12, 16, 20):
        h.landmark[tip] = SimpleNamespace(x=.5, y=.2)
    return h


class GestureTests(unittest.TestCase):
    def setUp(self):
        self.now = 0.
        self.switch = GestureSwitch(clock=lambda: self.now)

    def test_fist_detection_and_invalid_input(self):
        self.assertTrue(is_closed_fist(fist().landmark))
        self.assertFalse(is_closed_fist(open_hand().landmark))
        self.assertFalse(is_closed_fist([]))
        self.assertFalse(is_closed_fist(42))
        invalid = fist().landmark
        invalid[3].x = float('nan')
        self.assertFalse(is_closed_fist(invalid))

    def test_invalid_timing_configuration_is_rejected(self):
        for settings in ({'pause_seconds': float('nan')}, {'max_gap': -1}, {'resume_observations': True}, {'max_gap': 10 ** 400}):
            with self.assertRaises(ValueError): GestureSwitch(**settings)

    def test_sustained_fist_requests_pause(self):
        self.assertEqual(self.switch.update([fist()], False), (None, True))
        for t in (.4, .8):
            self.now = t
            self.assertEqual(self.switch.update([fist()], False), (None, True))
        self.now = 1.3
        self.assertEqual(self.switch.update([fist()], False), ('pause', True))
        self.assertEqual(self.switch.update([fist()], True), (None, False))

    def test_short_fist_does_not_pause(self):
        self.switch.update([fist()], False)
        self.now = .5
        self.assertEqual(self.switch.update([open_hand()], False), (None, False))
        self.now = 2.
        self.assertEqual(self.switch.update([fist()], False), (None, True))

    def test_two_fists_required_to_resume_and_must_be_held(self):
        self.assertEqual(self.switch.update([fist()], True), (None, False))
        self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        for t in (.4, .8, 1.2, 1.6):
            self.now = t
            self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        self.now = 2.1
        self.assertEqual(self.switch.update([fist(), fist()], True), ('resume', True))
        self.assertEqual(self.switch.update([fist(), fist()], False), (None, True))

    def test_after_pause_fist_must_be_released_before_resume(self):
        self.switch.update([fist()], False)
        for t in (.4, .8):
            self.now = t
            self.switch.update([fist()], False)
        self.now = 1.3
        self.switch.update([fist()], False)
        self.now = 4.
        self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        self.switch.update([open_hand(), open_hand()], True)
        self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        for t in (4.4, 4.8, 5.2, 5.6):
            self.now = t
            self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        self.now = 6.1
        self.assertEqual(self.switch.update([fist(), fist()], True), ('resume', True))

    def test_sparse_observations_do_not_count_as_a_held_gesture(self):
        self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        self.now = 3.
        self.assertEqual(self.switch.update([fist(), fist()], True), (None, True))
        self.assertFalse(self.switch.latched)

if __name__ == '__main__': unittest.main()
