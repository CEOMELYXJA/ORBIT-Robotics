# Repères Windows — validation locale

11 novembre 2026. La scène Winmap existante reste une interface 3D séparée. Le nouveau tableau de repères est une interface 2D Windows complémentaire, pas un système de fenêtres intégrées dans la scène.

- 131 tests Python réussis, dont cinq consacrés au nouveau tableau (mémoire, conservation des versions, rejet de coordonnées invalides, ambiguïté, restauration simulée).
- Six scripts JavaScript de la scène et des outils réussis avec données synthétiques.
- Une fenêtre temporaire propre au test a été réellement déplacée et redimensionnée sous Windows sur chacun des deux écrans détectés. Aucune autre fenêtre n'a été déplacée par ce test.
- Le tableau installé a démarré. Mesure ponctuelle au repos : environ 25 Mio de mémoire de travail et 0 seconde de temps CPU accumulé sur quatre secondes; ce n'est pas une mesure de charge interactive ni du système entier.
- Non vérifié : association et retour au premier plan d'une application choisie par l'utilisatrice; persistance entre deux sessions réelles; reconnaissance d'une conversation ou d'un onglet; fluide 3D sur deux écrans; interaction manuelle réelle; comportement après débranchement d'un écran; gains RAM/GPU des autres applications.

L'association est volontaire, locale et basée sur le titre et la classe Windows. Un titre modifié ou un doublon empêche la correspondance; ces caractéristiques ne constituent pas une identité persistante infaillible. Les états successifs sont conservés dans `cockpit_state`. Le système ne suspend pas les applications et ne capture pas leur contenu.
