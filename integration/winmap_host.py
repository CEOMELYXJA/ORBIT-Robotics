"""WINMAP : aperçu local indépendant des espaces prévus pour ORBIT."""

import tkinter as tk


ZONES = {
    'fenetres': ('Fenêtres', 'Espace prévu pour organiser les fenêtres.\nAucune fenêtre Windows n’est reliée pour le moment.'),
    'agents': ('Agents', 'Espace prévu pour les agents du projet.\nAucun agent réel n’est relié pour le moment.'),
    'taches': ('Tâches', 'Espace prévu pour suivre les tâches.\nAucune liste de tâches réelle n’est reliée pour le moment.'),
}


def zone_polygons(width, height):
    """Return three perspective tiles, with points normalized to the canvas."""
    # Keep the shape inside the drawing area, including at small window sizes.
    w, h = max(float(width), 1.0), max(float(height), 1.0)
    def point(x, y):
        return (round(x * w), round(y * h))
    return {
        'fenetres': tuple(point(*p) for p in ((.10, .28), (.37, .28), (.34, .75), (.04, .75))),
        'agents': tuple(point(*p) for p in ((.39, .28), (.61, .28), (.65, .75), (.35, .75))),
        'taches': tuple(point(*p) for p in ((.63, .28), (.90, .28), (.96, .75), (.66, .75))),
    }


class WinmapHost:
    """An optional local preview; it does not enumerate or control Windows."""

    def __init__(self, root):
        self.root = root
        root.title('ORBIT — WINMAP')
        root.geometry('900x620')
        root.minsize(620, 480)
        root.configure(bg='#0b1424')
        root.protocol('WM_DELETE_WINDOW', self.close)
        root.bind('<Escape>', self.close)

        tk.Label(root, text='WINMAP', bg='#0b1424', fg='#eaf5ff',
                 font=('Segoe UI', 24, 'bold')).pack(pady=(18, 0))
        tk.Label(root, text='Aperçu : fenêtres et agents réels non connectés', bg='#0b1424',
                 fg='#a9bdd8', font=('Segoe UI', 11)).pack(pady=(0, 8))
        self.canvas = tk.Canvas(root, bg='#0d1b30', highlightthickness=0,
                                height=300, cursor='hand2')
        self.canvas.pack(fill='both', expand=True, padx=20)
        self.canvas.bind('<Configure>', self.draw)

        self.heading = tk.StringVar(value='Choisis un espace')
        self.description = tk.StringVar(value='Sélectionne une zone pour découvrir son rôle. Cet aperçu est indépendant du suivi des mains.')
        detail = tk.Frame(root, bg='#14243b', padx=18, pady=12)
        detail.pack(fill='x', padx=20, pady=12)
        tk.Label(detail, textvariable=self.heading, bg='#14243b', fg='#eaf5ff',
                 font=('Segoe UI', 14, 'bold'), anchor='w').pack(fill='x')
        tk.Label(detail, textvariable=self.description, bg='#14243b', fg='#c7d7eb',
                 font=('Segoe UI', 10), anchor='w', justify='left', wraplength=780).pack(fill='x', pady=(4, 0))
        tk.Button(root, text='Fermer', command=self.close, bg='#29486d', fg='white',
                  activebackground='#3b6390', activeforeground='white', relief='flat',
                  padx=22, pady=5).pack(pady=(0, 14))

    def draw(self, _event=None):
        canvas = self.canvas
        canvas.delete('scene')
        width, height = canvas.winfo_width(), canvas.winfo_height()
        canvas.create_text(width / 2, height * .13, text='ESPACE ORBIT',
                           fill='#7794b8', font=('Segoe UI', 11, 'bold'), tags='scene')
        colors = {'fenetres': '#28517a', 'agents': '#365589', 'taches': '#395f79'}
        for key, points in zone_polygons(width, height).items():
            coords = [value for point in points for value in point]
            tag = 'zone_' + key
            canvas.create_polygon(*coords, fill=colors[key], outline='#83b4dc',
                                  width=2, tags=('scene', tag))
            cx = sum(p[0] for p in points) / 4
            cy = sum(p[1] for p in points) / 4
            canvas.create_text(cx, cy, text=ZONES[key][0], fill='#ffffff',
                               font=('Segoe UI', 15, 'bold'), tags=('scene', tag))
            canvas.tag_bind(tag, '<Button-1>', lambda _event, name=key: self.select(name))
        canvas.create_text(width / 2, height * .89, text='Clique sur un espace pour le découvrir',
                           fill='#9ab2cd', font=('Segoe UI', 10), tags='scene')

    def select(self, key):
        title, description = ZONES[key]
        self.heading.set(title)
        self.description.set(description)

    def close(self, _event=None):
        self.root.destroy()


def main():
    root = tk.Tk()
    WinmapHost(root)
    root.mainloop()


if __name__ == '__main__':
    main()
