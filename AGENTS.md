# Canonical Mines source and releases

Active shared development and all new desktop/CLI releases use https://github.com/mines-harness/macos. This repository retains an earlier platform or distribution snapshot. Before implementing "latest", compare canonical main, this checkout, the installed app commit, and the canonical source parity report. Preserve platform-specific behavior when integrating changes; do not overwrite histories or run a second release train from this snapshot. Follow https://github.com/mines-harness/macos/blob/main/docs/operations/mines-release.md for verified builds and identity-preserving installation.

# Travailler sur Mines Mobile

Ce dépôt privé contient les clients mobiles iOS/Android et leurs packages partagés. Les agents s’exécutent sur les hôtes desktop/CLI ; le téléphone les contrôle par le protocole existant. Présence d’un écran, réussite de tests isolés et validation sur appareil sont trois preuves distinctes.

## Périmètre et données

- Travailler dans un checkout isolé. Ne pas modifier copies utilisateur, branches desktop ou mémoires Codex locales.
- Ne jamais démarrer un serveur sur les données utilisateur. Utiliser un état de test isolé, sans copier de secrets pour remplir une démonstration.
- Aucun changement VPS, déploiement backend, store, frais, clé de production ou permission persistante sans autorisation spécifique. Les instructions utilisateur déjà reçues font autorité ; ne pas demander à nouveau une autorisation acquise.
- Ne pas lire/afficher tokens, liens d’appairage ou clés privées sans nécessité. Aucun secret dans logs, captures publiées ou commits.
- Arrêter uniquement les processus dont le PID a été enregistré au lancement. Ne jamais tuer par motif ou nom de projet.

## Protocole et interface

- Conserver les contrats et capacités annoncées par l’hôte. Une fonction absente/ancienne est indisponible, jamais un succès de remplacement.
- Les mutations passent par `createEnvironmentRpcCommand` et ses permissions ; le serveur reste autoritaire. Garder les RPC bruts dans `rpc/`.
- Aucune approbation d’appareil/outil automatique. Vérifier demande valide, bon hôte et droits courants ; les changements persistants exigent l’action humaine correspondante.
- Ne pas fusionner hôtes manuels et catalogues de comptes. Le contexte de section local n’est pas une réplique de contexte sur l’hôte.
- Respecter les modèles/options/contrôles propres aux fournisseurs. Ni README ni numéro de version ne prouvent la compatibilité.
- Conserver listes virtualisées, snapshots bornés, curseurs, identifiants durables et transports partagés. Aucun polling agressif, réveil périodique inutile ou reconnexion en boucle.
- Respecter la suspension iOS/Android ; pas de service permanent ou d’exemption batterie pour promettre un agent mobile continu.
- Mocks/showcase réservés aux tests explicites ; ils ne doivent jamais masquer un parcours normal défaillant.

## Vérifier

Versions de référence : Node.js 26.12.1 et pnpm 11.13.0. Installer avec `pnpm install --frozen-lockfile`. Conserver patches, archives natives et notices ensemble.

- Pendant l’itération : tests ciblés avec `node scripts/run-mobile-tests.mjs apps/mobile <fichiers> --project unit`, pour conserver une seule instance de Vitest.
- Avant livraison : `pnpm typecheck:mobile`, `pnpm lint:source`, `pnpm check:changed`. `pnpm test:mobile` vérifie le client ; `pnpm test:runtime:mobile` couvre les changements partagés spécifiques au mobile.
- Éviter les suites globales sans rapport avec le changement. Tester les comportements observables, sans répéter simplement les lignes d’implémentation.
- Ne pas désactiver React Compiler ou ajouter bailout/skip pour rendre un check vert ; corriger la cause.
- Les tests Effect attendent un événement, `Deferred`, `Queue`, drain ou avancent explicitement le `TestClock`. Pas de boucle sleep/yield pour attendre une condition.
- `pnpm build:android:preview` et `pnpm build:ios:simulator` sont des builds locaux. Signature de test acceptable si identifiée ; aucune signature de production ou invocation EAS/store par défaut.
- Un outil natif absent/ignoré n’est pas une validation réussie. Décrire séparément simulateur, appareil physique et hôte authentifié.

La validation native intégrée appartient au coordinateur : les sous-agents ne lancent pas chacun leur serveur, émulateur ou Metro. Consulter les skills pertinents de `.agents/skills` et respecter l’autorisation utilisateur déjà établie. Une preuve unitaire ne remplace pas une capture ou un parcours live manquant.

## Livrer

Conserver [LICENSE](LICENSE) et les notices tierces. Tenir à jour [README.md](README.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md) et [PARITY.md](docs/PARITY.md).

Les commits doivent être propres et les livrables vérifiables. Une release APK n’est livrée qu’après vérification de son asset téléchargé et de sa somme SHA-256. Ne pas créer de PR sans demande utilisateur. Rapporter les blocages avec action, cible, raison, travail terminé et statut : refusé, en attente ou résultat incertain.
