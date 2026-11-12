"""Aperçu local d'une surface de projection ; aucun projecteur n'est requis."""
import math
import tkinter as tk


def targets(width, height):
    """Return four synthetic corners on a drawable rectangular surface."""
    if width <= 0 or height <= 0:
        raise ValueError('La surface doit avoir une taille positive.')
    return [(width * .12, height * .16), (width * .88, height * .16),
            (width * .88, height * .84), (width * .12, height * .84)]


class TargetSequence:
    """Track target clicks without collecting or saving hand/camera data."""
    def __init__(self):
        self.next_index = 0

    def click(self, x, y, width, height):
        points = targets(width, height)
        if self.next_index >= len(points):
            return False
        cx, cy = points[self.next_index]
        radius = max(18, min(width, height) * .045)
        if math.hypot(x - cx, y - cy) > radius:
            return False
        self.next_index += 1
        return True


class ProjectionPreview:
    def __init__(self, root):
        self.root = root
        self.sequence = TargetSequence()
        root.title('ORBIT — aperçu de surface')
        root.geometry('900x650')
        root.minsize(560, 430)
        root.configure(bg='#0c1726')
        root.bind('<Escape>', lambda _event: root.destroy())
        tk.Label(root, text='Aperçu de projection', font=('Segoe UI', 20, 'bold'),
                 bg='#0c1726', fg='white').pack(anchor='w', padx=20, pady=(12, 0))
        tk.Label(root, text='Simulation sur cet écran : aucun projecteur ni caméra requis.',
                 font=('Segoe UI', 10), bg='#0c1726', fg='#bcd4e2').pack(anchor='w', padx=20)
        self.status = tk.StringVar(value='Clique sur les quatre cibles vertes, dans l’ordre.')
        tk.Label(root, textvariable=self.status, font=('Segoe UI', 10, 'bold'),
                 bg='#0c1726', fg='#91e5c6').pack(anchor='w', padx=20, pady=(6, 4))
        self.canvas = tk.Canvas(root, bg='#08111b', highlightthickness=1,
                                highlightbackground='#4f7281')
        self.canvas.pack(fill='both', expand=True, padx=20, pady=5)
        self.canvas.bind('<Configure>', self.draw)
        self.canvas.bind('<Button-1>', self.on_click)
        controls = tk.Frame(root, bg='#0c1726')
        controls.pack(fill='x', padx=20, pady=(5, 12))
        tk.Button(controls, text='Recommencer', command=self.reset, padx=12, pady=4).pack(side='left')
        tk.Button(controls, text='Fermer', command=root.destroy, padx=12, pady=4).pack(side='right')
        self.draw()

    def draw(self, _event=None):
        c = self.canvas
        c.delete('grid')
        w, h = c.winfo_width(), c.winfo_height()
        if w <= 1 or h <= 1:
            return
        for i in range(1, 10):
            c.create_line(w * i / 10, 0, w * i / 10, h, fill='#1d3440', tags='grid')
        for i in range(1, 8):
            c.create_line(0, h * i / 8, w, h * i / 8, fill='#1d3440', tags='grid')
        r = max(18, min(w, h) * .045)
        for index, (x, y) in enumerate(targets(w, h)):
            color = '#66e0ae' if index == self.sequence.next_index else '#637b83'
            c.create_oval(x-r, y-r, x+r, y+r, outline=color, width=3, tags='grid')
            c.create_text(x, y, text=str(index + 1), fill=color,
                          font=('Segoe UI', 14, 'bold'), tags='grid')

    def on_click(self, event):
        w, h = self.canvas.winfo_width(), self.canvas.winfo_height()
        if self.sequence.click(event.x, event.y, w, h):
            if self.sequence.next_index == 4:
                self.status.set('Quatre cibles atteintes dans la simulation.')
            else:
                self.status.set(f'Cible atteinte. Prochaine cible : {self.sequence.next_index + 1}.')
            self.draw()

    def reset(self):
        self.sequence = TargetSequence()
        self.status.set('Clique sur les quatre cibles vertes, dans l’ordre.')
        self.draw()


def main():
    root = tk.Tk()
    ProjectionPreview(root)
    root.mainloop()


if __name__ == '__main__':
    main()
