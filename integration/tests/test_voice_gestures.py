import unittest
from types import SimpleNamespace
from voice_gestures import VoiceGesturePrototype, hand_pose


def hand(pose):
    points = [SimpleNamespace(x=.5, y=.5) for _ in range(21)]
    points[0] = SimpleNamespace(x=.5, y=.9)
    points[9] = SimpleNamespace(x=.5, y=.5)
    for index, (tip, pip) in enumerate(((8, 6), (12, 10), (16, 14), (20, 18))):
        points[pip] = SimpleNamespace(x=.5, y=.5)
        extended = index == 0 or (pose == 'v' and index == 1) or pose == 'open'
        points[tip] = SimpleNamespace(x=.5, y=.1 if extended else .7)
    return SimpleNamespace(landmark=points)


class VoiceGestureTests(unittest.TestCase):
    def setUp(self):
        self.now = 0.
        self.switch = VoiceGesturePrototype(enabled=True, clock=lambda: self.now)

    def hold(self, pose):
        result = None
        for t in (0., .5, 1., 1.5, 2., 2.5):
            self.now = t
            result = self.switch.update([hand(pose), hand(pose)])
        return result

    def test_pose_classification_ignores_open_hand(self):
        self.assertEqual(hand_pose(hand('v').landmark), 'v')
        self.assertEqual(hand_pose(hand('index').landmark), 'index')
        self.assertIsNone(hand_pose(hand('open').landmark))
        self.assertIsNone(hand_pose([]))

    def test_disabled_by_default(self):
        prototype = VoiceGesturePrototype(clock=lambda: self.now)
        self.assertEqual(prototype.update([hand('v'), hand('v')]), (None, False))

    def test_voice_and_dictation_are_distinct_events(self):
        self.assertEqual(self.hold('v'), ('conversation', True))
        other = VoiceGesturePrototype(enabled=True, clock=lambda: self.now)
        self.switch = other
        self.assertEqual(self.hold('index'), ('dictee', True))

    def test_one_hand_or_intermittent_observations_do_not_trigger(self):
        self.assertEqual(self.switch.update([hand('v')]), (None, False))
        self.assertEqual(self.switch.update([hand('v'), hand('v')]), (None, True))
        self.now = 3.
        self.assertEqual(self.switch.update([hand('v'), hand('v')]), (None, True))

    def test_latch_requires_release_before_repeating(self):
        self.assertEqual(self.hold('v'), ('conversation', True))
        self.now = 3.
        self.assertEqual(self.switch.update([hand('v'), hand('v')]), (None, True))
        self.switch.update([],)
        self.now = 3.6
        self.switch.update([])
        self.now = 4.
        self.assertEqual(self.switch.update([hand('v'), hand('v')]), (None, True))

if __name__ == '__main__': unittest.main()

