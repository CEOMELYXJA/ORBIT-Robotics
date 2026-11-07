import io
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch
import diagnostic


class DiagnosticTests(unittest.TestCase):
    def test_timeout_is_reported_without_exposing_output_as_success(self):
        with patch.object(diagnostic.subprocess, 'run', side_effect=subprocess.TimeoutExpired('test', 1)):
            result = diagnostic.run_command(['test'], timeout=1)
        self.assertIsNone(result['code'])
        self.assertTrue(result['sortie'].startswith('TimeoutExpired:'))

    def test_default_does_not_open_camera_and_writes_a_report(self):
        report = {}
        def capture(_path, content, **kwargs):
            report['content'] = content
        with patch('sys.argv', ['diagnostic']), patch.object(Path, 'is_dir', return_value=True), \
             patch.object(Path, 'glob', return_value=iter([Path('test_fictif.py')])), \
             patch.object(Path, 'mkdir'), patch.object(Path, 'write_text', capture), \
             patch.object(diagnostic, 'run_command', return_value={'code': 0, 'sortie': 'OK'}), \
             patch.object(diagnostic, 'camera_check') as camera, \
             patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(diagnostic.main(), 0)
        camera.assert_not_called()
        self.assertIn('Non exécuté : préciser --camera.', report['content'])

    def test_missing_tests_cannot_report_success(self):
        with patch('sys.argv', ['diagnostic']), patch.object(Path, 'is_dir', return_value=False), \
             patch.object(Path, 'mkdir'), patch.object(Path, 'write_text'), \
             patch.object(diagnostic, 'run_command', return_value={'code': 0, 'sortie': 'OK'}), \
             patch('sys.stdout', new_callable=io.StringIO):
            self.assertNotEqual(diagnostic.main(), 0)

    def test_test_timeout_is_incomplete_and_returns_nonzero(self):
        commands = [{'code': None, 'sortie': 'TimeoutExpired: test'}, {'code': 0, 'sortie': 'OK'}]
        with patch('sys.argv', ['diagnostic']), patch.object(Path, 'is_dir', return_value=True), \
             patch.object(Path, 'glob', return_value=iter([Path('test_fictif.py')])), \
             patch.object(Path, 'mkdir'), patch.object(Path, 'write_text'), \
             patch.object(diagnostic, 'run_command', side_effect=commands), \
             patch('sys.stdout', new_callable=io.StringIO) as output:
            self.assertNotEqual(diagnostic.main(), 0)
            self.assertIn('Tests : incomplets', output.getvalue())

if __name__ == '__main__': unittest.main()

