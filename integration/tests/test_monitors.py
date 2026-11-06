import math
import unittest
from monitors import map_to_monitors


class MonitorMappingTests(unittest.TestCase):
    def test_two_offset_monitors_are_both_reachable(self):
        screens = [(-1920, -692, 0, 388), (0, 0, 1920, 1080)]
        left = map_to_monitors(.16, .5, screens)
        right = map_to_monitors(.84, .5, screens)
        self.assertTrue(-1920 < left[0] < 0)
        self.assertTrue(-692 < left[1] < 388)
        self.assertTrue(0 < right[0] < 1920)
        self.assertTrue(0 < right[1] < 1080)

    def test_invalid_bounds_and_values_rejected(self):
        for x, screens in [(math.nan, [(0, 0, 800, 600)]), (.5, []), (.5, [(0, 0, 3, 3)])]:
            with self.assertRaises(ValueError):
                map_to_monitors(x, .5, screens)

if __name__ == '__main__': unittest.main()

