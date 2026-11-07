"""Vérifications synthétiques du cockpit, sans ouvrir de fenêtre."""
import unittest

from winmap_host import WinmapHost, ZONES, zone_polygons


class FakeValue:
    def set(self, value):
        self.value = value


class FakeRoot:
    def __init__(self):
        self.destroyed = False

    def destroy(self):
        self.destroyed = True


class WinmapTests(unittest.TestCase):
    def test_three_distinct_zones_fit_the_canvas(self):
        polygons = zone_polygons(900, 400)
        self.assertEqual(set(polygons), {'fenetres', 'agents', 'taches'})
        for polygon in polygons.values():
            self.assertEqual(len(polygon), 4)
            for x, y in polygon:
                self.assertTrue(0 <= x <= 900)
                self.assertTrue(0 <= y <= 400)
        self.assertNotEqual(polygons['fenetres'], polygons['taches'])

    def test_selection_describes_placeholder_without_inventing_connections(self):
        host = WinmapHost.__new__(WinmapHost)
        host.heading, host.description = FakeValue(), FakeValue()
        for key, (title, description) in ZONES.items():
            host.select(key)
            self.assertEqual(host.heading.value, title)
            self.assertEqual(host.description.value, description)
            self.assertIn('pour le moment', description)

    def test_close_destroys_only_own_window(self):
        host = WinmapHost.__new__(WinmapHost)
        host.root = FakeRoot()
        host.close()
        self.assertTrue(host.root.destroyed)


if __name__ == '__main__':
    unittest.main()
