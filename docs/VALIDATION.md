# Validation de la préversion mobile

Date : 26 octobre 2026. Cette livraison est une préversion technique privée. Les agents restent sur les hôtes ; aucun fournisseur réel n’a été lancé par les essais. Le parcours natif compte + peer approuvé + agent reste à valider.

## Sources et compatibilité

- Base mobile inspectée : `mines-harness/macos` `3de42d577a1e744b465c4893254a1ca5dbe0fb67`.
- Catalogue/archives portés depuis le correctif desktop `1565c69760`, sans modifier sa copie : cartes Yjs, conservation des placements, journal avant RPC et restauration des seules opérations observées.
- CLI privé inspecté : `82b09e98f5cf585cb45e0a2489159d78c39155da`. Le CLI ancien ne possède pas toutes les RPC de demandes d’accès ; le client affiche cette absence.
- Licence MIT et notices/forks natifs conservés. Aucun endpoint, backend ou VPS modifié.

## Contrôles exécutés

| Contrôle                               | Résultat observé                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite mobile complète                  | 226 fichiers, 2 581 tests réussis après intégration archives/Workgroups.                                                                        |
| Après les derniers ajustements visuels | Compilateur React, graphe Android/iOS et typecheck ciblés réussis ; correction du placement iOS et du formulaire Android vérifiée visuellement. |
| Runtime partagé ciblé                  | 9 fichiers, 107 tests réussis : catalogue, réconciliation, contexte, envoi, historique et déduplication.                                        |
| Verrouillage WebRTC                    | 3 tests Node réussis : idempotence, remplacement de version, bloc interrompu refusé.                                                            |
| Typecheck mobile                       | Réussi.                                                                                                                                         |
| Format                                 | 1 239 fichiers contrôlés, réussi.                                                                                                               |
| Lint TypeScript/JavaScript             | Aucune erreur ; 213 avertissements hérités des composants React et tests existants conservés dans le bilan local.                               |
| SwiftLint strict                       | 20 fichiers d’implémentation, aucune violation.                                                                                                 |
| ktlint + detekt                        | 33 fichiers Kotlin, y compris les tests, réussis.                                                                                               |
| Première compilation Android           | Release autonome réussie, signature `CN=Android Debug` vérifiée, installation et lancement sur émulateur API 36 réussis.                        |
| Build Android final                    | Compilation Release réussie ; le statut de l’asset distribué et son checksum sont consignés par la release GitHub.                              |
| iOS Release ARM64                      | Compilation réussie et lancement autonome sur simulateur iOS 27, sans Metro.                                                                    |
| Signature simulateur iOS               | Ad hoc locale standard, aucun compte/équipe/profil Apple ; erreur Keychain du build non signé disparue au lancement.                            |

Les versions utilisées sont Node 26.12.1, pnpm 11.13.0, Expo 58.0.14, React Native 0.88.0, Gradle 9.4.1, JDK 17 pour Android et Xcode 27.1. L’APK cible API 36, exige API 24 et embarque ARM64/x86_64. Ghostty iOS embarqué prend en charge le simulateur ARM64, pas Intel.

## Hôte réel isolé

Le [reçu sans secrets](validation/real-host.json) consigne un passage contre un vrai hôte Mines CLI 0.1.15, lié seulement à loopback avec un état jetable et aucun fournisseur actif. Son archive correspond au SHA-256 publié par GitHub pour v0.1.15. Les contrôles ont vérifié :

1. Échange d’une autorisation temporaire et vraie session.
2. Projection du projet et création d’une conversation inactive.
3. Deltas de titre dans les abonnements shell et conversation.
4. Rejeu d’un même `CommandId` donnant sa séquence d’origine.
5. Déconnexion puis récupération d’un changement manqué depuis `afterSequence`, jusqu’au marqueur de synchronisation.

Aucun message utilisateur/assistant ni résultat d’agent n’a été injecté. Ces contrôles utilisent directement le protocole du CLI : ils ne prouvent pas une session native peer approuvée, une réponse de modèle réel, une approbation d’outil ou la consommation de pièces jointes par un fournisseur.

## Prérequis découvert lors de l’essai natif

Le formulaire Android a été rendu accessible en remplaçant sa feuille compacte par un écran normal. Le test avec un lien à jeton a ensuite enregistré un credential, mais l’hôte est resté **Offline** : `makeBearerBroker` refuse tout profil bearer sans `peerDeviceId`, y compris loopback. L’enregistrement du credential n’était donc pas une connexion réussie. La promesse d’un contrôle distant sans compte a été retirée et cette voie est refusée avant échange ; le resolver et la politique peer restent inchangés.

Le seul parcours proposé exige un compte Mines, un hôte au même compte, l’approbation humaine de l’appareil et un réseau compatible WebRTC. Aucun compte utilisateur ni appareil approuvé n’a été fourni pour cet essai. La connexion native approuvée, le streaming d’un fournisseur et le contrôle de ses outils restent **non validés**. Les 12 tests de garde ciblés ont réussi, ainsi que le format, le lint et le typecheck après cette correction ; ils ne remplacent pas ce parcours.

## Essais visuels

La première capture iOS a révélé un mauvais placement du contenu par rapport aux en-têtes natifs. Les contrôles de mode et l’en-tête sont désormais dans le défilement enregistré, avec un état vide utile. La [capture iOS corrigée](screenshots/ios-library.png) vient du vrai client Release sur simulateur, sans données de démonstration.

Le dernier APK a été reconditionné en 53 secondes sans recompilation native complète, sa signature de test vérifiée, puis installé et lancé sur émulateur API 36. Les captures du [parcours peer](screenshots/android-pairing.png) et du [formulaire de compte](screenshots/android-signin.png) proviennent de cet APK, sans identifiants ni données de démonstration. La capture du test à jeton montrait un état Offline ; elle n’est pas une preuve de connexion réussie. La [release privée v0.1.0-preview.1](https://github.com/mines-harness/android/releases/tag/v0.1.0-preview.1) est publiée. Son APK a été retéléchargé intégralement ; taille, SHA-256 et signature de test vérifiés. Le [reçu de livraison](validation/android-release.json) consigne l’asset exact. Le dernier bundle iOS ARM64 a aussi été compilé, installé et lancé après la correction d’appairage ; le simulateur temporaire a ensuite été supprimé.

## Limites

Aucun appareil physique, compte utilisateur authentifié, fournisseur IA réel, réception push APNs/FCM ou Workgroup entre plusieurs hôtes n’a été validé. Les capacités correspondantes restent conditionnées aux descripteurs et aux droits de l’hôte. Les tests isolés ne remplacent pas ces essais.

Aucune signature de production, clé d’API, nouvelle permission d’infrastructure, inscription EAS, publication store ou dépense externe n’a été créée. Les sessions du serveur de test sont temporaires ; aucune approbation d’appareil utilisateur n’est automatisée.
