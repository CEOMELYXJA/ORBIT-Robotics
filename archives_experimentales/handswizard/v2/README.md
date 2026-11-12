# HANDSWIZARD — souris aérienne iPhone et mains libres (Windows 11)

Deux modes indépendants pour contrôler le **véritable curseur Windows**. ORBIT.OS n'est pas nécessaire.

## Mode 1 — iPhone dans la main (gyroscope)

- Tourner/incliner l'iPhone pour déplacer le curseur par vitesse relative, calibration, zone morte et sensibilité.
- Boutons à l'écran pour clic gauche/droit, maintenir/glisser, relâcher et défiler.
- Pavé tactile de secours.
- Arrêt immédiat, pause au retour en arrière-plan, arrêt automatique en cas de silence réseau.
- Les rotations fonctionnent sans caméra, mais **ne suivent pas réellement la translation de la main en 3D**. La direction des axes peut nécessiter un ajustement selon la prise en main.

### Installation PC

1. Installer **Python 3.11 (64 bits)** sur Windows et activer *Add python.exe to PATH*.
2. Installer [Tailscale](https://tailscale.com/download) **sur le PC et sur l'iPhone**, et connecter les deux au **même compte privé**, avec authentification multifacteur et appareils approuvés.
3. Télécharger ce dépôt : **GitHub > Code > Download ZIP**, puis **Extraire tout** sur Windows.
4. Double-cliquer sur `lancer.bat` et choisir **1**. À la première utilisation, Python installe les dépendances. Garder la fenêtre ouverte. Noter le **code d'appairage à six chiffres** affiché **sur le PC uniquement**.
5. Sur le PC, ouvrir **PowerShell** et exécuter :
   ```powershell
   & "C:\Program Files\Tailscale\tailscale.exe" serve --bg http://127.0.0.1:8766
   & "C:\Program Files\Tailscale\tailscale.exe" serve status
   ```
6. Dans le résultat de `serve status`, noter **l'adresse HTTPS privée `https://...ts.net`**. Si aucun nom n'apparaît, vérifier les autorisations Tailscale / HTTPS du tailnet.
7. Sur l'iPhone, activer Tailscale, puis ouvrir **cette adresse HTTPS** dans Safari, en gardant le site en premier plan. Entrer le code affiché sur le PC.
8. Appuyer sur **Autoriser le gyroscope** (accepter la permission iOS), tenir l'iPhone dans sa position confortable, appuyer **Calibrer**, puis **Démarrer la souris**. Ajuster la sensibilité.

Si le téléphone reste immobile, le curseur reste immobile. Incliner davantage augmente sa vitesse jusqu'à une limite. Pour arrêter immédiatement, appuyer sur le grand bouton rouge ou fermer le programme PC (Ctrl+C).

**Important sécurité :** le serveur écoute seulement sur `127.0.0.1:8766`. L'adresse privée Tailscale est requise pour le HTTPS des capteurs Safari. **Ne pas activer Tailscale Funnel, ngrok, Cloudflare Tunnel public, une redirection de port ou une exposition publique**. Le code d'appairage est renouvelé à chaque démarrage, limité en tentatives; une association remplace l'ancienne session. Restreindre l'appartenance au tailnet aux seuls appareils autorisés dans les réglages Tailscale. Le code d'appairage **ne garantit pas à lui seul l'identité physique d'un iPhone**; la restriction d'appareils dépend aussi de Tailscale.

Pour arrêter le proxy privé :
```powershell
& "C:\Program Files\Tailscale\tailscale.exe" serve reset
```

## Mode 2 — Mains nues devant la webcam

1. Garder le même dossier extrait. Double-cliquer `lancer.bat`, choisir **2**.
2. Autoriser la webcam dans les paramètres de confidentialité Windows et placer la caméra face à ta main. Si besoin, modifier `CAMERA_INDEX=0` en `1` dans `handtracking_souris.py`.
3. Une fenêtre vidéo s'ouvre. **Appuyer sur P** pour autoriser le contrôle, **P** pour remettre en pause, **Q** ou **Échap** pour quitter.

| Geste | Action |
| --- | --- |
| Index dirigé vers l'écran | Déplacement du curseur |
| Pincer pouce + index | Clic gauche et glisser-déposer en gardant pincé |
| Pincer pouce + majeur | Clic droit (une fois par pincement) |
| Index + majeur levés, autres doigts fermés | Défilement vertical |

Le contrôle est en pause au démarrage, et les clics sont relâchés si la main disparaît. Le traitement vidéo est **local sur le PC**. Une webcam intégrée, USB, ou un iPhone configuré comme webcam convient. Les gestes complexes exigent un bon éclairage et des tests pratiques.

**Ne pas lancer les deux modes en même temps** : ils commandent tous les deux la souris Windows. PyAutoGUI conserve sa sécurité de coin supérieur gauche, mais le contrôle à distance du curseur nécessite prudence (documents, transactions, comptes, etc.).

## GitHub Pages : ce que la page publique fait et ne fait pas

La page de présentation est un **guide public**, pas la connexion privée. Un navigateur ne peut pas piloter Windows directement. Le PC exécute le programme Python ; l'iPhone ouvre **l'adresse HTTPS privée Tailscale** affichée par PowerShell.

## Dépannage

- **Page inaccessible** : vérifie que le PC est allumé, le serveur `lancer.bat` reste ouvert, Tailscale fonctionne sur les deux appareils et `serve status` affiche l'adresse.
- **Capteurs absents** : utilise Safari et HTTPS, autorise les mouvements dans iOS et lance l'autorisation avec le bouton, pas automatiquement.
- **Associé mais curseur immobile** : fais l'étalonnage, puis démarre; vérifie que la page reste au premier plan et que la fenêtre du PC affiche toujours le serveur.
- **La webcam est noire** : vérifie les permissions Windows et `CAMERA_INDEX`; ferme les autres applications utilisant la caméra.
- **Version Python** : utiliser Python **3.11**, car les versions de MediaPipe ont changé d'API selon les releases.
- **Ne pas confondre connexion Internet et permission Windows** : certains écrans Windows sécurisés (UAC, verrouillage) ne permettent pas au programme utilisateur de déplacer le curseur.

### Architecture
`mobile.html` + `mobile.js` → Safari iPhone → HTTPS privé Tailscale Serve → `iphone_server.py` (localhost uniquement) → `mouse_core.py` → PyAutoGUI Windows.

`handtracking_souris.py` → webcam OpenCV → MediaPipe Hands → PyAutoGUI Windows.

### État du projet
Cette branche est une **première version à tester sur tes deux appareils**. Aucun test physique iPhone ni webcam Windows n'est revendiqué. Les contrôles de sécurité restent à confirmer dans ton propre tailnet.
