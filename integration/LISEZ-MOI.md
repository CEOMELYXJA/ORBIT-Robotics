# ORBIT + HandsWizard — intégration locale expérimentale

Double-cliquer sur le lanceur ORBIT du Bureau : le centre de commande s'ouvre. « Ouvrir le suivi avec Camo » démarre la fenêtre de suivi ; « Diagnostic » lance les vérifications locales sans caméra. « Diagnostic + caméra » ajoute un essai de la caméra, sans conserver d'image, après fermeture du suivi. Le programme utilise l'environnement Python 3.11 déjà installé ; Installer-ORBIT.cmd peut créer un environnement séparé si nécessaire.

« Ouvrir mon espace spatial » ouvre l’interface Winmap dans une fenêtre Edge locale, avec un profil séparé. Les projets et objets affichés sont des exemples ou des éléments créés dans la carte. Le suivi ORBIT peut déplacer le curseur dans cette fenêtre comme dans les autres applications. Fermer l’espace avec Alt+F4 ou la croix. Les commandes spatiales par gestes dédiés et les liens avec de véritables agents ou fenêtres ne sont pas encore intégrés.

Dans cette intégration, la connexion de dossiers, les aperçus de fichiers réels et les copies ou déplacements sur disque sont désactivés. L’original Winmap reste conservé séparément. Le petit aperçu précédent est conservé dans `winmap_host.py` mais n’est plus le bouton principal.

Dans l’espace spatial, « Mode main » est activé au départ : la rotation est adoucie et les planètes restent en place pendant un clic. Pour les réorganiser volontairement, désactiver le mode main avec son bouton, puis le réactiver ensuite. « Agents locaux » ouvre huit contrôles exécutables portant sur la scène, la structure, le pointeur et la sécurité ; ce sont des outils locaux déterministes, pas les agents IA de la conversation. Le contrôle des mains indique explicitement qu'il ne peut pas vérifier la caméra.

Le bouton « Mes outils » ouvre une calculatrice simple, des notes et une zone de dessin à l’intérieur de l’espace ORBIT. Ce sont des outils ORBIT, pas les applications Microsoft. Les notes et traits sont enregistrés dans le stockage local du profil ORBIT si le navigateur le permet ; l’interface signale une erreur si la sauvegarde échoue. Ils ne sont pas automatiquement transférés vers un autre ordinateur. Ces outils sont simples et ne remplacent pas toutes les fonctions des applications Windows.

Cliquer sur une planète affiche sa fiche : son emplacement, ce qu’elle contient, ses voisins et ses liens dans la carte. Pour entrer dans un espace, cliquer ensuite sur « Explorer cet espace ». Utiliser la flèche de retour ou le chemin en haut pour remonter. Les espaces générés sont indiqués comme tels ; ils ne correspondent pas automatiquement à de vrais dossiers.

Laisser Camo Studio et l'iPhone connectés, puis fermer toute autre instance ORBIT avant le lancement. Une image grise Camo ou noire ne prouve pas un flux en direct. P active ou met en pause la souris ; F8 demande la mise en pause même si une autre fenêtre a le focus ; Q ferme la fenêtre. La souris démarre en pause. L'image conserve par défaut l'orientation reçue de Camo ; M active ou désactive l'effet miroir. H inverse uniquement le sens horizontal du curseur, sans modifier l'image.

Le contrôle suit une main à la fois, y compris lorsque deux mains sont visibles. Si la main disparaît, le clic maintenu est relâché immédiatement ; le contrôle reprend lorsqu'une main revient et que ses doigts sont ouverts. Une perte de caméra, un arrêt volontaire ou F8 exige une reprise manuelle avec P. Une identification ambiguë suspend temporairement le contrôle. Le suivi réel et la reprise restent à valider ; un appel système bloqué peut retarder F8. Éviter les clics sensibles pendant l'essai.

Le déplacement utilise les écrans détectés par Windows, ordonnés de gauche à droite. Pour mieux viser, le curseur se stabilise au début d'un pincement ; en maintenant le pincement, un mouvement plus ample permet de glisser. Il n'y a pas de clic automatique ni de magnétisme vers les boutons. Le suivi est calculé sur une image réduite et le nombre d'images traitées par seconde est affiché ; cela ne mesure pas le délai complet du téléphone à l'écran. Tester les performances et la précision en conditions réelles.

## Gestes expérimentaux de pause

Les gestes sont désactivés au démarrage : appuyer sur G dans la fenêtre vidéo pour les activer. Après activation manuelle de la souris avec P, un poing maintenu au moins 1,2 seconde demande la pause. Pour reprendre après cette pause, relâcher les poings puis tenir deux poings au moins 2 secondes. Plusieurs images successives sont nécessaires. Un clic maintenu est relâché dès le début du geste ; après la reprise, ouvrir la main avant un nouveau clic. Après F8 ou une interruption de caméra, la reprise exige P : les deux poings ne peuvent pas annuler cet arrêt. F8 reste disponible. Ces gestes ont été testés avec des données synthétiques uniquement : leur reconnaissance, les erreurs possibles et la sécurité doivent être évaluées avec une personne présente avant utilisation. Ils ne constituent pas un arrêt d'urgence matériel.

## Vérification des données de démonstration

`dataset_validator.py CHEMIN_DE_SESSION` vérifie à la demande les métadonnées et la cohérence des points CSV et JSONL d'un dossier explicitement choisi. Il ne modifie pas la session et n'ouvre pas la vidéo. Il contrôle notamment les horodatages, les 21 points et leur correspondance dans l'ordre d'export ORBIT ; il ne prouve pas que les coordonnées sont précises ou utilisables pour un robot. Les tests inclus ne contiennent que des données synthétiques.

Après validation, `data_quality.py CHEMIN_DE_SESSION` peut résumer la durée, la cadence, la proportion d'images avec une main et les interruptions. Ce résumé ne contient pas les coordonnées et ne mesure ni la précision physique ni le délai complet de la caméra. Il ne lit que `images.jsonl`, après sélection explicite du dossier.

R démarre et arrête l'enregistrement local (dossier enregistrements dans ce répertoire). Les vidéos sont à fréquence fixe estimée ; les horodatages des coordonnées sont mesurés. Ne pas traiter ces coordonnées comme des positions physiques calibrées. En cas de source différente, exécuter `python orbit_integrated.py --camera 1 --backend dshow` avec l'interpréteur de l'environnement. Les options sont aussi visibles avec --help.

Le mode iPhone gyroscope d'origine demeure séparé et inchangé. Le traitement MediaPipe est sur CPU ; un GPU NVIDIA n'implique pas que cette version l'utilise. Aucun enregistrement existant n'a été déplacé ou supprimé.


