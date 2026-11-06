# ORBIT + HandsWizard — intégration locale expérimentale

Double-cliquer sur le lanceur ORBIT du Bureau, choisir 1 pour démarrer, 2 pour les tests, ou 3 pour les tests et l'essai caméra. Le programme utilise l'environnement Python 3.11 déjà installé ; Installer-ORBIT.cmd peut créer un environnement séparé si nécessaire.

Laisser Camo Studio et l'iPhone connectés, puis fermer toute autre instance ORBIT avant le lancement. Une image grise Camo ou noire ne prouve pas un flux en direct. P active ou met en pause la souris ; F8 demande la mise en pause même si une autre fenêtre a le focus ; Q ferme la fenêtre. La souris démarre en pause. L'image conserve par défaut l'orientation reçue de Camo ; M active ou désactive l'effet miroir. H inverse uniquement le sens horizontal du curseur, sans modifier l'image.

Le contrôle suit une main à la fois, y compris lorsque deux mains sont visibles. Si la main disparaît, le clic maintenu est relâché immédiatement ; le contrôle reprend lorsqu'une main revient et que ses doigts sont ouverts. Une perte de caméra, un arrêt volontaire ou F8 exige une reprise manuelle avec P. Une identification ambiguë suspend temporairement le contrôle. Le suivi réel et la reprise restent à valider ; un appel système bloqué peut retarder F8. Éviter les clics sensibles pendant l'essai.

R démarre et arrête l'enregistrement local (dossier enregistrements dans ce répertoire). Les vidéos sont à fréquence fixe estimée ; les horodatages des coordonnées sont mesurés. Ne pas traiter ces coordonnées comme des positions physiques calibrées. En cas de source différente, exécuter `python orbit_integrated.py --camera 1 --backend dshow` avec l'interpréteur de l'environnement. Les options sont aussi visibles avec --help.

Le mode iPhone gyroscope d'origine demeure séparé et inchangé. Le traitement MediaPipe est sur CPU ; un GPU NVIDIA n'implique pas que cette version l'utilise. Aucun enregistrement existant n'a été déplacé ou supprimé.


