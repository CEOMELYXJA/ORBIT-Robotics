import unittest
from unittest.mock import Mock, patch
from centre_orbit import OrbitCenter, start_tracking


class CenterTests(unittest.TestCase):
    def test_does_not_open_second_camera_if_window_already_exists(self):
        launch = Mock()
        status, process = start_tracking(lambda: True, None, launch)
        self.assertEqual(status, 'already_open')
        self.assertIsNone(process)
        launch.assert_not_called()

    def test_does_not_duplicate_a_process_still_starting(self):
        process = Mock()
        process.poll.return_value = None
        launch = Mock()
        status, result = start_tracking(lambda: False, process, launch)
        self.assertEqual(status, 'already_open')
        self.assertIs(result, process)
        launch.assert_not_called()

    def test_starts_when_not_running(self):
        process = Mock()
        status, result = start_tracking(lambda: False, None, lambda: process)
        self.assertEqual(status, 'started')
        self.assertIs(result, process)

    def test_camera_diagnostic_does_not_start_while_orbit_is_open(self):
        center = OrbitCenter.__new__(OrbitCenter)
        center.diagnostic = None
        center.child = None
        with patch('centre_orbit.orbit_window_open', return_value=True), \
             patch('centre_orbit.messagebox.showinfo'), \
             patch('centre_orbit.subprocess.Popen') as launch:
            center.run_diagnostic(with_camera=True)
        launch.assert_not_called()

if __name__ == '__main__': unittest.main()
