# Matrice d'audit

| État | Anomalie ou risque | Cause possible et fichiers | Mesure et limite |
|---|---|---|---|
| Confirmé | ORBIT a produit une vidéo noire sans points | Source Camo ou méthode OpenCV ; original/orbit.py | Choix MSMF/DirectShow et numéro de caméra dans orbit_integrated.py ; flux réel à confirmer. |
| Confirmé | Camo a fourni parfois un écran d'attente gris | État de sortie Camo ou téléphone, cause non établie | Un flux non noir ne prouve pas une caméra active ; vérifier visuellement. |
| Confirmé | Le lanceur Python ne détectait pas 3.11 alors que son exécutable existe | original/launch.bat | Lanceur utilise l'environnement local existant et installateur séparé. |
| Confirmé | Les anciens modes webcam étaient distincts | original/orbit.py et original/handswizard_webcam.py | Suivi, rendu, enregistrement et souris réunis dans orbit_integrated.py et mouse_core.py. |
| Risque | Clic maintenu après perte de main ou arrêt | mouse_core.py, safety.py | Pause initiale, relâchement sur perte/erreur, F8 et surveillance de trame ; une voie Windows de secours est utilisée si le coin de sécurité empêche le relâchement. Un appel système bloqué peut retarder l'arrêt. Sécurité réelle non validée. |
| Corrigé et testé en simulation | Souris activable si la surveillance ne démarre pas | orbit_integrated.py, safety.py | Désactivation du contrôle si le moniteur échoue ; activation refusée après erreur ou lorsque F8 est maintenu. |
| Corrigé et testé en simulation | La première main détectée peut changer quand deux mains sont visibles | hand_selector.py, orbit_integrated.py | Sélection stable par étiquette, suspension si identification ambiguë ; à valider avec de vraies mains. |
| Corrigé et testé en simulation | Une disparition momentanée de la main met le contrôle en pause | mouse_core.py | Relâchement du clic immédiat et reprise sans clic après retour d'une main ouverte ; F8 reste un arrêt manuel. |
| Corrigé et testé en simulation | L'image était inversée en plus des réglages de Camo | orbit_integrated.py | Orientation de Camo conservée par défaut ; M bascule le miroir. |
| Risque | Deux distributions OpenCV partagent cv2 | environnement Python existant | Conservées sans suppression ; nouvel installateur utilise uniquement opencv-contrib-python. pip check passe mais ne détecte pas tout conflit de fichiers. |
| Confirmé | GPU NVIDIA visible mais OpenCV CUDA retourne 0 | pilote/bibliothèque, diagnostic | Suivi CPU ; aucune accélération NVIDIA revendiquée. |
| Limitation | Démonstration manuelle et précision des gestes | caméra et main réelles nécessaires | À valider avec l'utilisatrice ; les tests simulés ne prouvent pas le fonctionnement physique. |
| Candidat expérimental | Geste interrompu ou observé trop rarement | gestures.py | Plusieurs observations rapprochées sont exigées avant la pause ou la reprise. Reconnaissance réelle et faux positifs à mesurer. |
| Candidat expérimental | Session incomplète ou données de points incohérentes | dataset_validator.py | Contrôle des métadonnées, des dates, des points et de leur ordre CSV/JSONL. Testé sur données synthétiques ; n'ouvre pas de vidéo. |
| Candidat expérimental | Qualité d'une démonstration difficile à évaluer | data_quality.py | Résumé de la cadence et des interruptions, sans afficher les coordonnées ; n'établit pas la précision physique. |
| Candidat expérimental | Un diagnostic interrompu pourrait être confondu avec une réussite | diagnostic.py | Un délai dépassé est signalé comme incomplet et retourne un code non nul ; testé sans caméra. |

Le code source préexistant a été copié dans original/ et enregistré dans Git au point 35806f7. Les versions originales sur le Bureau et leurs données sont conservées.

