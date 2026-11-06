import unittest
import cv2
import mediapipe as mp
import numpy as np


class VisionTests(unittest.TestCase):
    def test_real_model_accepts_blank_simulated_camera_frame(self):
        image = np.zeros((120, 160, 3), dtype=np.uint8)
        with mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=2) as hands:
            result = hands.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        self.assertIsNone(result.multi_hand_landmarks)

if __name__ == '__main__': unittest.main()

