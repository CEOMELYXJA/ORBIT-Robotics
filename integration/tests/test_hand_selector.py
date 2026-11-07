import unittest
from types import SimpleNamespace
from hand_selector import HandSelector


def item(label):
    return SimpleNamespace(classification=[SimpleNamespace(label=label)])


class SelectorTests(unittest.TestCase):
    def test_retains_hand_when_detection_order_changes(self):
        a = SimpleNamespace(landmark='a')
        b = SimpleNamespace(landmark='b')
        s = HandSelector()
        self.assertEqual(s.select([a, b], [item('Left'), item('Right')]), ('a', True))
        self.assertEqual(s.select([b, a], [item('Right'), item('Left')]), ('a', False))

    def test_reacquire_after_loss_and_allow_other_hand(self):
        a = SimpleNamespace(landmark='a')
        b = SimpleNamespace(landmark='b')
        s = HandSelector()
        self.assertEqual(s.select([a], [item('Left')]), ('a', True))
        self.assertEqual(s.select([], []), (None, False))
        self.assertEqual(s.select([b], [item('Right')]), ('b', True))

    def test_ambiguous_two_hands_do_not_inject_input(self):
        a = SimpleNamespace(landmark='a')
        b = SimpleNamespace(landmark='b')
        s = HandSelector()
        self.assertEqual(s.select([a, b], [item('Left'), item('Left')]), (None, False))
        self.assertEqual(s.select([a, b], None), (None, False))

if __name__ == '__main__': unittest.main()
