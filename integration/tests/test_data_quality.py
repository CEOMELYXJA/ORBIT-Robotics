import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch
from data_quality import summarise, main


def line(index, time, hands):
    return json.dumps({'image': index, 'temps_secondes': time, 'mains': hands})


class QualityTests(unittest.TestCase):
    def test_aggregate_quality_without_exposing_points(self):
        result = summarise([line(0, 0, []), line(1, .1, [{}]), line(2, .5, [{}])])
        self.assertEqual(result['images'], 3)
        self.assertEqual(result['images_avec_main'], 2)
        self.assertEqual(result['cadence_moyenne_images_s'], 4.)
        self.assertEqual(result['interruptions_superieures_au_seuil'], 1)
        self.assertNotIn('points', result)

    def test_single_frame_has_no_invented_fps(self):
        self.assertIsNone(summarise([line(0, 0, [])])['cadence_moyenne_images_s'])

    def test_empty_invalid_and_reversed_time_rejected(self):
        for lines in ([], ['{'], [line(1, 0, [])], [line(0, 1, []), line(1, .5, [])]):
            with self.assertRaises(ValueError): summarise(lines)

    def test_boolean_time_and_bad_gap_rejected(self):
        with self.assertRaises(ValueError): summarise([line(0, True, [])])
        with self.assertRaises(ValueError): summarise([line(0, 0, [])], float('nan'))

    def test_cli_opens_only_jsonl(self):
        opened = []
        def fake_open(path, *args, **kwargs):
            opened.append(path.name)
            return io.StringIO(line(0, 0, []))
        with patch.object(Path, 'open', fake_open), patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(main(['fictif']), 0)
        self.assertEqual(opened, ['images.jsonl'])

if __name__ == '__main__': unittest.main()

