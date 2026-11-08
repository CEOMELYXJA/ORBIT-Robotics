import unittest
from pathlib import Path
from unittest.mock import patch, Mock

import spatial_launcher
from centre_orbit import OrbitCenter


class SpatialLauncherTests(unittest.TestCase):
    def test_missing_spatial_files_report_error(self):
        with patch.object(Path, 'is_file', return_value=False):
            with self.assertRaises(FileNotFoundError):
                spatial_launcher.spatial_command(Path('edge'), Path.cwd())

    def test_command_uses_local_app_and_separate_profile(self):
        root = Path.cwd()
        with patch.object(Path, 'is_file', return_value=True):
            command = spatial_launcher.spatial_command(Path('edge'), root)
        self.assertIn('--app=' + (root / 'spatial' / 'index.html').as_uri(), command)
        self.assertIn('--user-data-dir=' + str(root / '.orbit-spatial-profile'), command)

    def test_center_reuses_open_spatial_process(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.space = Mock()
        center.space.poll.return_value = None
        center.status = Mock()
        with patch('centre_orbit.launch_spatial') as launch:
            center.open_space()
        launch.assert_not_called()

    def test_center_launches_spatial_view(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.space = None
        center.status = Mock()
        with patch('centre_orbit.launch_spatial') as launch:
            center.open_space()
        self.assertIs(center.space, launch.return_value)


if __name__ == '__main__':
    unittest.main()

