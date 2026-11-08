import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'spatial'


class SpatialSafetyTests(unittest.TestCase):
    def test_disk_operations_and_imports_fail_before_original_code(self):
        source = (ROOT / 'app.js').read_text(encoding='utf-8')
        for name in ('openFilePreview', 'refreshConnectedRoot', 'copyEntry',
                     'moveOnDisk', 'importDirectoryHandle', 'importFromFallback',
                     'finishExternalDrop', 'copyExternalDropToDestination'):
            self.assertRegex(source, rf'async function {name}\([^)]*\) \{{\s*throw new Error\(')
        self.assertRegex(source, r'async function restoreConnectedHandles\(\) \{\s*return;')
        self.assertNotIn("navigator.serviceWorker.register", source)

    def test_page_disallows_network_connections(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertIn("connect-src 'none'", html)


if __name__ == '__main__':
    unittest.main()

