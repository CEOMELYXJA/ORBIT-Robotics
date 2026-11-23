"""Centre de commande local ORBIT ; aucune caméra n'est ouverte ici."""
import argparse
import ctypes
import os
from pathlib import Path
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox
from embedded_preview import EmbeddedPreview


ROOT = Path(__file__).resolve().parent
WINDOW_TITLE = 'ORBIT Robotics v0.1'


def orbit_window_open():
    if os.name != 'nt':
        return False
    return bool(ctypes.windll.user32.FindWindowW(None, WINDOW_TITLE))


def start_tracking(window_open, existing_process, launch):
    """Never start a second camera/controller when the first is available."""
    if window_open() or (existing_process is not None and existing_process.poll() is None):
        return 'already_open', existing_process
    return 'started', launch()


class OrbitCenter:
    def __init__(self, root):
        self.root = root
        self.child = None
        self.space = None
        self.projection = None
        self.window_cockpit = None
        self.diagnostic = None
        self.notice = None
        self.embedded = None
        self.embed_attempts = 0
        self.closing = False
        self.status = tk.StringVar(value='Prêt')
        root.title('ORBIT Robotics — Centre de commande')
        root.geometry('600x650')
        root.minsize(560, 620)
        root.configure(bg='#0b1022')

        self.spatial_page = None
        self.home_geometry = None
        content = self.home = tk.Frame(root, bg='#0b1022', padx=36, pady=12)
        content.pack(fill='both', expand=True)
        art = tk.Canvas(content, width=500, height=68, bg='#0b1022', highlightthickness=0)
        art.pack()
        for x, y, size in ((35, 20, 2), (75, 50, 2), (125, 12, 1), (375, 14, 2), (444, 45, 2), (480, 20, 1), (410, 55, 1)):
            art.create_oval(x-size, y-size, x+size, y+size, fill='#e8d38e', outline='')
        art.create_oval(171, 17, 329, 57, outline='#7ad8c6', width=2)
        art.create_oval(227, 8, 273, 54, fill='#946fc3', outline='#e8c9ff', width=2)
        art.create_oval(236, 14, 247, 25, fill='#c2a4e8', outline='')
        art.create_oval(335, 25, 345, 35, fill='#ffbf79', outline='')
        tk.Label(content, text='ORBIT ROBOTICS', font=('Segoe UI', 22, 'bold'),
                 fg='#f6e6c4', bg='#0b1022').pack()
        tk.Label(content, text='Choisis ton aventure', font=('Segoe UI', 12),
                 fg='#b5cde0', bg='#0b1022').pack(pady=(2, 5))
        for label, action, color in (
            ('✋  Mes mains avec la caméra', self.open_tracking, '#29547a'),
            ('✦  Mon espace spatial', self.open_space, '#57477b'),
            ('☄  Les deux ensemble', self.open_both, '#36746c'),
        ):
            tk.Button(content, text=label, command=action, font=('Segoe UI', 13, 'bold'),
                      bg=color, fg='white', activebackground='#748fbd', activeforeground='white',
                      relief='flat', cursor='hand2', padx=14, pady=6).pack(fill='x', pady=3)
            if action == self.open_tracking:
                self.camera_slot = tk.Frame(content, height=240, bg='#050a15')
                self.camera_slot.pack(fill='x', pady=(2, 4))
                self.camera_slot.pack_propagate(False)
                self.preview = tk.Frame(root, bg='#050a15', highlightbackground='#52778b', highlightthickness=1)
                self.preview.pack(in_=self.camera_slot, fill='both', expand=True)
                self.preview.bind('<Configure>', self.resize_preview)
        tk.Label(content, text='HandsWizard utilise Camo. Ouvre Camo Camera sur ton iPad.',
                 font=('Segoe UI', 9), fg='#b5cde0', bg='#0b1022', wraplength=500).pack(pady=(13, 0))
        tk.Label(content, textvariable=self.status, font=('Segoe UI', 9), fg='#91dfc8',
                 bg='#0b1022', wraplength=500).pack(pady=5)
        root.protocol('WM_DELETE_WINDOW', self.close)
        self.refresh()

    def launch(self):
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        return subprocess.Popen([sys.executable, str(ROOT / 'orbit_integrated.py'), '--embedded', '--camo'], cwd=str(ROOT),
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                creationflags=flags)

    def open_tracking(self):
        self.notice = None
        if self.child is not None and self.child.poll() is None:
            self.status.set('Le suivi est déjà ouvert dans cet accueil.')
            return
        if orbit_window_open():
            if not EmbeddedPreview.close_existing_tracking():
                self.status.set('Impossible de fermer l’ancienne fenêtre de suivi.')
                return
            self.status.set('Intégration de la fenêtre de suivi…')
            self.root.after(150, lambda: self.wait_for_previous_tracking(0))
            return
        try:
            result, self.child = start_tracking(orbit_window_open, self.child, self.launch)
        except (OSError, RuntimeError, ImportError) as error:
            self.notice = f'HandsWizard est indisponible. {error}'
            self.status.set(self.notice)
            return
        if result == 'already_open':
            messagebox.showinfo('ORBIT déjà ouvert',
                                'Une fenêtre ORBIT est déjà ouverte. Utilise-la ou ferme-la avec Q avant de redémarrer.')
        else:
            self.status.set('Ouverture du suivi… La souris démarre en pause.')
            self.embed_attempts = 0
            self.root.after(200, self.attach_preview)

    def wait_for_previous_tracking(self, attempt):
        if self.closing:
            return
        if not orbit_window_open():
            self.open_tracking()
        elif attempt < 40:
            self.root.after(150, lambda: self.wait_for_previous_tracking(attempt + 1))
        else:
            self.status.set('Ferme l’ancienne fenêtre du suivi avec Q, puis réessaie.')

    def attach_preview(self):
        if self.closing or not self.child or self.child.poll() is not None:
            return
        try:
            if self.embedded is None:
                self.embedded = EmbeddedPreview(self.preview, self.child.pid)
            if self.embedded.attach():
                self.status.set('Caméra intégrée. Clique sur ACTIVER pour utiliser ta main.')
                self.root.after(300, self.refresh_preview_geometry)
                return
        except OSError:
            if self.embedded:
                try:
                    self.embedded.request_close()
                except OSError:
                    pass
            self.embedded = None
            self.notice = 'Aperçu intégré indisponible. Vérifie la caméra puis réessaie.'
            self.status.set(self.notice)
            return
        self.embed_attempts += 1
        if self.embed_attempts < 100:
            self.root.after(200, self.attach_preview)
        else:
            if self.embedded:
                try:
                    self.embedded.request_close()
                except OSError:
                    pass
            self.notice = 'La caméra ne répond pas encore. Vérifie Camo.'
            self.status.set(self.notice)

    def resize_preview(self, event=None):
        if self.embedded:
            self.embedded.resize(event)

    def refresh_preview_geometry(self):
        if not self.closing and self.embedded and self.child and self.child.poll() is None:
            self.embedded.resize()
            self.root.after(300, self.refresh_preview_geometry)

    def close(self):
        if self.closing:
            return
        self.closing = True
        if getattr(self, 'space', None) is not None:
            self.space.close()
        self.status.set('Fermeture de la caméra…')
        self.wait_for_tracking_close(0)

    def wait_for_tracking_close(self, attempt):
        if self.child is None or self.child.poll() is not None:
            self.root.destroy()
            return
        try:
            if self.embedded is None:
                self.embedded = EmbeddedPreview(self.preview, self.child.pid)
            self.embedded.request_close()
        except OSError:
            pass
        if attempt >= 50:
            self.closing = False
            self.status.set('La caméra ne s’est pas fermée. Appuie sur F8, puis réessaie.')
            return
        self.root.after(100, lambda: self.wait_for_tracking_close(attempt + 1))

    def open_both(self):
        self.open_space(together=True)
        child = getattr(self, 'child', None)
        if child is None or child.poll() is not None:
            self.open_tracking()

    def build_spatial_page(self):
        page = self.spatial_page = tk.Frame(self.root, bg='#0b1022')
        bar = tk.Frame(page, bg='#13202c', padx=10, pady=6)
        bar.pack(fill='x')
        tk.Button(bar, text='‹  Accueil et mains', command=self.show_home, bg='#24434b',
                  fg='white', relief='flat', padx=12, pady=5).pack(side='left')
        tk.Label(bar, text='Mon espace spatial', fg='#d9ebe7', bg='#13202c',
                 font=('Segoe UI', 11, 'bold')).pack(side='left', padx=14)
        self.spatial_status = tk.StringVar()
        tk.Label(bar, textvariable=self.spatial_status, bg='#13202c', fg='#b5cde0',
                 wraplength=450).pack(side='left', padx=5)
        self.camera_side = tk.Frame(page, bg='#0b1022', width=320)
        self.camera_side.pack_propagate(False)
        tk.Label(self.camera_side, text='HandsWizard · Camo', bg='#0b1022', fg='#e4f4ee',
                 font=('Segoe UI', 11, 'bold')).pack(pady=12)
        self.side_slot = tk.Frame(self.camera_side, height=174, bg='#050a15')
        self.side_slot.pack(fill='x', padx=6)
        self.side_slot.pack_propagate(False)
        tk.Label(self.camera_side, textvariable=self.status, bg='#0b1022', fg='#adcbc4',
                 wraplength=290).pack(pady=12)
        self.viewport = tk.Frame(page, bg='#0c151c')
        self.viewport.pack(side='left', fill='both', expand=True)

    def watch_space(self):
        if self.closing or self.space is None:
            return
        if self.space.status == 'loading':
            self.root.after(180, self.watch_space)
        elif self.space.status == 'ready':
            self.spatial_status.set('')
        else:
            self.spatial_status.set(self.space.error or 'La vue spatiale est indisponible.')

    def show_home(self):
        self.spatial_page.pack_forget()
        self.home.pack(fill='both', expand=True)
        self.preview.pack_forget()
        self.preview.pack(in_=self.camera_slot, fill='both', expand=True)
        self.preview.lift()
        if self.home_geometry:
            size, window_state = self.home_geometry
            if window_state == 'normal':
                self.root.state('normal')
                self.root.geometry(size)
            self.home_geometry = None

    def open_space(self, *, together=False, earth=False):
        # A camera already running in the home page follows the user into space.
        # The same preview widget and tracking process are retained.
        together = together or (self.child is not None and self.child.poll() is None)
        if self.spatial_page is None:
            self.build_spatial_page()
        if self.home_geometry is None:
            self.home_geometry = self.root.geometry(), self.root.state()
            if self.root.state() == 'normal':
                self.root.state('zoomed')
        self.home.pack_forget()
        self.spatial_page.pack(fill='both', expand=True)
        if together:
            self.camera_side.pack(side='right', fill='y', before=self.viewport)
            self.preview.pack_forget()
            self.preview.pack(in_=self.side_slot, fill='both', expand=True)
            self.preview.lift()
        else:
            self.camera_side.pack_forget()
        try:
            if self.space is None or self.space.status in ('error', 'closed'):
                if self.space is not None:
                    self.space.close()
                from spatial_webview import SpatialWebView
                self.viewport.update_idletasks()
                self.space = SpatialWebView(self.viewport)
                self.space.open(earth=earth)
                self.spatial_status.set('Ouverture de la carte…')
                self.watch_space()
        except (OSError, RuntimeError, ImportError) as exc:
            if self.space:
                self.space.close()
            self.space = None
            self.spatial_status.set(f'Ouverture impossible. {exc}')

    def open_projection(self):
        if self.projection is not None and self.projection.poll() is None:
            self.status.set('L’aperçu de projection est déjà ouvert.')
            return
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        try:
            self.projection = subprocess.Popen([sys.executable, str(ROOT / 'projection_preview.py')],
                                               cwd=str(ROOT), stdout=subprocess.DEVNULL,
                                               stderr=subprocess.DEVNULL, creationflags=flags)
            self.status.set('Aperçu de projection ouvert : simulation sur écran.')
        except OSError:
            messagebox.showerror('ORBIT', 'Impossible d’ouvrir l’aperçu de projection.')

    def open_window_cockpit(self):
        if self.window_cockpit is not None and self.window_cockpit.poll() is None:
            self.status.set('Les repères de fenêtres sont déjà ouverts.')
            return
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        try:
            self.window_cockpit = subprocess.Popen([sys.executable, str(ROOT / 'cockpit_windows.py')],
                                                    cwd=str(ROOT), creationflags=flags)
            self.status.set('Repères de fenêtres ouverts : choisis les fenêtres à associer.')
        except OSError:
            messagebox.showerror('ORBIT', 'Impossible d’ouvrir les repères de fenêtres.')

    def run_diagnostic(self, with_camera=False):
        if self.diagnostic is not None and self.diagnostic.poll() is None:
            return
        if with_camera and (orbit_window_open() or (self.child is not None and self.child.poll() is None)):
            messagebox.showinfo('Caméra utilisée', 'Ferme le suivi ORBIT avant de tester sa caméra.')
            return
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        try:
            self.notice = None
            command = [sys.executable, str(ROOT / 'diagnostic.py')]
            if with_camera:
                command.append('--camera')
            self.diagnostic = subprocess.Popen(command, cwd=str(ROOT),
                                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                               creationflags=flags)
            self.status.set('Diagnostic local en cours…' if with_camera else 'Diagnostic local en cours, sans caméra…')
        except OSError:
            messagebox.showerror('ORBIT', 'Impossible de démarrer le diagnostic.')

    def refresh(self):
        if self.diagnostic is not None and self.diagnostic.poll() is not None:
            self.notice = ('Diagnostic terminé : voir le dossier rapports.' if not self.diagnostic.returncode
                           else 'Diagnostic incomplet ou en échec : voir le dossier rapports.')
            self.status.set(self.notice)
            self.diagnostic = None
        elif self.diagnostic is not None:
            pass
        elif self.notice:
            self.status.set(self.notice)
        elif self.child is not None and self.child.poll() is None:
            pass
        elif orbit_window_open():
            self.status.set('ORBIT est ouvert. Vérifie son état dans la fenêtre de suivi.')
        elif self.child is not None and self.child.poll() is not None:
            if self.child.returncode == 2:
                self.status.set('Aucune caméra Camo disponible. Vérifie l’iPad dans Camo Studio puis réessaie.')
            elif self.child.returncode:
                self.status.set('Le suivi s’est arrêté. Vérifie la connexion Camo puis réessaie.')
            else:
                self.status.set('Le suivi est fermé.')
            self.child = None
            self.embedded = None
        self.root.after(1500, self.refresh)


def main():
    parser = argparse.ArgumentParser(description='Accueil ORBIT Robotics')
    entry = parser.add_mutually_exclusive_group()
    entry.add_argument('--mains', action='store_true')
    entry.add_argument('--terre', action='store_true')
    args = parser.parse_args()
    root = tk.Tk()
    centre = OrbitCenter(root)
    if args.mains:
        root.after(200, centre.open_tracking)
    elif args.terre:
        root.after(200, lambda: centre.open_space(earth=True))
    root.mainloop()


if __name__ == '__main__':
    main()
