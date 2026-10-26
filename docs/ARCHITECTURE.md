# Architecture et contraintes de Mines Mobile

Le téléphone est un client de contrôle. Un hôte Mines desktop ou CLI conserve les projets, exécute les fournisseurs et produit les événements durables. Le mobile transmet des commandes authentifiées, affiche ces événements et présente les demandes nécessitant une réponse humaine. Aucun processus Codex, Claude ou autre agent ne s’exécute sur le téléphone.

## Base partagée et compatibilité

Le client utilise React Native 0.88 et Expo 58 avec des modules natifs. Les plateformes partagent les règles de données et d’autorisation ; leurs contrôles et surfaces natives peuvent différer.

| Couche                                                      | Responsabilité                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/mobile`                                               | Navigation, composer, transcript virtualisé, fichiers/diffs et adaptateurs de plateforme.  |
| `packages/client-runtime`                                   | Connexions, autorisations, RPC, états des hôtes, historique, catalogue et commandes.       |
| `packages/contracts`                                        | Schémas du protocole, permissions et capacités partagés avec les hôtes existants.          |
| Modules natifs et dépendances embarquées avec leurs notices | Éditeur, rendu du texte et des diffs, terminal, contrôles et intégrations des plateformes. |

Cette extraction ne modifie ni les hôtes desktop ni le protocole. Une évolution exigeant une nouvelle capacité serveur doit être proposée avec sa dépendance avant publication côté hôte. La version affichée ne suffit pas à déduire qu’un hôte implémente une opération.

L’exécutable CLI expose seulement une partie du runtime : projets, conversations, attente, compte et accès. Son processus hôte publie aussi streaming, questions, groupes, fichiers, checkpoints et orchestration. Le mobile appelle ces services via leurs contrats ; il n’exécute pas une commande shell pour chaque interaction. Les outils réservés à l’agent ou à l’administration système ne deviennent pas automatiquement des écrans mobiles.

## Identités et autorités

Le compte Mines utilise le service d’identité configuré et `/api/auth/*`. Un token compte ne constitue pas à lui seul un droit d’agir sur un hôte. Chaque environnement conserve ses autorisations et l’identité de destination est vérifiée à la connexion.

Le parcours pris en charge sur mobile utilise un compte Mines, une identité d’appareil approuvée et une session WebRTC directe avec les contrats RPC existants. Le resolver exige un `peerDeviceId` pour les profils bearer ; un lien historique à jeton seul ne rend pas un hôte utilisable, y compris sur loopback. L’interface refuse cette voie avant échange de credential. Un appareil doit être approuvé par une personne ; aucune approbation n’est déduite d’un QR ou exécutée en arrière-plan. La politique de confiance partagée n’a pas été assouplie.

L’origine d’un QR peer doit correspondre à l’origine HTTPS du service de compte configuré avant de charger ou transmettre le token compte. Comptes, hôtes et routes ne sont pas interchangeables.

Les opérations d’accès utilisent les commandes gardées du runtime : lecture sous `access:read`, modification sous `access:write`, avec contrôle serveur faisant autorité. Une autorisation exige comparaison du code et confirmation listant les droits. À l’envoi, les droits restent limités à l’intersection des permissions confirmées et encore détenues. Les demandes expirées ou visant un autre hôte sont rejetées.

Le CLI privé inspecté ne possède pas `peer.pairingRequests`, `peer.approvePairing` ni `peer.denyPairing`, présents dans la base desktop inspectée. La consultation des demandes est volontaire, bornée à 15 secondes, sans polling, retry ou reconnexion déclenchés par l’absence d’opération. L’échec produit un état indisponible ; il ne signifie pas « aucune demande ».

## Bibliothèque locale et bibliothèque de compte

Le téléphone conserve un catalogue local séparé des catalogues de compte. Ce stockage local ne crée aucun droit de connexion à un hôte. Les profils bearer historiques sans peer approuvé ne sont pas une voie de contrôle distant prise en charge. Avec un compte connecté, la bibliothèque affiche les environnements autorisés de ce compte ; les données locales ne sont pas importées automatiquement dans sa réplique.

Le mode compte synchronise le catalogue sur des sessions peer approuvées. Une commande nécessitant un contexte répliqué vérifie l’identité courante et attend la synchronisation ; elle échoue si celle-ci ne peut être établie. Changer de compte n’autorise pas à réutiliser le contexte ou les sessions de l’ancien compte.

## Transport, reprise et consommation

Le runtime possède une session Effect RPC partagée par environnement actif et multiplexe les abonnements shell, conversation et sortie de commande. Il ne relit pas l’historique par une boucle HTTP. Snapshots bornés, deltas, `afterSequence` et curseurs d’historique permettent reprise et chargement progressif lorsque l’hôte les supporte.

Le transcript utilise une liste virtualisée. Pages d’historique, métadonnées et ressources se chargent à la demande ; les mécanismes partagés regroupent les écritures de cache et mises à jour fréquentes. Les abonnements libèrent leurs ressources lorsqu’ils ne sont plus nécessaires.

Le superviseur applique un backoff exponentiel plafonné avec jitter et réagit à la connectivité. Au retour au premier plan, il vérifie ou remplace une session obsolète. Les heartbeats périodiques de baux sont limités à l’état actif ; le passage en arrière-plan conserve un signal de visibilité puis arrête les réveils périodiques correspondants.

La file d’envoi conserve les identifiants de commande et distingue acceptation, refus et résultat incertain. Une perte de réponse ne justifie pas une nouvelle commande identique. Ce parcours diffère d’un lancement MCP qui peut ne pas posséder de clé de retry : le mobile conserve son chemin d’orchestration durable.

La suspension et la fermeture de sockets par iOS/Android restent possibles. Les tâches continuent sur l’hôte selon sa propre politique ; aucune connexion permanente du téléphone ou exécution locale continue n’est garantie.

## Stockage et diagnostics

Sessions, clés privées et caches de tokens utilisent SecureStore ; les écritures sensibles sont configurées avec `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Le cache privé du catalogue est chiffré avec authentification, une clé SecureStore et un contexte lié à l’enregistrement. Catalogue local et identité de compte restent séparés.

Les erreurs du cache de tokens relay journalisent seulement les métadonnées d’opération, jamais les causes de décodage susceptibles de conserver des valeurs secrètes. Liens d’appairage, tokens, clés privées et URL donnant des droits ne doivent pas figurer dans les logs, captures partagées ou rapports.

Les tests peuvent utiliser des adaptateurs simulés dans leurs fixtures. L’application normale ne dépend pas d’un environnement showcase, faux fournisseur ou succès de remplacement.

## Capacités et limites opérationnelles

Le catalogue de modèles et les capacités d’outils proviennent de l’hôte connecté. Codex, Claude, Cursor, OpenCode, Grok et ACP n’offrent pas les mêmes approbations, questions, modes, interruptions ou sous-agents. Une demande n’est répondable que si son callback est encore live et si la session possède les droits requis.

Push, voix, widgets, intégrations navigateur et visualisation d’appareils nécessitent leurs propres capacités et parfois une configuration externe. Leurs sources ne prouvent pas leur fonctionnement dans cette préversion. APNs/FCM, EAS, stores et nouveaux services facturables ne sont pas provisionnés. Les OTA restent désactivées par défaut.

Builds, checksums, essais natifs, captures et parcours sur hôte doivent être consignés séparément dans le bilan de validation. Les tests isolés du transport/catalogue ne certifient pas un fournisseur, réseau ou appareil physique. Aucun test ne nécessite de modifier le VPS ou de démarrer un serveur sur les données utilisateur.
