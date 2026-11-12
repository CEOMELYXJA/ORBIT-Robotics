"""Tableau local optionnel pour retrouver des fenêtres Windows choisies.

Les fenêtres restent des fenêtres Windows ordinaires. Aucun processus n'est
fermé ou suspendu et aucune capture d'écran n'est réalisée.
"""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import time
import tkinter as tk
from tkinter import messagebox, simpledialog

ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / 'cockpit_state'
MAX_ENTRIES = 80


def validate_entry(item):
    if not isinstance(item, dict):
        return False
    title, name, rect, point, window_class = (item.get(k) for k in ('title', 'name', 'rect', 'point', 'window_class'))
    return (isinstance(title, str) and 0 < len(title) <= 512 and
            isinstance(name, str) and 0 < len(name) <= 80 and
            isinstance(window_class, str) and 0 < len(window_class) <= 256 and
            isinstance(rect, list) and len(rect) == 4 and
            all(type(v) is int and abs(v) <= 100000 for v in rect) and
            80 <= rect[2] <= 30000 and 60 <= rect[3] <= 30000 and
            isinstance(point, list) and len(point) == 2 and
            all(type(v) is int and 0 <= v <= 1000 for v in point))


def load_state(folder=STATE_DIR):
    if not folder.exists():
        return []
    files = sorted(folder.glob('cockpit_*.json'), reverse=True)
    if not files:
        return []
    data = json.loads(files[0].read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('entries'), list):
        raise ValueError('Mémoire du cockpit illisible : aucun changement enregistré.')
    entries = data['entries']
    if len(entries) > MAX_ENTRIES or not all(validate_entry(item) for item in entries):
        raise ValueError('Mémoire du cockpit invalide : aucun changement enregistré.')
    return entries


def save_state(entries, folder=STATE_DIR):
    if len(entries) > MAX_ENTRIES or not all(validate_entry(item) for item in entries):
        raise ValueError('Position ou fenêtre invalide.')
    folder.mkdir(parents=True, exist_ok=True)
    # Append-only snapshots preserve every earlier version, even after a failed write.
    stamp = time.time_ns()
    path = folder / f'cockpit_{stamp:020d}.json'
    with path.open('x', encoding='utf-8') as output:
        json.dump({'version': 1, 'entries': entries}, output, ensure_ascii=False, indent=2)
        output.flush()
        os.fsync(output.fileno())
    return path


class WindowsAPI:
    def __init__(self):
        if os.name != 'nt':
            raise RuntimeError('Windows est nécessaire.')
        self.user = ctypes.WinDLL('user32', use_last_error=True)
        self.user.IsWindowVisible.argtypes = [wintypes.HWND]
        self.user.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        self.user.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        self.user.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        self.user.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        self.user.IsIconic.argtypes = [wintypes.HWND]
        self.user.IsZoomed.argtypes = [wintypes.HWND]
        self.user.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
        self.user.SetForegroundWindow.argtypes = [wintypes.HWND]
        self.user.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]

    def windows(self):
        found = []
        callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        @callback_type
        def collect(handle, _):
            if not self.user.IsWindowVisible(handle):
                return True
            length = min(self.user.GetWindowTextLengthW(handle), 512)
            if not length:
                return True
            text = ctypes.create_unicode_buffer(length + 1)
            self.user.GetWindowTextW(handle, text, len(text))
            class_name = ctypes.create_unicode_buffer(257)
            self.user.GetClassNameW(handle, class_name, len(class_name))
            rect = wintypes.RECT()
            if self.user.GetWindowRect(handle, ctypes.byref(rect)):
                w, h = rect.right - rect.left, rect.bottom - rect.top
                if text.value and class_name.value and w >= 80 and h >= 60:
                    found.append({'handle': int(handle), 'title': text.value,
                                  'window_class': class_name.value,
                                  'rect': [rect.left, rect.top, w, h]})
            return True
        self.user.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
        self.user.EnumWindows.restype = wintypes.BOOL
        if not self.user.EnumWindows(collect, 0):
            raise OSError('Windows ne peut pas lire les fenêtres ouvertes.')
        return found

    def unique(self, title, window_class):
        matches = [item for item in self.windows() if item['title'] == title and item['window_class'] == window_class]
        if len(matches) != 1:
            raise ValueError('Fenêtre introuvable ou plusieurs fenêtres portent ce nom. Actualise et associe-la de nouveau.')
        return matches[0]

    def focus(self, entry):
        item = self.unique(entry['title'], entry['window_class'])
        if self.user.IsIconic(item['handle']):
            self.user.ShowWindow(item['handle'], 9)
        if not self.user.SetForegroundWindow(item['handle']):
            raise OSError('Windows n’a pas autorisé la mise au premier plan.')

    def restore(self, entry):
        item = self.unique(entry['title'], entry['window_class'])
        if self.user.IsIconic(item['handle']) or self.user.IsZoomed(item['handle']):
            self.user.ShowWindow(item['handle'], 9)
        x, y, w, h = entry['rect']
        # SWP_NOZORDER | SWP_NOACTIVATE: do not alter other apps or focus.
        if not self.user.SetWindowPos(item['handle'], None, x, y, w, h, 0x0014):
            raise OSError('Windows n’a pas pu replacer la fenêtre.')


class Cockpit:
    def __init__(self, root, api):
        self.root, self.api = root, api
        self.read_only = False
        try:
            self.entries = load_state()
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            self.entries, self.read_only = [], True
            messagebox.showerror('Mémoire ORBIT', str(exc) + '\nLes anciennes sauvegardes sont conservées.', parent=root)
        self.selected = None
        self.drag = None
        root.title('ORBIT — repères de fenêtres Windows')
        root.geometry('850x620')
        root.minsize(600, 450)
        root.configure(bg='#0c1726')
        tk.Label(root, text='Mes repères de fenêtres', font=('Segoe UI', 18, 'bold'), bg='#0c1726', fg='white').pack(anchor='w', padx=16, pady=(12, 0))
        tk.Label(root, text='Associe une fenêtre ouverte, puis déplace son repère. Les applications restent dans Windows.', bg='#0c1726', fg='#c3d6e8', wraplength=800, justify='left').pack(anchor='w', padx=16, pady=5)
        controls = tk.Frame(root, bg='#0c1726'); controls.pack(fill='x', padx=16, pady=4)
        tk.Button(controls, text='Associer une fenêtre ouverte', command=self.choose).pack(side='left', padx=(0, 6))
        tk.Button(controls, text='Ouvrir la fenêtre', command=self.focus).pack(side='left', padx=3)
        tk.Button(controls, text='Replacer sur les écrans', command=self.restore).pack(side='left', padx=3)
        tk.Button(controls, text='Mémoriser sa position actuelle', command=self.remember).pack(side='left', padx=3)
        self.status = tk.StringVar(value='Aucune fenêtre n’est déplacée automatiquement.')
        tk.Label(root, textvariable=self.status, bg='#0c1726', fg='#9de9d1', anchor='w', wraplength=800).pack(fill='x', padx=16, pady=5)
        self.canvas = tk.Canvas(root, bg='#10223b', highlightthickness=0)
        self.canvas.pack(fill='both', expand=True, padx=16, pady=(0, 16))
        self.canvas.bind('<Configure>', self.draw)
        self.canvas.bind('<ButtonPress-1>', self.press)
        self.canvas.bind('<B1-Motion>', self.move)
        self.canvas.bind('<ButtonRelease-1>', self.release)
        self.canvas.bind('<Double-Button-1>', lambda event: self.focus())
        self.draw()

    def persist(self):
        if self.read_only:
            raise ValueError('Mémoire en lecture seule : corriger la sauvegarde avant toute modification.')
        save_state(self.entries)

    def choose(self):
        if self.read_only:
            messagebox.showerror('ORBIT', 'La mémoire est en lecture seule.', parent=self.root); return
        try:
            options = [w for w in self.api.windows() if w['title'] != self.root.title()]
        except OSError as exc:
            messagebox.showerror('ORBIT', str(exc), parent=self.root); return
        picker = tk.Toplevel(self.root); picker.title('Choisir une fenêtre ouverte'); picker.geometry('620x420')
        tk.Label(picker, text='Choisis seulement la fenêtre que tu veux associer.').pack(anchor='w', padx=12, pady=8)
        listing = tk.Listbox(picker, exportselection=False); listing.pack(fill='both', expand=True, padx=12)
        for option in options: listing.insert('end', option['title'])
        def add():
            selection = listing.curselection()
            if not selection: return
            item = options[selection[0]]
            if sum(w['title'] == item['title'] and w['window_class'] == item['window_class'] for w in options) != 1:
                messagebox.showwarning('ORBIT', 'Plusieurs fenêtres portent ce nom. Choisis une fenêtre identifiable.', parent=picker); return
            name = simpledialog.askstring('Nom du repère', 'Comment nommer ce repère ?', initialvalue=item['title'][:80], parent=picker)
            if not name or not name.strip(): return
            entry = {'name': name.strip()[:80], 'title': item['title'], 'window_class': item['window_class'], 'rect': item['rect'], 'point': [250 + (len(self.entries) % 4) * 150, 250 + (len(self.entries) // 4 % 4) * 130]}
            self.entries.append(entry)
            try: self.persist()
            except (OSError, ValueError) as exc:
                self.entries.pop(); messagebox.showerror('ORBIT', str(exc), parent=picker); return
            self.selected = len(self.entries) - 1; picker.destroy(); self.draw()
            self.status.set('Repère enregistré localement. Sélectionne-le pour retrouver la fenêtre.')
        tk.Button(picker, text='Associer', command=add).pack(pady=10)

    def draw(self, _event=None):
        c = self.canvas; c.delete('all'); w, h = max(c.winfo_width(), 1), max(c.winfo_height(), 1)
        for i, entry in enumerate(self.entries):
            x, y = entry['point'][0] * w / 1000, entry['point'][1] * h / 1000
            c.create_oval(x-24, y-24, x+24, y+24, fill='#61d9c5' if i == self.selected else '#347a99', outline='#c2f7ee', width=2, tags=('entry', str(i)))
            c.create_text(x, y+39, text=entry['name'], fill='white', width=150, tags=('entry', str(i)))

    def press(self, event):
        hits = self.canvas.find_overlapping(event.x-3, event.y-3, event.x+3, event.y+3)
        for hit in reversed(hits):
            tags = self.canvas.gettags(hit)
            if 'entry' in tags:
                self.selected = int(tags[1]); self.drag = list(self.entries[self.selected]['point']); self.draw(); return
        self.selected = None; self.draw()

    def move(self, event):
        if self.selected is None or self.drag is None or self.read_only: return
        w, h = max(self.canvas.winfo_width(), 1), max(self.canvas.winfo_height(), 1)
        self.entries[self.selected]['point'] = [max(0, min(1000, round(event.x * 1000 / w))), max(0, min(1000, round(event.y * 1000 / h)))]
        self.draw()

    def release(self, _event):
        if self.drag is None: return
        old, self.drag = self.drag, None
        if self.entries[self.selected]['point'] == old: return
        try: self.persist(); self.status.set('Position du repère enregistrée localement.')
        except (OSError, ValueError) as exc:
            self.entries[self.selected]['point'] = old; self.draw(); messagebox.showerror('ORBIT', str(exc), parent=self.root)

    def selected_entry(self):
        if self.selected is None: raise ValueError('Sélectionne d’abord un repère.')
        return self.entries[self.selected]

    def action(self, operation):
        try: operation(self.selected_entry()); return True
        except (OSError, ValueError) as exc: messagebox.showwarning('ORBIT', str(exc), parent=self.root); return False

    def focus(self):
        if self.action(self.api.focus): self.status.set('Fenêtre demandée au premier plan.')

    def restore(self):
        if self.action(self.api.restore): self.status.set('Position de la fenêtre restaurée.')

    def remember(self):
        def update(entry):
            if self.read_only: raise ValueError('Mémoire en lecture seule.')
            previous = entry['rect']; entry['rect'] = self.api.unique(entry['title'], entry['window_class'])['rect']
            try: self.persist()
            except (OSError, ValueError): entry['rect'] = previous; raise
        if self.action(update): self.status.set('Position Windows mémorisée.')


def main():
    root = tk.Tk()
    Cockpit(root, WindowsAPI())
    root.mainloop()


if __name__ == '__main__':
    main()
