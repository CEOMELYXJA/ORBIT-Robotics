"""Aller-retour des quatre exports sur des images et 21 points fabriqués."""
import csv
from contextlib import ExitStack
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch

import cv2
import numpy as np
from mediapipe.framework.formats import classification_pb2, landmark_pb2

import orbit_integrated as orbit
from dataset_validator import validate_streams


class SyntheticRecordingTests(unittest.TestCase):
    def test_record_and_read_back_synthetic_frames_and_points(self):
        landmarks = landmark_pb2.NormalizedLandmarkList()
        for i in range(21):
            landmarks.landmark.add(x=.2 + i / 50, y=.4, z=0)
        side = classification_pb2.ClassificationList()
        side.classification.add(label='Left', score=.99)
        fake_detector = MagicMock()
        fake_detector.__enter__.return_value.process.return_value = SimpleNamespace(
            multi_hand_landmarks=[landmarks], multi_handedness=[side])
        capture = Mock()
        capture.isOpened.return_value = True
        capture.get.return_value = 30
        capture.read.side_effect = lambda: (True, np.full((64, 96, 3), 40, np.uint8))

        with TemporaryDirectory(prefix='orbit-test-synthetique-') as directory:
            with ExitStack() as stack:
                stack.enter_context(patch.object(orbit, 'OUTPUT', Path(directory)))
                stack.enter_context(patch.object(orbit, 'start_mouse_guard', return_value=None))
                stack.enter_context(patch.object(sys, 'argv', ['orbit']))
                stack.enter_context(patch.object(cv2, 'VideoCapture', return_value=capture))
                stack.enter_context(patch.object(orbit.mp.solutions.hands, 'Hands', return_value=fake_detector))
                for name in ('imshow', 'setMouseCallback', 'destroyAllWindows'):
                    stack.enter_context(patch.object(cv2, name))
                stack.enter_context(patch.object(cv2, 'getWindowProperty', return_value=1))
                stack.enter_context(patch.object(cv2, 'waitKey', side_effect=[ord('r'), 255, ord('r'), ord('q')]))
                self.assertEqual(orbit.main(), 0)
            capture.release.assert_called_once()
            folder, = Path(directory).iterdir()
            meta = json.loads((folder / 'metadata.json').read_text(encoding='utf-8'))
            with (folder / 'points.csv').open(encoding='utf-8', newline='') as points, \
                    (folder / 'images.jsonl').open(encoding='utf-8') as images:
                result = validate_streams(meta, images, csv.DictReader(points))
            self.assertTrue(result['valide'], result['erreurs'])
            self.assertEqual((result['images'], result['points']), (2, 42))
            reader = cv2.VideoCapture(str(folder / 'video.mp4'))
            try:
                for _ in range(result['images']):
                    ok, image = reader.read()
                    self.assertTrue(ok)
                    self.assertEqual(image.shape, (64, 96, 3))
                self.assertFalse(reader.read()[0])
            finally:
                reader.release()
