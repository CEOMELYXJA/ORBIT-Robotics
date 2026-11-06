# ORBIT Robotics

Prototype Windows de capture et de suivi des mains, d'enregistrement structuré et de contrôle expérimental du curseur.

## État

L'intégration actuelle réunit la capture vidéo, MediaPipe Hands, l'affichage des points, l'enregistrement et un contrôle facultatif de la souris. Le contrôle démarre en pause. Les tests automatisés utilisent principalement des entrées simulées ; la reconnaissance des gestes et les mécanismes de sécurité avec une caméra réelle restent à valider.

La touche F8 demande l'arrêt du contrôle. Le mécanisme de surveillance partage un verrou avec le pilote de souris : un appel système bloqué peut retarder cet arrêt. Ne pas utiliser cette version comme dispositif de sécurité critique.

## Organisation

- `integration/` : application, lanceur Windows, diagnostic, tests et documentation.
- `archives_experimentales/` : versions antérieures et prototypes non maintenus, conservés pour référence.

Consulter `integration/LISEZ-MOI.md` pour le démarrage et `integration/MATRICE-ETAT.md` pour les limites connues. Les données de capture, environnements locaux et rapports propres à une installation ne font pas partie du dépôt.

