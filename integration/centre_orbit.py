"""Centre de commande local ORBIT ; aucune caméra n'est ouverte ici."""
import ctypes
import os
from pathlib import Path
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox
from spatial_launcher import launch_spatial


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
        self.diagnostic = None
        self.notice = None
        self.status = tk.StringVar(value='Prêt')
        root.title('ORBIT Robotics — Centre de commande')
        root.geometry('720x620')
        root.minsize(620, 570)
        root.configure(bg='#0c1726')

        content = tk.Frame(root, bg='#0c1726', padx=30, pady=24)
        content.pack(fill='both', expand=True)
        tk.Label(content, text='ORBIT Robotics', font=('Segoe UI', 24, 'bold'),
                 fg='#f4f7ff', bg='#0c1726').pack(anchor='w')
        tk.Label(content, text='Ton espace de suivi des mains et de contrôle du curseur',
                 font=('Segoe UI', 11), fg='#c2d5e7', bg='#0c1726',
                 wraplength=650, justify='left').pack(anchor='w', pady=(2, 18))
        actions = tk.Frame(content, bg='#0c1726')
        actions.pack(anchor='w')
        tk.Button(actions, text='Ouvrir le suivi avec Camo', command=self.open_tracking,
                  font=('Segoe UI', 13, 'bold'), bg='#3c91e6', fg='white',
                  activebackground='#287bc9', padx=18, pady=10).pack(side='left')
        tk.Button(actions, text='Diagnostic', command=lambda: self.run_diagnostic(False),
                  font=('Segoe UI', 11), padx=14, pady=10).pack(side='left', padx=(12, 0))
        tk.Button(actions, text='Diagnostic + caméra', command=lambda: self.run_diagnostic(True),
                  font=('Segoe UI', 10), padx=10, pady=10).pack(side='left', padx=(8, 0))
        tk.Button(content, text='Ouvrir mon espace spatial', command=self.open_space,
                  font=('Segoe UI', 11, 'bold'), padx=14, pady=6).pack(anchor='w', pady=(12, 0))
        tk.Label(content, textvariable=self.status, font=('Segoe UI', 10, 'bold'),
                 fg='#8ce4c4', bg='#0c1726', wraplength=650, justify='left').pack(anchor='w', pady=(12, 16))
        tk.Label(content, text='Dans la fenêtre vidéo', font=('Segoe UI', 13, 'bold'),
                 fg='#f4f7ff', bg='#0c1726').pack(anchor='w')
        controls = ('P  ·  activer ou mettre en pause la souris\n'
                    'F8  ·  arrêter le contrôle de la souris\n'
                    'G  ·  activer les gestes de pause expérimentaux\n'
                    'M  ·  inverser l’image      H  ·  inverser le sens du curseur\n'
                    'R  ·  commencer ou arrêter un enregistrement      Q  ·  quitter')
        tk.Label(content, text=controls, font=('Segoe UI', 11), fg='#d6e5f2',
                 bg='#0c1726', justify='left').pack(anchor='w', pady=(8, 15))
        hint = ('La souris démarre en pause. Connecte Camo et ton iPhone avant d’ouvrir le suivi. '
                'Le geste pour le micro est encore en préparation.')
        tk.Label(content, text=hint, font=('Segoe UI', 10), fg='#aebfd0',
                 bg='#0c1726', wraplength=650, justify='left').pack(anchor='w')
        self.refresh()

    def launch(self):
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        return subprocess.Popen([sys.executable, str(ROOT / 'orbit_integrated.py')], cwd=str(ROOT),
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                creationflags=flags)

    def open_tracking(self):
        self.notice = None
        try:
            result, self.child = start_tracking(orbit_window_open, self.child, self.launch)
        except OSError:
            messagebox.showerror('ORBIT', 'Impossible de démarrer le suivi. Vérifie l’installation Python.')
            return
        if result == 'already_open':
            messagebox.showinfo('ORBIT déjà ouvert',
                                'Une fenêtre ORBIT est déjà ouverte. Utilise-la ou ferme-la avec Q avant de redémarrer.')
        else:
            self.status.set('Ouverture du suivi… La souris démarre en pause.')

    def open_space(self):
        if self.space is not None and self.space.poll() is None:
            self.status.set('L’espace spatial est déjà ouvert.')
            return
        try:
            self.space = launch_spatial()
            self.status.set('Ouverture de l’espace spatial…')
        except OSError as exc:
            messagebox.showerror('ORBIT', f'Impossible d’ouvrir l’espace spatial : {exc}')

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
        elif orbit_window_open():
            self.status.set('ORBIT est ouvert. Vérifie son état dans la fenêtre de suivi.')
        elif self.child is not None and self.child.poll() is not None:
            if self.child.returncode:
                self.status.set('Le suivi s’est arrêté. Vérifie la connexion Camo puis réessaie.')
            else:
                self.status.set('Le suivi est fermé.')
            self.child = None
        self.root.after(1500, self.refresh)


def main():
    root = tk.Tk()
    OrbitCenter(root)
    root.mainloop()


if __name__ == '__main__':
    main()

