import json
import io
import csv
import unittest
from pathlib import Path
from unittest.mock import patch
from dataset_validator import validate_streams, main


def sample():
    meta = {'largeur': 640, 'hauteur': 480, 'images': 1, 'fps_video': 30,
            'debut': '2026-11-06T12:00:00+00:00', 'fin': '2026-11-06T12:00:02+00:00'}
    points = [{'id': i, 'x': .5, 'y': .5, 'z': 0} for i in range(21)]
    records = [{'image': 0, 'temps_secondes': 0., 'mains': [{'main': 'Left', 'confiance': .9, 'points': points}]}]
    rows = [{'image': '0', 'temps_secondes': '0', 'main': 'Left', 'confiance': '.9',
             'point': str(i), 'x': '.5', 'y': '.5', 'z': '0'} for i in range(21)]
    return meta, records, rows


def run(meta, records, rows):
    return validate_streams(meta, [json.dumps(r) for r in records], rows)


class DatasetValidatorTests(unittest.TestCase):
    def test_consistent_synthetic_data(self):
        meta, records, rows = sample()
        self.assertEqual(run(meta, records, rows), {'valide': True, 'images': 1, 'points': 21, 'erreurs': []})

    def test_missing_csv_point_is_invalid(self):
        meta, records, rows = sample()
        self.assertFalse(run(meta, records, rows[:-1])['valide'])

    def test_mismatched_coordinate_is_invalid(self):
        meta, records, rows = sample()
        rows[0]['x'] = '.8'
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_reordered_rows_are_rejected(self):
        meta, records, rows = sample()
        rows[0], rows[1] = rows[1], rows[0]
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_missing_landmark_is_invalid(self):
        meta, records, rows = sample()
        records[0]['mains'][0]['points'].pop()
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_nonfinite_point_is_invalid(self):
        meta, records, rows = sample()
        records[0]['mains'][0]['points'][0]['x'] = float('nan')
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_no_hand_frame_can_be_valid(self):
        meta, records, rows = sample()
        records[0]['mains'] = []
        self.assertTrue(run(meta, records, [])['valide'])

    def test_many_empty_frames_can_be_streamed(self):
        frames = (json.dumps({'image': i, 'temps_secondes': i / 30, 'mains': []}) for i in range(2000))
        meta, _, _ = sample()
        meta['images'] = 2000
        result = validate_streams(meta, frames, iter(()))
        self.assertTrue(result['valide'])
        self.assertEqual(result['images'], 2000)

    def test_empty_and_bad_json_rejected(self):
        meta, _, _ = sample()
        self.assertFalse(validate_streams(meta, [], [])['valide'])
        self.assertFalse(validate_streams(meta, ['{'], [])['valide'])

    def test_timestamps_must_not_decrease(self):
        meta, records, rows = sample()
        meta['images'] = 2
        records[0]['temps_secondes'] = 2
        for row in rows: row['temps_secondes'] = '2'
        records.append({'image': 1, 'temps_secondes': 1, 'mains': []})
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_incomplete_session_is_not_valid(self):
        meta, records, rows = sample()
        del meta['fin']
        del meta['images']
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_boolean_coordinates_and_timestamps_are_rejected(self):
        meta, records, rows = sample()
        records[0]['mains'][0]['points'][0]['x'] = True
        self.assertFalse(run(meta, records, rows)['valide'])
        meta, records, rows = sample()
        records[0]['temps_secondes'] = True
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_reversed_dates_are_rejected(self):
        meta, records, rows = sample()
        meta['fin'] = '2026-11-06T11:00:00+00:00'
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_impossible_fps_is_rejected_without_crashing(self):
        meta, records, rows = sample()
        meta['fps_video'] = 10 ** 400
        self.assertFalse(run(meta, records, rows)['valide'])

    def test_cli_reads_only_the_three_data_streams(self):
        meta, records, rows = sample()
        csv_file = io.StringIO(newline='')
        writer = csv.DictWriter(csv_file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        contents = {'metadata.json': json.dumps(meta),
                    'images.jsonl': '\n'.join(json.dumps(r) for r in records),
                    'points.csv': csv_file.getvalue()}
        opened = []
        def fake_open(path, *args, **kwargs):
            opened.append(path.name)
            return io.StringIO(contents[path.name])
        with patch.object(Path, 'open', fake_open), patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(main(['fictif']), 0)
        self.assertEqual(opened, ['metadata.json', 'images.jsonl', 'points.csv'])

    def test_cli_rejects_missing_csv_headers(self):
        meta, records, _ = sample()
        contents = {'metadata.json': json.dumps(meta), 'images.jsonl': json.dumps(records[0]),
                    'points.csv': 'image,point\n0,0\n'}
        with patch.object(Path, 'open', lambda path, *a, **k: io.StringIO(contents[path.name])), \
             patch('sys.stdout', new_callable=io.StringIO):
            self.assertEqual(main(['fictif']), 2)

if __name__ == '__main__': unittest.main()
