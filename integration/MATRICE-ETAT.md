# Matrice d'audit

| État | Anomalie ou risque | Cause possible et fichiers | Mesure et limite |
|---|---|---|---|
| Confirmé | ORBIT a produit une vidéo noire sans points | Source Camo ou méthode OpenCV ; original/orbit.py | Choix MSMF/DirectShow et numéro de caméra dans orbit_integrated.py ; flux réel à confirmer. |
| Confirmé | Camo a fourni parfois un écran d'attente gris | État de sortie Camo ou téléphone, cause non établie | Un flux non noir ne prouve pas une caméra active ; vérifier visuellement. |
| Confirmé | Le lanceur Python ne détectait pas 3.11 alors que son exécutable existe | original/launch.bat | Lanceur utilise l'environnement local existant et installateur séparé. |
| Confirmé | Les anciens modes webcam étaient distincts | original/orbit.py et original/handswizard_webcam.py | Suivi, rendu, enregistrement et souris réunis dans orbit_integrated.py et mouse_core.py. |
| Risque | Clic maintenu après perte de main ou arrêt | mouse_core.py, safety.py | Pause initiale, relâchement sur perte/erreur, F8 et surveillance de trame ; sécurité réelle non validée. |
| Risque | Deux distributions OpenCV partagent cv2 | environnement Python existant | Conservées sans suppression ; nouvel installateur utilise uniquement opencv-contrib-python. pip check passe mais ne détecte pas tout conflit de fichiers. |
| Confirmé | GPU NVIDIA visible mais OpenCV CUDA retourne 0 | pilote/bibliothèque, diagnostic | Suivi CPU ; aucune accélération NVIDIA revendiquée. |
| Limitation | Démonstration manuelle et précision des gestes | caméra et main réelles nécessaires | À valider avec l'utilisatrice ; les tests simulés ne prouvent pas le fonctionnement physique. |

Le code source préexistant a été copié dans original/ et enregistré dans Git au point 35806f7. Les versions originales sur le Bureau et leurs données sont conservées.

