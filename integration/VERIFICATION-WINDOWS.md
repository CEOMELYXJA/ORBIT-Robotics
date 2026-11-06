# Vérifications effectuées sur le PC

- Révision de sécurité : 28 tests automatisés ont été exécutés trois fois sans caméra ni images réelles, avec succès à chaque passage. Les nouvelles voies de secours Windows ont été simulées ; elles ne remplacent pas une validation matérielle.

- Python 3.11.9 x64, MediaPipe 0.10.21, OpenCV 4.11.0 et NumPy 1.26.4 : imports vérifiés. `pip check` ne signale pas de dépendance cassée.
- NVIDIA GeForce GTX 1060 3 Go, pilote 560.94 : détectée. OpenCV CUDA ne détecte aucun appareil utilisable ; le suivi est exécuté sur CPU.
- Déplacement réel du curseur Windows hors de la fenêtre ORBIT : déplacement demandé de 10 pixels, position de destination observée, puis retour à la position initiale. Ce test ne prouve pas le contrôle par gestes.
- F8 : une pression produite par logiciel sous Windows a été détectée par la surveillance et l'arrêt du contrôleur simulé appelé. La touche physique, le relâchement d'un clic réel et l'arrêt en conditions de capture restent à vérifier.
- Tests automatisés : consulter le rapport daté dans rapports/. Les tests de caméra et de mains sont des simulations sauf indication contraire dans le rapport.
- Essai matériel Camo de cette livraison : non exécuté car une ancienne fenêtre ORBIT est encore ouverte et peut occuper la caméra. Les essais antérieurs ont montré noir ou écran d'attente ; leur cause précise n'est pas démontrée.
- Test réel d'une main, des gestes, de l'affichage des points et des exports d'une démonstration : non exécuté. Pas de preuve que l'intégration répond encore au critère final de fonctionnement réel.


