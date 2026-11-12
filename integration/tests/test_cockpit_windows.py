import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock

import cockpit_windows as cockpit


def entry():
    return {'name': 'Atelier', 'title': 'Fenêtre test ORBIT', 'window_class': 'TestClass',
            'rect': [-1600, 20, 800, 600], 'point': [250, 350]}


class CockpitMemoryTests(unittest.TestCase):
    def test_positions_persist_and_previous_versions_are_retained(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            first = cockpit.save_state([entry()], folder)
            changed = entry(); changed['point'] = [800, 200]
            second = cockpit.save_state([changed], folder)
            self.assertNotEqual(first, second)
            self.assertEqual(json.loads(first.read_text(encoding='utf-8'))['entries'][0]['point'], [250, 350])
            self.assertEqual(cockpit.load_state(folder), [changed])

    def test_bad_latest_state_stays_intact_and_is_not_silently_replaced(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            cockpit.save_state([entry()], folder)
            bad = folder / 'cockpit_99999999999999999999.json'
            bad.write_text('{', encoding='utf-8')
            with self.assertRaises(json.JSONDecodeError): cockpit.load_state(folder)
            self.assertEqual(bad.read_text(encoding='utf-8'), '{')

    def test_invalid_coordinates_are_rejected(self):
        item = entry(); item['rect'][2] = -1
        with TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError): cockpit.save_state([item], Path(tmp))
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_window_match_requires_unique_title_and_class(self):
        api = cockpit.WindowsAPI.__new__(cockpit.WindowsAPI)
        api.windows = Mock(return_value=[{'handle': 1, 'title': 'T', 'window_class': 'A'},
                                         {'handle': 2, 'title': 'T', 'window_class': 'B'}])
        self.assertEqual(api.unique('T', 'A')['handle'], 1)
        with self.assertRaises(ValueError): api.unique('missing', 'A')
        api.windows.return_value.append({'handle': 3, 'title': 'T', 'window_class': 'A'})
        with self.assertRaises(ValueError): api.unique('T', 'A')

    def test_restore_revalidates_and_uses_negative_monitor_coordinates(self):
        api = cockpit.WindowsAPI.__new__(cockpit.WindowsAPI)
        api.unique = Mock(return_value={'handle': 42})
        api.user = Mock()
        api.user.IsIconic.return_value = 0
        api.user.IsZoomed.return_value = 0
        api.user.SetWindowPos.return_value = 1
        api.restore(entry())
        api.unique.assert_called_once_with('Fenêtre test ORBIT', 'TestClass')
        api.user.SetWindowPos.assert_called_once_with(42, None, -1600, 20, 800, 600, 0x0014)


if __name__ == '__main__': unittest.main()
