"""Choose a stable hand without relying on MediaPipe's list order."""


class HandSelector:
    def __init__(self):
        self.label = None
        self.lost = True

    def select(self, hands, handedness):
        """Return (landmarks, changed); ambiguous multiple hands yield no input."""
        hands = hands or []
        if not hands:
            self.lost = True
            return None, False
        if not handedness or len(handedness) != len(hands):
            self.lost = True
            return None, False
        try:
            labels = [item.classification[0].label for item in handedness]
        except (AttributeError, IndexError):
            self.lost = True
            return None, False
        if len(hands) == 1:
            index = 0
        elif self.label is not None and labels.count(self.label) == 1:
            index = labels.index(self.label)
        elif len(set(labels)) == len(labels):
            index = 0
        else:
            self.lost = True
            return None, False
        changed = self.lost or (self.label is not None and self.label != labels[index])
        self.label = labels[index]
        self.lost = False
        return hands[index].landmark, changed

