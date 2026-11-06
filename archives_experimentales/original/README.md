# ORBIT Robotics v0.1

Double-cliquez sur **launch.bat**. Python 3.11 (64 bits), une webcam et Internet pour la première installation sont nécessaires. Le lanceur installe les bibliothèques dans le dossier du programme.

Dans la fenêtre vidéo, montrez une ou deux mains. Appuyez sur **R** pour commencer un enregistrement, puis sur **R** pour l'arrêter. Appuyez sur **Q** pour quitter. Cliquez d'abord dans la fenêtre vidéo si les touches ne répondent pas.

Chaque enregistrement se trouve dans un sous-dossier de `enregistrements` : vidéo MP4, points CSV, données JSONL (une ligne par image, même sans main détectée) et métadonnées JSON. Les coordonnées MediaPipe sont normalisées et proviennent de l'image miroir; elles ne sont pas des mesures physiques. La vidéo utilise une fréquence fixe estimée, tandis que les temps dans les données sont mesurés pendant la capture.

Si la webcam ne s'ouvre pas, vérifiez les autorisations de caméra dans les paramètres Windows et fermez les autres programmes qui l'utilisent.

