import unittest
from safety import SafetyGuard


class Controller:
    def __init__(self):
        self.paused = True
        self.stops = 0
        self.updates = []
    def start(self): self.paused = False
    def stop(self): self.paused = True; self.stops += 1
    def update(self, points): self.updates.append(points); return 'ok'


class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.key = False
        self.controller = Controller()
        self.guard = SafetyGuard(self.controller, lambda: self.key, lambda: self.now, timeout=2)

    def test_global_emergency_stops(self):
        self.guard.toggle()
        self.key = True
        self.guard.check()
        self.assertTrue(self.controller.paused)
        self.assertEqual(self.controller.stops, 1)

    def test_stalled_camera_stops(self):
        self.guard.toggle()
        self.now = 2.1
        self.guard.check()
        self.assertTrue(self.controller.paused)

    def test_frame_refresh_and_lost_hand_forwarded(self):
        self.guard.toggle()
        self.now = 1.9
        self.assertEqual(self.guard.frame(None), 'ok')
        self.now = 3
        self.guard.check()
        self.assertFalse(self.controller.paused)
        self.assertEqual(self.controller.updates, [None])

    def test_shutdown_pauses(self):
        self.guard.toggle()
        self.guard.close()
        self.assertTrue(self.controller.paused)

    def test_cannot_resume_while_emergency_key_held(self):
        self.key = True
        self.assertFalse(self.guard.toggle())
        self.assertTrue(self.controller.paused)

    def test_cannot_resume_after_monitor_fault_or_shutdown(self):
        self.guard.error = 'monitor fault'
        self.assertFalse(self.guard.toggle())
        self.assertTrue(self.controller.paused)
        self.guard.error = None
        self.guard.close()
        self.assertFalse(self.guard.toggle())
        self.assertTrue(self.controller.paused)

if __name__ == '__main__': unittest.main()


