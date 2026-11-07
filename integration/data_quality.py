"""Summarise explicitly selected ORBIT JSONL data without opening video.

The pure function operates on an iterable, allowing tests without user files.
No file is modified, and raw landmarks are not returned in the summary.
"""
import argparse
import json
import math
from pathlib import Path


def summarise(lines, gap_seconds=.25):
    if not math.isfinite(gap_seconds) or gap_seconds <= 0:
        raise ValueError('Le seuil doit être positif et fini')
    frames = tracked = gaps = 0
    first = previous = None
    longest_gap = 0.0
    for number, line in enumerate(lines, 1):
        try:
            data = json.loads(line)
            index, raw_time, hands = data['image'], data['temps_secondes'], data['mains']
            if (isinstance(index, bool) or not isinstance(index, int) or index != frames
                    or isinstance(raw_time, bool) or not isinstance(hands, list)):
                raise ValueError
            timestamp = float(raw_time)
            if not math.isfinite(timestamp) or timestamp < 0 or (previous is not None and timestamp < previous):
                raise ValueError
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f'Données invalides à la ligne {number}') from exc
        if first is None:
            first = timestamp
        if previous is not None:
            interval = timestamp - previous
            longest_gap = max(longest_gap, interval)
            if interval > gap_seconds:
                gaps += 1
        previous = timestamp
        frames += 1
        tracked += bool(hands)
    if not frames:
        raise ValueError('Aucune image dans les données')
    duration = previous - first
    return {
        'images': frames,
        'images_avec_main': tracked,
        'proportion_avec_main': round(tracked / frames, 4),
        'duree_secondes': round(duration, 3),
        'cadence_moyenne_images_s': round((frames - 1) / duration, 2) if duration > 0 else None,
        'interruptions_superieures_au_seuil': gaps,
        'seuil_interruption_secondes': gap_seconds,
        'plus_long_intervalle_secondes': round(longest_gap, 3),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description='Résumer une session choisie explicitement, sans ouvrir de vidéo.')
    parser.add_argument('session', type=Path, help='Dossier de session choisi explicitement')
    parser.add_argument('--seuil', type=float, default=.25, help='Seuil d’interruption en secondes')
    args = parser.parse_args(argv)
    try:
        with (args.session / 'images.jsonl').open(encoding='utf-8') as stream:
            report = summarise(stream, args.seuil)
    except (OSError, UnicodeError, ValueError, OverflowError) as exc:
        print(json.dumps({'valide': False, 'erreur': type(exc).__name__}, ensure_ascii=False))
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

