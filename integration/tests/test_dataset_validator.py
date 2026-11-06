import json
import unittest
from dataset_validator import validate_streams


def sample():
    meta = {'largeur': 640, 'hauteur': 480, 'images': 1}
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
        result = validate_streams({'largeur': 640, 'hauteur': 480, 'images': 2000}, frames, iter(()))
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

if __name__ == '__main__': unittest.main()

