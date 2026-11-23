import os
import subprocess
import unittest
from types import SimpleNamespace
from unittest.mock import call, patch

import camo_device


@unittest.skipUnless(os.name == 'nt', 'Sélection de caméra Windows')
class CamoDeviceTests(unittest.TestCase):
    def test_selects_camo_by_name_even_when_camera_zero_is_unrelated(self):
        devices = [SimpleNamespace(name='Autre caméra', index=0), SimpleNamespace(name='Camo', index=2)]
        with patch.object(camo_device, '_list_devices', return_value=devices) as listing:
            self.assertEqual(camo_device.resolve_camo(), (2, 'msmf'))
        listing.assert_called_once_with('msmf')

    def test_secondary_backend_uses_its_own_index(self):
        with patch.object(camo_device, '_list_devices',
                          side_effect=[[], [SimpleNamespace(name='Reincubate Camo', index=3)]]) as listing:
            self.assertEqual(camo_device.resolve_camo(), (3, 'dshow'))
        self.assertEqual(listing.call_args_list, [call('msmf'), call('dshow')])

    def test_ambiguous_name_or_missing_camera_fails_closed(self):
        duplicate = [SimpleNamespace(name='Camo', index=i) for i in (2, 3)]
        with patch.object(camo_device, '_list_devices', return_value=duplicate) as listing:
            with self.assertRaisesRegex(camo_device.CamoDeviceError, 'Plusieurs'):
                camo_device.resolve_camo()
        listing.assert_called_once()
        with patch.object(camo_device, '_list_devices', return_value=[SimpleNamespace(name='Camomile', index=0)]):
            with self.assertRaisesRegex(camo_device.CamoDeviceError, 'introuvable'):
                camo_device.resolve_camo()

    def test_launch_statuses_and_unavailable_start_menu(self):
        for status, expected in [(0, False), (10, True)]:
            with self.subTest(status=status), patch.object(subprocess, 'run', return_value=SimpleNamespace(returncode=status)):
                self.assertIs(camo_device.ensure_camo_studio(), expected)
        with patch.object(subprocess, 'run', return_value=SimpleNamespace(returncode=2)):
            with self.assertRaisesRegex(camo_device.CamoDeviceError, 'Démarrer'):
                camo_device.ensure_camo_studio()


if __name__ == '__main__':
    unittest.main()
