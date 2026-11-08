# winmap spacial takeover

Prototype expérimental d’un bureau moléculaire en 3D pour Windows 11. Le nom du projet conserve exactement l’orthographe demandée : **winmap spacial takeover**.

L’idée centrale : un dossier devient un noyau, ses sous-dossiers deviennent des atomes liés, les fichiers des électrons, et les applications ou widgets gravitent autour des espaces qui leur donnent du sens. La 3D sert à montrer cette structure et à la manipuler; elle ne sert pas de décor à un tableau de bord.

## Lancer sous Windows 11

1. Gardez ensemble les fichiers de ce dossier.
2. Double-cliquez sur `Start-Winmap.cmd`.
3. Le lanceur cherche Edge dans les emplacements Windows habituels et ouvre Winmap dans une fenêtre maximisée, sans onglets ni barre d’adresse, avec un profil Edge local au dossier de l’application. Si Edge n’est pas installé, Windows tente d’ouvrir le fichier dans le navigateur par défaut. Fermez la fenêtre pour quitter.

Ce lancement ne demande ni installation, ni compte, ni dépendance. La fenêtre peut couvrir les icônes pendant que Winmap est ouvert, mais le bureau Windows reste intact derrière elle. `Alt+F4` ferme Winmap et rend immédiatement le bureau original.

Pour une fenêtre installable avec le cache hors ligne, publiez le dossier en HTTPS, ouvrez-le dans Edge et choisissez **… → Applications → Installer ce site en tant qu’application**. Les sites installés s’ouvrent dans une fenêtre autonome; ils ne remplacent toujours pas le bureau Windows. Voir le [guide Microsoft pour installer un site comme application](https://support.microsoft.com/en-gb/edge/install-manage-or-uninstall-apps-in-microsoft-edge).

## Publier la démo web sur GitHub Pages

Le dépôt GitHub n’a pas été créé. Pour publier la démo, crée le dépôt, puis envoie les sources de l’archive **Code source** sur sa branche `main`.

1. Dans **Settings → Pages → Build and deployment**, choisis **GitHub Actions** comme source, conformément au [guide officiel GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
2. Pousse les sources sur `main`. Le workflow `.github/workflows/pages.yml` lance les vérifications JavaScript; il déploie ensuite les sept fichiers web nécessaires. Les pull requests exécutent les vérifications sans publier le site.
3. Ouvre l’adresse HTTPS affichée par GitHub Pages. Le contexte sécurisé permet au navigateur de demander l’accès local à un dossier; ces fichiers restent sur l’appareil et ne sont pas téléversés par Winmap.

GitHub Pages héberge la démo web. Le host Windows WebView2 et son intégration facultative au bureau restent à compiler et à lancer localement selon la section **Hôte Windows natif**. Les sites GitHub Pages sont accessibles publiquement; ne mettez pas de fichiers privés dans le dépôt.

## Explorer l’espace

- **Explorer un dossier** : cliquer une icône de dossier pour entrer dedans. Ses éléments et les applications reliées apparaissent ensemble. Recliquer l’objet au centre ou remonter dans le fil d’Ariane revient à l’échelle précédente.
- **Changer d’échelle** : glisser sur le fond pour tourner la caméra; la molette zoome. En continuant à dézoomer, Winmap ouvre des coquilles spatiales génératives autour de l’espace courant. Les nouvelles coquilles montrent des objets de démonstration locaux; elles ne représentent pas de vrais dossiers Windows.
- **Voir les détails** : cliquer une application, un fichier ou un widget ouvre son panneau. Les applications et widgets de démonstration sont interactifs.
- **Suivre une tâche** : ajouter une tâche dans un dossier. Son atome affiche l’état et une barre de progression; depuis son panneau, tu peux la démarrer, la mettre en pause et avancer par pas de 10 %. La progression est manuelle et locale; cette fonction ne lance pas de processus Windows.
- **Lire un fichier connecté** : son panneau ouvre un aperçu local des petits fichiers texte et des images courantes. Le texte, y compris le HTML, s’affiche comme texte et ne s’exécute pas. L’aperçu ne modifie jamais le fichier.
- **Ouvrir l’espace et les réglages** : les deux sphères moyen-grand format en haut à gauche ouvrent le menu **Espace** et le menu **Réglages**. Chaque commande reste placée sur la coque volumétrique 3D, est rendue comme une sphère par le moteur WebGL du bureau et se manipule avec la même caméra orbitale; glisser sur le fond fait tourner la sphère sur 360°. Cliquer sur l’autre bouton sphérique bascule directement de menu; recliquer sur le bouton actif ferme le globe. **Explorer** mène à la recherche et aux dossiers locaux; **Réglages** mène aux champs physiques et au rythme.
- **Marcher dans le graphe** : ouvrir la sphère **Espace** et choisir **Mode veille**. La caméra se place au cœur de l’espace courant, entourée d’une enveloppe translucide qui laisse voir le graphe. `W A S D` fait avancer, reculer et se déplacer; `Q` et `E` descendent ou montent; glisser sur le fond fait tourner le regard. `Échap` revient à la vue orbitale.
- **Réorganiser** : glisser un atome dans un dossier visible. Winmap montre d’abord la destination et demande confirmation. Le glisser sur un autre point de son orbite change sa position spatiale.
- **Trouver un élément** : bouton de recherche ou `Ctrl+K`; la recherche lit les noms, extensions et chemins de dossiers sans distinguer les accents. Le chemin départage les objets qui portent le même nom; le compteur reste exact même si plus de 24 résultats correspondent. Les flèches parcourent les résultats et Entrée ouvre l’élément.
- **Comprendre les champs** : Magnétisme met en évidence les relations entre objets; Gravité représente la courbure créée par la masse d’un espace; Charge montre des polarités positives et négatives. Ces phénomènes sont des repères visuels, pas des forces appliquées aux fichiers ni une simulation scientifique quantitative.
- **Menus spatiaux** : les boutons sphériques **Espace** et **Réglages** en haut à gauche ouvrent la même coque 3D volumétrique, avec les sphères d’action moyen-grand format et la caméra orbitale du bureau. Les commandes occupent toute la sphère; glisse sur le fond pour en faire le tour à 360°. **Espace → Explorer** rassemble la recherche et les dossiers locaux. Les noyaux des vues secondaires ramènent à la sphère Espace; le noyau Espace ferme le globe. Les barres, titres et coordonnées fixes disparaissent tant que le globe est ouvert.
- **Régler les phénomènes** : le bouton **Réglages** ouvre les sphères Magnétisme, Gravité, Charge et Rythme. Le rythme parcourt les modes vivant, calme et repos; au repos, Winmap réduit aussi la fréquence de rendu. Winmap respecte le réglage de mouvement réduit de Windows.
- **Créer dans un dossier** : choisir le dossier, utiliser « Créer ici », puis choisir un dossier, un fichier spatial, une application ou un widget. Cette création modifie la carte Winmap seulement; elle ne crée pas un fichier Windows.

## Ce qui est inclus

- Un espace « Écosystème » autour du Bureau, avec des coquilles de démonstration « Mémoire », « Création » et « Réseau », puis une hiérarchie de dossiers Documents, Projets, Images et Téléchargements.
- Des sous-dossiers et fichiers d’exemple répartis sur plusieurs niveaux, ainsi que les applications représentées Navigateur, Atelier code, Photothèque, Atelier 3D et Bloc-notes.
- Trois widgets locaux : horloge, minuteur de concentration de 25 minutes et résonance du système.
- Une tâche d’exemple au Bureau et des tâches créables dans les autres espaces. Leur état et leur progression restent enregistrés localement.
- Un rendu WebGL 2 maison allégé : sphères, orbites atténuées, électrons, liens, champs visuels et caméra orbitale ou à la première personne. Les relations parent-enfant et les liens d’applications sont indexés hors de la boucle de rendu; seules les étiquettes de l’écosystème courant restent dans le DOM, même après de nombreuses explorations. Le canevas conserve un plafond de 1,25× sur les fenêtres ordinaires et limite son tampon à six mégapixels sur les grands écrans.
- Dans l’hôte natif uniquement, une action à la demande ajoute les fenêtres Windows visibles comme atomes temporaires et permet de remettre l’une d’elles au premier plan. Leur titre et leur handle ne sont pas enregistrés. La liste ignore les fenêtres sans titre et ne suit pas les processus d’arrière-plan sans fenêtre.
- Une navigation par clic et changement d’échelle, des coquilles générées à la demande, un menu 3D sphérique à 360° intégré au même moteur WebGL et une recherche instantanée.
- Sauvegarde locale de la hiérarchie, des positions orbitales, du champ, du rythme, du minuteur, du focus et de la caméra.

Les atomes d’application restent des repères de démonstration jusqu’à ce que tu leur associes un programme. Dans l’hôte natif, ouvre le panneau d’un atome et choisis un fichier `.exe`; l’association est conservée localement dans le profil WebView2. Le chemin reste dans l’hôte et n’est pas transmis à la scène. Une action distincte **Ouvrir** lance ensuite le programme choisi, sans arguments et seulement après ton clic. Aucun programme ne se lance au démarrage. En mode web, les atomes restent des représentations spatiales. Dans l’hôte natif, l’action **Fenêtres ouvertes** de la sphère de commande demande explicitement un instantané des fenêtres visibles; seules celles de cet instantané peuvent être ciblées pour revenir au premier plan. Les coquilles génératives sont des espaces visuels fictifs stockés dans la carte locale; elles n’écrivent rien sur le disque et ne sont pas des dossiers physiques.

## Connecter un vrai dossier

Le bouton **Connecter** demande au navigateur de choisir explicitement un dossier. Sur Edge ou Chrome dans un contexte sécurisé, Winmap peut lire localement les noms et tailles des éléments, jusqu’à 220 entrées et 5 niveaux pour garder la scène réactive. Les fichiers ne sont pas téléversés.

Le dossier est d’abord ouvert en lecture seule. Winmap conserve la référence dans le stockage protégé du navigateur et resynchronise la structure au démarrage quand l’autorisation de lecture est déjà accordée. Le panneau du dossier connecté offre aussi **Actualiser depuis le disque**. Si la permission a expiré, cette action la redemande. Tu peux aussi déposer un fichier ou un dossier depuis Windows sur un dossier connecté visible : Winmap demande une confirmation, copie puis vérifie le contenu et conserve l’original. Si l’API de dépôt de handles n’est pas disponible, le sélecteur de secours affiche les noms en **aperçu seulement**; il ne peut rien déplacer sur le disque.

Un déplacement sur le disque n’est proposé qu’après un glisser-déposer et une confirmation claire, entre éléments d’un même dossier connecté. Winmap refuse les collisions de noms et les déplacements dans un sous-dossier de soi-même. Il copie puis vérifie l’arbre complet : noms, types, nombre d’éléments et contenu octet par octet, par blocs d’un mégaoctet. Il ne retire l’original qu’après vérification complète. Si la copie échoue, l’original est conservé et une copie partielle peut rester à destination; inspectez-la avant de la supprimer manuellement. Si Windows refuse de retirer la source après la vérification, les deux exemplaires sont conservés et la carte est actualisée.

Les créations et renommages restent des modifications de la carte spatiale; ils n’écrivent pas sur le disque. Winmap ne propose pas de suppression autonome : le seul retrait réel est celui de la source après un déplacement confirmé et vérifié. Gardez une sauvegarde des fichiers importants avant de tester des déplacements réels.

Consultez le [guide officiel GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Un site GitHub Pages est publiquement accessible sur Internet : ne publiez pas de fichiers personnels dans ce dépôt.

## Hôte Windows natif

Un hôte WinForms/WebView2 optionnel est fourni dans `windows/Winmap.DesktopHost`. Il ouvre la même scène dans une fenêtre Windows native. Le host WebView2 limite la navigation à son contenu local et utilise une origine HTTPS virtuelle pour les API sécurisées. Le lanceur natif utilise un profil WebView2 local propre à cette version dans `dist\win-x64-recovery\.webview2-profile`, séparé de l’ancien build afin d’éviter les collisions de profil au démarrage. Sur cet ordinateur, le processus GPU de WebView2 a échoué avec « accès refusé »; le lanceur active donc le rendu logiciel afin de contourner ce blocage. Si WebGL2 est alors indisponible, Winmap bascule vers son rendu perspective Canvas 2D. Après un échec persistant du moteur de rendu, il ouvre la page locale dans une fenêtre Edge normale dédiée à son propre profil, attend qu’une fenêtre soit visible et la met au premier plan; si Edge ne fournit pas de fenêtre, il essaie le navigateur Windows par défaut. Les associations d’applications choisies sont conservées dans `registered-applications.json` sous ce profil. L’hôte n’accepte qu’un chemin `.exe` choisi avec le sélecteur Windows, n’envoie jamais ce chemin à la scène et démarre le programme sans arguments uniquement après une action explicite **Ouvrir**.

Le host consigne les étapes de création de WebView2, la navigation, le premier message de l’interface 3D et le résultat de l’ancrage dans `webview-startup.log`; les pannes de processus vont dans `webview-process-failures.log`. Si le profil est inaccessible, le journal de démarrage utilise `%TEMP%\Winmap Spacial Takeover\webview-startup.log`. Le mode bureau attend le signal de démarrage de l’interface avant de s’attacher; après 30 secondes sans signal, il devient une fenêtre normale et laisse Explorer intact. Si le moteur de rendu échoue, Winmap tente un rechargement, puis ouvre automatiquement l’interface dans le navigateur par défaut au second échec.

Pour le compiler sur Windows 11 :

1. Si `dotnet` n’est pas déjà disponible, exécute `powershell -ExecutionPolicy Bypass -File .\Install-Local-Dotnet.ps1`. Avec Node 18 ou plus récent, le script télécharge l’archive officielle .NET 10, vérifie son SHA-512, puis l’extrait sous `.tooling\dotnet`. Sinon, il utilise l’installateur officiel `dotnet-install`. Les données d’application et l’état CLI restent dans `.tooling`; le script ne modifie pas le PATH global ni le registre.
2. Exécute `Build-Winmap-Native.cmd`. Il construit dans `dist\win-x64-recovery` sans écraser l’ancien build `dist\win-x64`; son garde-fou protège uniquement l’exécutable exact qu’il remplace et laisse les autres builds Winmap intacts. Avec Node 18 ou plus récent, il prépare automatiquement dans `.tooling\nuget-feed` le paquet WebView2 et les runtimes x64 du SDK .NET, puis valide leurs SHA-512 via les métadonnées NuGet. Sans Node, il restaure depuis la source nuget.org du fichier `NuGet.Config`; une connexion Internet est requise dans les deux cas lors du premier build. Le cache de paquets NuGet se trouve sous `%TEMP%\wmap-nuget` pour éviter les limites de longueur de chemin de Windows. Le build restaure une fois, puis publie l’exécutable autonome et son dossier `wwwroot` dans `dist\win-x64-recovery`.
3. Exécute `Start-Winmap-Native.cmd`. Le runtime Evergreen Microsoft Edge WebView2 doit être installé sur la machine.
4. Pour essayer l’intégration au bureau, exécute `Start-Winmap-Desktop.cmd`. Ce mode opt-in attache Winmap au contrôle de bureau d’Explorer et le place devant les icônes sur l’écran principal. Fermer Winmap libère l’attachement; si Windows le refuse, le programme retombe sur sa fenêtre normale.
5. Après la compilation, exécute `node check-native-publish.cjs` pour confirmer que l’exécutable autonome et les sept fichiers Web publiés sont présents et identiques aux sources.

Le mode bureau est expérimental et doit être essayé sur la version de Windows cible : il utilise la classe de fenêtre interne `SHELLDLL_DefView`, qui peut changer avec Explorer. L’intégration ne modifie aucune clé de shell, ne masque pas les icônes par un réglage persistant et ne ferme pas d’autres applications; la barre des tâches reste gérée par Explorer. Dans l’hôte natif, choisis **Fermer Winmap** dans la sphère de commande pour retirer la surface. La fenêtre native normale demeure le mode de repli.

## État du bureau Windows

Le lanceur Edge d’origine (`Start-Winmap.cmd`) reste disponible. Le mode natif normal ouvre une fenêtre; le mode bureau natif tente un ancrage expérimental à Explorer et peut retomber sur une fenêtre. Aucun mode ne remplace le shell Windows. Le prototype n’est pas encore un widget autonome ancré derrière les icônes. Si le moteur natif échoue deux fois, le build de récupération ouvre la scène dans le navigateur par défaut et ferme le dialogue bloquant. Le rendu natif WebGL reste à confirmer visuellement. Le mode bureau possède un délai de 30 secondes et un journal local de démarrage pour basculer vers une fenêtre normale si la navigation reste bloquée.

### Cap à long terme

La direction visée est un choix au démarrage entre le bureau Windows normal et une session Winmap, puis une carte des dossiers locaux dans Winmap. Ce parcours n’est pas encore implémenté : Windows démarre normalement, Winmap se lance manuellement et seuls les dossiers choisis explicitement sont lus. Avant d’offrir une session Winmap comme bureau de remplacement, il faudra valider la stabilité et prévoir un retour simple vers Windows depuis le démarrage.

Dans les vues génératives à partir de l’échelle 5, Winmap montre trois écosystèmes frères répartis à intervalle régulier sur une orbite commune, plus éloignée du noyau pour les voir ensemble. Ils restent dans le même plan, avec un seul guide orbital discret afin de réduire le bruit visuel. Cette orbite se resserre sur les écrans étroits. La caméra reste orbitable à 360°. La flèche de la barre supérieure et Échap remontent d’un écosystème à la fois; **Le Bureau** dans la sphère de commande ramène directement à la racine.

Tout le rendu et le comportement principal vivent dans `space-engine.js`, `app.js` et `styles.css`. Si WebGL 2 ne peut pas s’initialiser, un moteur Canvas 2D reprend la même caméra perspective, la projection 3D, les orbites, les champs, les atomes et la sphère de commande; les déplacements et la sélection conservent la même géométrie. Ce mode privilégie l’affichage et l’accès plutôt que la vitesse du rendu WebGL. Il n’y a ni service distant, ni télémétrie, ni bibliothèque tierce requise pour l’exécution.

## Vérifications

Les 17 scripts `verify-*.cjs`, les contrôles `node --check` de JavaScript et le contrôle du paquet natif passent. Ils exercent la logique avec des objets simulés et des fichiers temporaires; ils ne prouvent pas le rendu réel dans Edge ni l’intégration à Explorer.

- Un hôte x64 autonome .NET 10 est publié dans `dist\win-x64-recovery`; les sept fichiers `wwwroot` sont vérifiés par empreinte. Le host attend le signal `page-bridge-ready` avant l’ancrage natif et journalise chaque étape de démarrage. Le build hérité reste intact pendant qu’une instance le référence.
- `node check-native-publish.cjs` vérifie l’exécutable publié, les sept ressources Web obligatoires et leurs empreintes SHA-256 identiques aux sources.
- Les journaux WebView2 disponibles indiquent `RenderProcessExited / LaunchFailed` (code 49) et un processus GPU arrêté avec `0xC0000022` (accès refusé). Le lanceur natif courant active `--disable-gpu` et conserve le rendu Canvas 2D comme repli. L’hôte a été recompilé avec cette configuration; son affichage doit encore être confirmé au lancement sur Windows.
- La syntaxe JavaScript actuelle passe `node --check app.js`, `node --check space-engine.js` et `node --check sw.js`.
- `node verify-renderer.cjs` fait un test fumée avec un contexte WebGL simulé : les trois champs, le budget de pixels selon la résolution, l’enveloppe de la vue subjective, l’opacité atténuée des orbites, l’agrandissement du tampon d’électrons, la coque du menu sphérique et le rendu par lots des orbites, des liaisons et des sphères sont couverts. À la limite d’import de 220 objets, les vues Charge et Magnétisme utilisent respectivement 5 et 7 appels de dessin pour la scène, au lieu de centaines de petits appels. Ce test ne vérifie ni les pixels ni le pilote graphique d’Edge.
- `node verify-canvas-fallback.cjs` exerce le chemin Canvas 2D sans WebGL : caméra perspective, projection d’orbites 3D, déplacement sur plan, atomes ombrés, flux d’électrons et menu sphérique.
- `node verify-menu-sphere.cjs` exerce les vues sphériques Espace, Explorer et Réglages, l’ouverture directe et la bascule entre les deux boutons sphériques, la fermeture par le bouton actif, le focus clavier et son retour, les champs physiques, la restauration caméra, la géométrie 360°, l’hémisphère visible, le mouvement et les messages natifs.
- `node verify-frame-pacing.cjs` vérifie les cadences visées de 30 images/seconde en mode calme, 45 pendant l’interaction et 4 au repos, le réveil immédiat au geste, l’arrêt lorsque la page est cachée, les index de liens construits hors rendu et la libération des étiquettes des couches quittées.
- `node verify-file-tree.cjs` vérifie l’arbre complet de fichiers avec des handles simulés : contenu identique accepté, octets modifiés et élément ajouté refusés.
- `node verify-file-preview.cjs` vérifie l’aperçu texte non exécutable, la limite de 512 Kio, les images avec libération de leur URL temporaire et le refus de lecture sans permission.
- `node verify-native-windows.cjs` vérifie l’instantané à la demande, le plafond de 32 fenêtres, le nettoyage des titres, les liens vers le focus, la sélection d’exécutables locaux sans transmission de chemin à la scène, les réponses de lancement explicites et l’absence de persistance des titres/handles de fenêtres temporaires.
- `node verify-navigation.cjs` vérifie les vues de dossier, les éléments reliés, la séparation spatiale des univers frères, le déplacement d’un univers hors du plan partagé, un tour caméra complet à 360° par glissement, le déplacement d’un univers vers un autre dossier, l’entrée/sortie au clic, les seuils de zoom, la temporisation de création des coquilles, le verrouillage du zoom en vue subjective, la recherche par chemin et la position d’une chaîne de 12 000 écosystèmes sans récursion.
- `node verify-tasks.cjs` vérifie les états de tâche, la pause/reprise, la progression bornée à 100 %, l’achèvement et le redémarrage.
- `node verify-scales.cjs` crée treize coquilles successives, vérifie l’espacement commun des univers frères profonds et l’adaptation aux écrans étroits, puis exerce l’entrée par clic et deux remontées réelles; chaque échelle garde son monde intérieur et génère dossiers, application, fichier et widget.
- `node verify-persistence.cjs` vérifie l’état par défaut, la migration de l’ancienne structure, la récupération après données invalides et un cycle de sauvegarde/restauration du focus, des orbites, du plan partagé entre univers profonds, de la caméra et du minuteur.
- `node verify-refresh.cjs` vérifie la conservation du focus, de la sélection et du zoom, l’effacement des éléments absents, le refus d’une resynchronisation sans permission de lecture, la resynchronisation automatique sans invite et la reconnexion sans doublon.
- `node verify-walk.cjs` vérifie l’entrée en vue subjective, les déplacements `W A S D` et `Q E`, la vitesse diagonale, la rotation à la souris, le retour orbital et la sauvegarde caméra. Ce test ne remplace pas le contrôle visuel dans Edge.
- `node verify-external-drop.cjs` vérifie la cible de dépôt Windows, l’accès aux handles en synchronie, le repli File/Directory Entries et la copie destination avec contrôle des collisions, des permissions et du contenu.
- `node verify-native-host.cjs` vérifie les assets WebView2 locaux, l’origine sécurisée, les étapes journalisées, l’attente du signal de l’interface avant l’ancrage, le délai de repli en fenêtre, l’isolation du profil, le blocage des navigations externes et l’absence de remplacement du shell.
- `node verify-markup.cjs` repère les identifiants HTML dupliqués, les références manquantes du code, les liens locaux cassés et les contrôles sans cible; il vérifie les URL relatives sous le chemin d’un dépôt GitHub Pages et que le lanceur ouvre Edge sans tuer d’application ni modifier le shell Windows.
- `node verify-pages-workflow.cjs` vérifie que GitHub Actions exécute les contrôles sur les pull requests, réserve le déploiement à `main` et publie seulement les fichiers web dans Pages.
- Les interactions de navigation, le rendu WebGL, l’accès à un dossier réel, le dépôt depuis Explorer, la remise au premier plan des fenêtres et l’ancrage à Explorer restent à revalider visuellement. L’interface et les interactions du host natif restent à essayer à l’écran.

### Parcours de validation manuelle à effectuer

1. Lance `Start-Winmap.cmd`. Clique **Documents**, puis son atome central pour remonter. Utilise aussi le fil d’Ariane pour revenir directement au Bureau.
2. Dézoome jusqu’à franchir la limite de la vue, entre dans une coquille créée, puis remonte au niveau précédent. Vérifie que le contenu intérieur reste présent.
3. Ouvre **Espace**, passe par **Explorer**, puis reviens au globe. Glisse le fond pour en faire le tour complet. Ouvre **Réglages**, puis Magnétisme, Gravité et Charge; vérifie leurs arcs, leur puits et leurs électrons.
4. Dans la sphère, choisis **Mode veille**, déplace-toi avec `W A S D` et `Q E`, tourne la vue en glissant, puis quitte avec `Échap`. Recharge la page et vérifie que le focus et la caméra sont conservés.
5. Pour le dépôt réel, crée un dossier temporaire réservé à l’essai, avec `Source\Lot\élément-test.txt` et un dossier `Destination` vide. Connecte la racine à Winmap, garde **Destination** visible, puis glisse `Lot` de l’Explorateur Windows sur son atome. Confirme l’écriture. Vérifie que le fichier copié contient le même texte et que `Source\Lot` existe toujours.
6. Répète avec un nom déjà présent dans la destination : Winmap doit refuser la copie sans remplacer l’existant. Ferme Winmap; le Bureau original doit réapparaître.
7. Dans l’hôte natif, tourne la sphère de commande jusqu’à **Fenêtres ouvertes**, sélectionne un atome de fenêtre puis **Mettre la fenêtre au premier plan**. Recharge Winmap : les fenêtres temporaires doivent disparaître jusqu’au prochain instantané.

Pour essayer l’ancrage natif, compile d’abord `windows/Winmap.DesktopHost`, lance `Start-Winmap-Desktop.cmd`, puis répète le dernier contrôle dans une session Windows de test. Le mode bureau peut retomber sur une fenêtre normale si Explorer ne fournit pas le point d’attache attendu.

La capture vidéo fournie n’a pas pu être inspectée dans l’environnement d’exécution; la vérification visuelle du menu sphérique reste à faire dans un navigateur accessible. Les suites `verify-*.cjs` ne vérifient ni le pilote WebGL, ni les dialogues de permission du navigateur, ni le transfert OLE réel de Windows.

### Essais rapportés sur une révision antérieure (non repris depuis)

- Ouverture dans Chrome avec WebGL 2, trois widgets visibles et aucune erreur JavaScript.
- Recherche, création dans un dossier, champs physiques, minuteur et restauration de l’état après rechargement.
- Déplacement par glisser-déposer dans la maquette et import de dossier en aperçu.
- Copie, comparaison exacte et retrait de la source exercés sur des fichiers de test dans le stockage privé temporaire du navigateur. Aucun dossier personnel Windows n’a été modifié pendant ces essais.
- Cache hors ligne vérifié après le premier chargement.

