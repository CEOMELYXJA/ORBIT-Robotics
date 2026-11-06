# Souris mains libres

Contrôle le curseur de l'ordi avec les gestes de la main, comme sur un casque VR.
La caméra de l'iPhone (utilisée comme webcam) suit la main avec MediaPipe.

## Gestes

| Geste | Action |
|---|---|
| Main ouverte / index pointé | Le curseur suit la main |
| Pincer pouce + index | Clic gauche (garder pincé = glisser-déposer) |
| Pincer pouce + majeur | Clic droit |
| Index + majeur levés (V) | Défilement : monter / descendre la main |

Touches dans la fenêtre d'aperçu : `p` = pause, `q` = quitter.

## Installation (Windows)

1. Installer Python 3.10 à 3.12 (cocher « Add Python to PATH »).
2. Brancher l'iPhone comme webcam (Camo, Iriun, etc.).
3. Télécharger ce dépôt (Code > Download ZIP) ou le cloner.
4. Double-cliquer sur `lancer.bat`.

Installation manuelle :

```
pip install -r requirements.txt
python handtracking_souris.py
```

## Réglages

En haut de `handtracking_souris.py` : `CAMERA_INDEX`, `SMOOTH`, `MARGIN`, `PINCH_ON`, `PINCH_OFF`.

## Note

Ce programme doit tourner sur l'ordi : GitHub Pages ou Netlify ne peuvent pas contrôler la souris.

