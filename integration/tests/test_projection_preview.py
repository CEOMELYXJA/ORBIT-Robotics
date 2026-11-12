import unittest
from unittest.mock import Mock, patch

from centre_orbit import OrbitCenter
from projection_preview import TargetSequence, targets


class ProjectionTests(unittest.TestCase):
    def test_targets_scale_to_surface(self):
        self.assertEqual(targets(1000, 500), [(120, 80), (880, 80), (880, 420), (120, 420)])
        with self.assertRaises(ValueError):
            targets(0, 500)

    def test_sequence_accepts_only_the_next_target(self):
        sequence = TargetSequence()
        points = targets(1000, 500)
        self.assertFalse(sequence.click(*points[1], 1000, 500))
        self.assertEqual(sequence.next_index, 0)
        for point in points:
            self.assertTrue(sequence.click(*point, 1000, 500))
        self.assertEqual(sequence.next_index, 4)
        self.assertFalse(sequence.click(*points[0], 1000, 500))

    def test_center_does_not_start_duplicate_preview(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.projection = Mock()
        center.projection.poll.return_value = None
        center.status = Mock()
        with patch('centre_orbit.subprocess.Popen') as start:
            center.open_projection()
        start.assert_not_called()


if __name__ == '__main__':
    unittest.main()
