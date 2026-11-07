# Commande vocale et suite d'ORBIT

## Deux usages distincts

- La dictée transforme la parole en texte avant l'envoi.
- La conversation vocale permet d'échanger oralement en continu.

L'application peut proposer un raccourci configurable pour le chat vocal. Le choix et la portée exacte de ce raccourci doivent être vérifiés dans l'installation utilisée. Aucun raccourci de dictée n'a été confirmé pour cette installation. ORBIT ne déclenche pas encore le micro ; il n'écoute ni n'enregistre le son.

`voice_gestures.py` contient un prototype désactivé par défaut qui reconnaît deux poses à deux mains : deux signes en V suggèrent la conversation vocale, deux index levés suggèrent la dictée. Il attend plusieurs observations pendant au moins 2,5 secondes et n'émet qu'un événement jusqu'au relâchement. Il ne commande aucune application ni aucun microphone et n'est pas branché à l'interface. Ces gestes n'ont été vérifiés qu'avec des points synthétiques ; confort, reconnaissance et risque de déclenchement involontaire restent à tester.

Une intégration gestuelle sûre doit exiger une activation explicite, utiliser uniquement un raccourci confirmé par l'utilisateur, bloquer les clics pendant le geste, éviter les répétitions et rester désactivable. Ne pas supposer qu'un raccourci est valable dans toutes les applications ni envoyer une touche dans une fenêtre non identifiée. L'envoi automatique de messages n'est pas prévu.

## Étapes suivantes

1. Tester les gestes expérimentaux de pause et de reprise avec une personne présente, sans cliquer sur des commandes sensibles. Conserver F8 comme solution de secours.
2. Vérifier le réglage du raccourci vocal sur l'installation utilisée et tester une solution de déclenchement volontaire, distincte de la pause souris.
3. Utiliser le validateur de données sur des exemples synthétiques. Toute session réelle devra être choisie explicitement par son propriétaire. Le validateur n'ouvre pas les vidéos.
4. Ajouter un aperçu des démonstrations, l'annotation et un format de données documenté avant toute expérience d'apprentissage en simulation.

La reconnaissance gestuelle observée en direct n'établit pas encore la précision physique, l'apprentissage robotique ni la sûreté d'un système de robotique.
