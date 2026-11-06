"""Tests sans souris ni caméra réelles : python -m unittest discover -s tests -v"""
import unittest
from mouse_core import MouseController


class FakeMouse:
    def __init__(self): self.events=[]
    def moveRel(self,*a,**k): self.events.append(("move",a))
    def click(self,**kw): self.events.append(("click",kw["button"]))
    def mouseDown(self,**kw): self.events.append(("down",kw["button"]))
    def mouseUp(self,**kw): self.events.append(("up",kw["button"]))
    def scroll(self,n): self.events.append(("scroll",n))


class TestController(unittest.TestCase):
    def setUp(self):
        self.time=[1.0]
        self.mouse=FakeMouse()
        self.c=MouseController(self.mouse,lambda:self.time[0])

    def test_initial_pause(self):
        self.assertFalse(self.c.dispatch({"type":"click","button":"left"}))
        self.assertEqual(self.mouse.events, [])

    def test_click_and_scroll(self):
        self.c.dispatch({"type":"resume"})
        self.c.dispatch({"type":"click","button":"left"})
        self.c.dispatch({"type":"scroll","steps":2})
        self.assertEqual(self.mouse.events,[("click","left"),("scroll",2)])

    def test_bounds_and_nan_rejected(self):
        self.c.dispatch({"type":"resume"})
        self.time[0]+=0.1
        self.assertFalse(self.c.dispatch({"type":"move","dx":"bad","dy":1}))
        self.assertFalse(self.c.dispatch({"type":"move","dx":float("nan"),"dy":1}))
        self.assertTrue(self.c.dispatch({"type":"move","dx":1000,"dy":-1000}))
        self.assertEqual(self.mouse.events[-1],("move",(55,-55)))

    def test_drag_released_by_pause(self):
        self.c.dispatch({"type":"resume"})
        self.c.dispatch({"type":"button","button":"left","down":True})
        self.c.dispatch({"type":"pause"})
        self.assertEqual(self.mouse.events,[("down","left"),("up","left")])
        self.assertTrue(self.c.paused)

    def test_watchdog_releases(self):
        self.c.dispatch({"type":"resume"})
        self.c.dispatch({"type":"button","button":"left","down":True})
        self.time[0]+=2
        self.assertTrue(self.c.watchdog())
        self.assertIn(("up","left"),self.mouse.events)

    def test_disallow_unknown_actions_and_bad_buttons(self):
        self.c.dispatch({"type":"resume"})
        self.assertFalse(self.c.dispatch({"type":"exec","cmd":"powershell"}))
        self.assertFalse(self.c.dispatch({"type":"button","button":"middle","down":True}))
        self.assertFalse(self.c.dispatch({"type":"button","button":"left","down":1}))
        self.assertEqual(self.mouse.events, [])


if __name__=="__main__": unittest.main()

