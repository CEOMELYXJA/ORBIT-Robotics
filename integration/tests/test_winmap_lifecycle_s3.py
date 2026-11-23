"""Tests de cycles existants sans démarrer ni arrêter de processus réels.

Le lanceur Winmap ouvre une fenêtre Edge séparée; ces tests ne prouvent pas
que sa fermeture libère toutes les ressources, ni que le shell est intact.
"""
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import centre_orbit
import spatial_launcher
from winmap_host import WinmapHost


class SpatialLaunchFailureTests(unittest.TestCase):
    def test_missing_edge_does_not_launch_any_process(self):
        with patch.object(spatial_launcher, 'find_edge', return_value=None), \
             patch.object(spatial_launcher.subprocess, 'Popen') as spawn:
            with self.assertRaises(FileNotFoundError):
                spatial_launcher.launch_spatial()
        spawn.assert_not_called()

    def test_spawn_error_is_reported_and_no_process_is_stored(self):
        import tkinter as tk
        root = tk.Tk()
        root.attributes('-alpha', 0)
        try:
            with patch.object(centre_orbit.OrbitCenter, 'refresh'):
                center = centre_orbit.OrbitCenter(root)
            root.update()
            with patch('spatial_webview.SpatialWebView') as launch:
                launch.return_value.open.side_effect = OSError('échec contrôlé')
                center.open_space()
            self.assertIsNone(center.space)
            self.assertIn('échec contrôlé', center.spatial_status.get())
            launch.return_value.close.assert_called_once()
        finally:
            root.destroy()

    def test_spawn_exception_is_not_hidden_by_launcher(self):
        with patch.object(spatial_launcher, 'find_edge', return_value=Path('edge.exe')), \
             patch.object(spatial_launcher, 'spatial_command', return_value=['edge.exe']), \
             patch.object(spatial_launcher.subprocess, 'Popen', side_effect=OSError('échec contrôlé')):
            with self.assertRaisesRegex(OSError, 'échec contrôlé'):
                spatial_launcher.launch_spatial()


class SimulatedClosureTests(unittest.TestCase):
    def test_legacy_preview_close_only_calls_own_root_destroy(self):
        host = WinmapHost.__new__(WinmapHost)
        host.root = Mock()
        host.close()
        host.root.destroy.assert_called_once_with()

    def test_center_close_without_tracking_destroys_own_root(self):
        center = centre_orbit.OrbitCenter.__new__(centre_orbit.OrbitCenter)
        center.root, center.status = Mock(), Mock()
        center.closing, center.child = False, None
        with patch.object(centre_orbit.subprocess, 'Popen') as spawn:
            center.close()
        center.root.destroy.assert_called_once_with()
        spawn.assert_not_called()

    def test_center_waits_for_tracking_exit_without_forcing_termination(self):
        center = centre_orbit.OrbitCenter.__new__(centre_orbit.OrbitCenter)
        center.root, center.status, center.embedded = Mock(), Mock(), Mock()
        center.closing, center.child = False, Mock()
        center.child.poll.side_effect = [None, 0]
        center.close()
        center.embedded.request_close.assert_called_once_with()
        center.root.destroy.assert_not_called()
        callback = center.root.after.call_args.args[1]
        callback()
        center.root.destroy.assert_called_once_with()
        center.child.terminate.assert_not_called()
        center.child.kill.assert_not_called()

    def test_controlled_close_error_preserves_open_root_after_timeout(self):
        center = centre_orbit.OrbitCenter.__new__(centre_orbit.OrbitCenter)
        center.root, center.status, center.embedded = Mock(), Mock(), Mock()
        center.closing, center.child = True, Mock()
        center.child.poll.return_value = None
        center.embedded.request_close.side_effect = OSError('erreur contrôlée')
        center.wait_for_tracking_close(50)
        self.assertFalse(center.closing)
        center.root.destroy.assert_not_called()
        center.child.terminate.assert_not_called()
        center.child.kill.assert_not_called()
        center.status.set.assert_called_once()


if __name__ == '__main__':
    unittest.main()
