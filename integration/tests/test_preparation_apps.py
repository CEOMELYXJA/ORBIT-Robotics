import unittest
from unittest.mock import Mock, patch
from preparation.applications_windows import ApplicationLauncher


class PreparedAppsTests(unittest.TestCase):
    def setUp(self):
        self.runner = Mock()

    def test_disabled_and_unknown_actions_do_not_launch(self):
        app = ApplicationLauncher(runner=self.runner)
        self.assertFalse(app.open('calculatrice', user_requested=True).ok)
        self.assertFalse(app.open(r'C:\unknown.exe', user_requested=True).ok)
        self.runner.assert_not_called()

    def test_enabled_still_requires_explicit_action(self):
        app = ApplicationLauncher(enabled=True, runner=self.runner)
        self.assertFalse(app.open('calculatrice').ok)
        self.runner.assert_not_called()

    def test_fixed_application_uses_no_shell(self):
        app = ApplicationLauncher(enabled=True, runner=self.runner)
        with patch('preparation.applications_windows.os.name', 'nt'):
            result = app.open('calculatrice', user_requested=True)
        self.assertTrue(result.ok)
        self.runner.assert_called_once_with([r'C:\Windows\System32\calc.exe'], shell=False, close_fds=True)

    def test_error_is_reported_and_path_is_restricted(self):
        app = ApplicationLauncher(enabled=True, runner=Mock(side_effect=OSError()))
        with patch('preparation.applications_windows.os.name', 'nt'):
            self.assertFalse(app.open('bloc_notes', user_requested=True).ok)
        with self.assertRaises(ValueError):
            ApplicationLauncher(windows_directory=r'C:\Windows-alternative')


if __name__ == '__main__':
    unittest.main()

