# Version expérimentale — gestes de pause

Cette version est distincte de la version courante. Les gestes de pause/reprise et le validateur de données ont été testés uniquement avec des entrées synthétiques ; ils ne sont pas validés avec une caméra ou des mains réelles.

Le geste prévu est un poing tenu au moins 1,2 seconde pour demander la pause. Pour la reprise volontaire, relâcher les poings, puis tenir deux poings devant la caméra au moins 2 secondes ; ouvrir ensuite la main avant un nouveau clic. Plusieurs images successives sont exigées pour éviter qu'une interruption prolongée ne compte comme un geste maintenu. Un clic maintenu est relâché dès qu'un geste de pause est détecté. F8 reste une solution de secours logicielle, avec les limites indiquées dans le guide. Ne pas utiliser ces gestes pour des opérations sensibles avant validation.

Pour l'essai futur, fermer normalement l'autre instance ORBIT afin qu'elle ne monopolise pas la caméra, puis lancer `Lancer-ORBIT.cmd` dans ce dossier. Le contrôle démarre en pause. La version précédente et ses données sont préservées.

La commande du micro n'est pas encore reliée aux gestes. La conversation vocale et la dictée nécessitent des déclencheurs confirmés dans l'application ; voir `VOIX_ET_SUITE.md`. Le validateur de données n'est lancé que sur un dossier explicitement choisi ; les essais réalisés pour cette version ont utilisé uniquement des données fictives.

