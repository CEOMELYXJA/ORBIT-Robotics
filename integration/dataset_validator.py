"""Validate an explicitly selected ORBIT session without opening its video.

The library accepts in-memory streams so its rules can be tested without
accessing anyone's recordings. The CLI does not modify the selected session.
"""
import argparse
import csv
import json
import math
from pathlib import Path

CSV_COLUMNS = {'image', 'temps_secondes', 'main', 'confiance', 'point', 'x', 'y', 'z'}


def validate_streams(metadata, json_lines, csv_rows):
    errors = []
    rows = iter(csv_rows)
    frames = points = 0
    last_time = -1.0

    def error(message):
        if len(errors) < 50:
            errors.append(message)

    if not isinstance(metadata, dict):
        metadata = {}
        error('Métadonnées invalides')
    for key in ('largeur', 'hauteur'):
        value = metadata.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            error(f'Métadonnée invalide : {key}')

    for number, line in enumerate(json_lines, 1):
        try:
            record = json.loads(line)
            frame = record['image']
            timestamp = float(record['temps_secondes'])
            hands = record['mains']
            if isinstance(frame, bool) or not isinstance(frame, int) or not math.isfinite(timestamp) or timestamp < 0:
                raise ValueError
            if frame != frames or timestamp < last_time or not isinstance(hands, list):
                error(f'Image {number} : index, temps ou mains incohérents')
            last_time = timestamp
            for hand in hands:
                label, landmarks = hand['main'], hand['points']
                confidence = float(hand['confiance'])
                if not math.isfinite(confidence) or not 0 <= confidence <= 1:
                    raise ValueError
                if not isinstance(label, str) or not isinstance(landmarks, list):
                    raise ValueError
                ids = []
                for point in landmarks:
                    point_id = point['id']
                    if isinstance(point_id, bool) or not isinstance(point_id, int):
                        raise ValueError
                    xyz = tuple(float(point[axis]) for axis in ('x', 'y', 'z'))
                    if not all(math.isfinite(value) for value in xyz):
                        raise ValueError
                    ids.append(point_id)
                    row = next(rows, None)
                    if row is None:
                        error('Le CSV contient moins de points que les images JSONL')
                    else:
                        try:
                            csv_values = (int(row['image']), row['main'], int(row['point']),
                                          *(float(row[k]) for k in ('temps_secondes', 'confiance', 'x', 'y', 'z')))
                            expected_values = (frame, label, point_id, timestamp, confidence, *xyz)
                            if csv_values != expected_values:
                                error('Un point CSV ne correspond pas au point JSONL attendu')
                        except (KeyError, TypeError, ValueError, OverflowError):
                            error('Une ligne CSV contient des données invalides')
                    points += 1
                if sorted(ids) != list(range(21)):
                    error(f'Image {number} : une main ne contient pas les 21 points attendus')
            frames += 1
        except (KeyError, TypeError, ValueError, json.JSONDecodeError, OverflowError):
            error(f'Image {number} : données invalides')

    if next(rows, None) is not None:
        error('Le CSV contient plus de points que les images JSONL')
    count = metadata.get('images')
    if count is not None and (isinstance(count, bool) or not isinstance(count, int) or count != frames):
        error('Le nombre d’images diffère des métadonnées')
    if frames == 0:
        error('Aucune image dans les données')
    return {'valide': not errors, 'images': frames, 'points': points, 'erreurs': errors}


def main(argv=None):
    parser = argparse.ArgumentParser(description='Vérifier les données d’une session ORBIT sans ouvrir sa vidéo.')
    parser.add_argument('session', type=Path, help='Dossier de session choisi explicitement')
    args = parser.parse_args(argv)
    try:
        with (args.session / 'metadata.json').open(encoding='utf-8') as meta_file, \
             (args.session / 'images.jsonl').open(encoding='utf-8') as frames_file, \
             (args.session / 'points.csv').open(encoding='utf-8', newline='') as points_file:
            rows = csv.DictReader(points_file)
            if rows.fieldnames is None or not CSV_COLUMNS.issubset(rows.fieldnames):
                raise ValueError('En-tête CSV incomplet')
            result = validate_streams(json.load(meta_file), frames_file, rows)
    except (OSError, ValueError, UnicodeError) as exc:
        print(json.dumps({'valide': False, 'erreur': type(exc).__name__}, ensure_ascii=False))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['valide'] else 1


if __name__ == '__main__':
    raise SystemExit(main())

