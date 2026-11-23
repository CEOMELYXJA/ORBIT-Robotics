import unittest
from pathlib import Path
from unittest.mock import patch, Mock
import tkinter as tk

import spatial_launcher
from centre_orbit import OrbitCenter


class SpatialLauncherTests(unittest.TestCase):
    def make_center(self):
        root = tk.Tk()
        root.attributes('-alpha', 0)
        self.addCleanup(root.destroy)
        with patch.object(OrbitCenter, 'refresh'):
            center = OrbitCenter(root)
        root.update()
        return center

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
        center = self.make_center()
        center.space = Mock()
        center.space.status = 'ready'
        with patch('spatial_webview.SpatialWebView') as launch:
            center.open_space()
        launch.assert_not_called()

    def test_earth_entry_opens_same_local_cockpit(self):
        with patch.object(Path, 'is_file', return_value=True):
            normal = spatial_launcher.spatial_command(Path('edge'))
            earth = spatial_launcher.spatial_command(Path('edge'), earth=True)
        self.assertEqual(earth, [arg + '#terre' if arg.startswith('--app=') else arg for arg in normal])

    def test_center_launches_spatial_view(self):
        center = self.make_center()
        with patch('spatial_webview.SpatialWebView') as launch:
            launch.return_value.status = 'ready'
            center.open_space()
        self.assertIs(center.space, launch.return_value)
        launch.return_value.open.assert_called_once_with(earth=False)

    def test_open_both_starts_space_and_tracking_when_closed(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.open_space, center.open_tracking = Mock(), Mock()
        with patch('centre_orbit.orbit_window_open', return_value=False):
            center.open_both()
        center.open_space.assert_called_once_with(together=True)
        center.open_tracking.assert_called_once()

    def test_open_both_integrates_existing_standalone_tracking(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.child = None
        center.open_space, center.open_tracking = Mock(), Mock()
        with patch('centre_orbit.orbit_window_open', return_value=True):
            center.open_both()
        center.open_space.assert_called_once_with(together=True)
        center.open_tracking.assert_called_once()

    def test_existing_standalone_closes_before_embedded_relaunch(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.child, center.notice, center.root, center.status = None, None, Mock(), Mock()
        with patch('centre_orbit.orbit_window_open', return_value=True), \
             patch('centre_orbit.EmbeddedPreview.close_existing_tracking', return_value=True) as close, \
             patch.object(center, 'launch') as launch:
            center.open_tracking()
        close.assert_called_once()
        launch.assert_not_called()
        center.root.after.assert_called_once()


if __name__ == '__main__':
    unittest.main()
