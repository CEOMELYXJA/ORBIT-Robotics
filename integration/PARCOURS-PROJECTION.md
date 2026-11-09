# ORBIT : du suivi des mains aux surfaces

## Ce qui existe

- ORBIT/Handswizard : contrôle du curseur à partir d'une caméra. Des déplacements et un clic ont été confirmés par l'utilisatrice ; la fluidité et la sécurité doivent encore être mesurées dans les usages projetés.
- Winmap : cockpit spatial local, contrôlable comme une application à la souris. Les objets de démonstration ne sont pas automatiquement des fenêtres ou applications réelles.
- Reality Remix : prototype séparé de scène 3D et de reconstruction synthétique. La reconstruction d'une vraie pièce n'a pas été confirmée.
- `projection_preview.py` : grille de cibles en fenêtre sur écran ordinaire, sans matériel supplémentaire. Il s'agit d'une simulation, pas d'une calibration physique.

## Étapes

1. Stabiliser le suivi et le clic à plusieurs distances, avec activation volontaire, pause et reprise vérifiables. Mesurer la précision et le délai avec l'utilisatrice quand elle est disponible.
2. Sur écran ordinaire, utiliser l'aperçu à quatre cibles et clarifier navigation et sélection dans Winmap. Critère : chaque cible est atteignable et le mode de contrôle est compréhensible.
3. Lorsqu'un projecteur est disponible, le configurer comme écran étendu et envoyer la surface de test sur cet écran. Mesurer résolution, luminosité, contraste, latence et lisibilité sur une surface réelle. Le matériel n'a pas encore été choisi ni testé.
4. Ajouter la calibration d'une surface plane : correspondance entre gestes, image et points de la surface, avec vérification des quatre coins et erreur mesurée. Le simulateur actuel ne réalise pas cette calibration.
5. Relier des applications et fenêtres réelles progressivement, en préservant l'arrêt et le retour au bureau. Puis étudier les surfaces multiples et les occultations ; elles ne sont pas implémentées aujourd'hui.
6. Relier Reality Remix lorsque les échanges et le rendu sont établis, puis étudier caméras additionnelles et suivi 3D. Une caméra 360° ne suffit pas à elle seule à garantir une position 3D précise.

Un projecteur affiche de la lumière sur une surface ; un PNG transparent ne crée pas, à lui seul, une projection flottante ou transparente. Sur une surface, le noir correspond généralement à l'absence de lumière envoyée par le projecteur, pas à une transparence parfaite.

La boutique et les produits peuvent évoluer en parallèle, mais les caractéristiques, compatibilités et fonctions du logiciel doivent être vérifiées avant d'être présentées comme disponibles. Les conversations et projets existants restent conservés ; ce document rassemble leurs étapes sans les fusionner ni déplacer leurs données.

