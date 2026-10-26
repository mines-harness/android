# Mines Mobile

Client natif iOS et Android pour piloter des agents exécutés sur vos hôtes Mines. Cette première version est une **préversion à valider**, issue du client React Native et des contrats utilisés par Mines desktop. Elle contient les parcours réels de connexion et de contrôle ; aucune donnée de démonstration n’est injectée dans l’application normale.

**État de livraison : compilation native, essais sur hôte et publication APK en attente de validation.** La présence d’un écran ou d’un test unitaire ne certifie pas son fonctionnement sur appareil. Voir la [matrice de parité](docs/PARITY.md) et les [contraintes d’architecture](docs/ARCHITECTURE.md).

Les dépôts privés [Android](https://github.com/mines-harness/android) et [iOS](https://github.com/mines-harness/ios) conservent le même client partagé. Le code dépend d’un hôte desktop ou CLI existant ; ce dépôt ne déploie pas de backend.

## Installer l’APK de test

Publication prévue : [v0.1.0-preview.1](https://github.com/mines-harness/android/releases/tag/v0.1.0-preview.1). **Ce lien est une cible de publication, pas la preuve qu’un APK soit disponible.** La livraison ne sera confirmée qu’après vérification de l’asset et de son checksum.

L’APK prévu est **Mines Preview**, identifiant `app.mines.mobile.preview`, signé pour les essais. Il ne s’agit pas d’une signature de production. Il doit embarquer son JavaScript et fonctionner sans Metro ni Expo Go. Aucun envoi vers Play Store ou App Store n’est prévu.

Après publication :

1. Télécharger l’APK et le fichier de sommes SHA-256 depuis la même release privée, avec un compte GitHub autorisé.
2. Vérifier le checksum : `shasum -a 256 -c SHA256SUMS` depuis le dossier contenant les fichiers.
3. Autoriser ponctuellement l’installation depuis la source de téléchargement dans Android, puis ouvrir l’APK. Avec un appareil de test déjà configuré pour ADB, `adb install -r chemin/vers/mines-preview.apk` convient également.
4. Ouvrir **Settings → Environments → +** pour appairer un hôte joignable.

La configuration native demande Android 7 / API 24 minimum ; la compatibilité effective des modules et appareils reste à confirmer par les essais. La validation iOS passe par une compilation de simulateur. Une distribution sur iPhone physique exige une signature Apple appropriée, qui n’est pas fournie ici.

## Connecter un hôte

### Hôte direct, sans compte Mines

Sur l’ordinateur, laisser fonctionner Mines desktop ou un hôte issu du [CLI Mines](https://github.com/mines-harness/cli). Le téléphone doit pouvoir joindre son adresse via un réseau local de confiance, un VPN ou un réseau privé déjà configuré. `localhost` sur le téléphone ne désigne pas l’ordinateur.

Créer un lien d’appairage à usage unique depuis l’hôte. Le CLI propose `mines auth pairing create` ; utiliser une version correspondant à l’hôte et consulter `mines auth pairing create --help` si plusieurs états ou adresses sont disponibles. Le client ne configure ni routeur, ouverture de port, service VPN, ni VPS.

Dans **Settings → Environments → +**, scanner le QR ou coller le lien complet dans **Pair a reachable host**, vérifier l’origine affichée puis choisir **Pair host**. Le lien est sensible : ne pas le publier, le journaliser ou le réutiliser après consommation. Avec HTTP, utiliser uniquement un réseau de confiance ou un transport privé chiffré déjà établi.

Les hôtes ainsi appairés alimentent la bibliothèque locale lorsque le compte Mines est déconnecté. Sections et épinglés locaux ne sont pas transférés dans un compte. Le contexte hérité d’une section locale n’est pas répliqué sur l’hôte ; les messages utilisent le contexte déjà présent sur l’hôte et peuvent inclure leurs propres pièces jointes/contexte explicite.

### Compte Mines et appareils approuvés

La configuration publique fournie utilise `https://mines.gemstud.io`, origine déjà utilisée par le CLI. Un `GET /v1/auth-config` a répondu HTTP 200 pendant la préparation ; ce contrôle ne valide ni une connexion utilisateur ni une session d’agent.

Se connecter au même compte sur le téléphone et sur l’hôte, puis suivre le parcours **Mines peer** de l’écran d’appairage. L’approbation d’un appareil reste une action humaine. Un QR visant une autre origine que le service de compte configuré est refusé avant lecture ou envoi du token compte. La connexion WebRTC directe dépend du réseau ; aucun relais de secours n’est inventé.

La bibliothèque du compte et la bibliothèque locale restent séparées. Pour utiliser un hôte appairé uniquement par lien direct dans la bibliothèque locale, se déconnecter du compte ; pour une bibliothèque synchronisée, utiliser le parcours peer approuvé.

Sous **Settings → Environments → hôte → Device access**, les sessions autorisées peuvent consulter les appareils et, si elles disposent du droit de gestion, vérifier les demandes, les autoriser, les refuser ou révoquer un accès. Les changements exigent une confirmation explicite. Certains hôtes CLI anciens ne publient pas les RPC de demandes : l’application l’indique et invite à gérer l’accès sur l’hôte.

## Construire et vérifier

Prérequis : **Node.js 26.12.1**, **pnpm 11.13.0** et les outils natifs officiels. Android demande un JDK compatible avec le projet Gradle et un SDK/NDK Android ; iOS demande macOS, Xcode initialisé, CocoaPods et un runtime de simulateur. Les éventuelles nouvelles licences de ces outils doivent être acceptées par leur propriétaire, sans acceptation automatique par le projet.

Depuis la racine :

```bash
pnpm install --frozen-lockfile
pnpm typecheck:mobile
pnpm lint:source
pnpm test:mobile
pnpm test:runtime:mobile
pnpm check:changed
```

`pnpm lint:mobile` vérifie le code natif avec les outils disponibles. Un outil absent peut être signalé comme ignoré : cela ne constitue pas une validation native réussie. Les tests utilisent un lanceur commun pour conserver la même instance de Vite+/Vitest que `@effect/vitest` dans ce workspace.

Builds locaux :

```bash
pnpm build:android:preview
pnpm build:ios:simulator
```

Le script Android prépare la variante preview et son APK de test ; le script iOS cible le simulateur sans créer de signature de production. Lire le résultat du script pour le chemin de l’artefact et ses diagnostics. Une compilation réussie ne remplace pas les essais de démarrage, navigation, connexion et reprise sur hôte.

La configuration publique se trouve à la racine dans `.env` ou `.env.local`. Pour un service d’identité déjà exploité par vos soins, définir `MINES_CONTROL_URL` sur son origine HTTPS avant de reconstruire. `MINES_MOBILE_UPDATES_ENABLED=0` conserve les OTA désactivées. Aucun compte EAS, projet Expo distant, clé APNs/FCM ou service facturable n’est nécessaire pour compiler l’APK local prévu. Ne pas placer de secrets dans la configuration publique du bundle.

## Limites de cette préversion

- Modèles, questions, approbations, interruptions et pièces jointes dépendent des capacités réellement annoncées par chaque hôte et fournisseur.
- Les agents s’exécutent sur l’hôte. iOS/Android peuvent suspendre le client et ses connexions ; aucune exécution locale continue en arrière-plan n’est promise.
- Voix, aperçus navigateur/appareils, widgets et notifications ont des sources dédiées mais ne sont pas certifiés par leur seule présence. Les push nécessitent une configuration et une signature appropriées, non créées par cette livraison.
- Les essais sur téléphones physiques, chaque fournisseur et avec un compte réel restent distincts des tests isolés. Leur statut doit être lu dans le bilan de validation de la release.
- Le client ne provisionne pas SSH et ne met pas à jour un VPS pour se rendre compatible.

## Provenance et licences

Base inspectée : `mines-harness/macos` à `3de42d577a1e744b465c4893254a1ca5dbe0fb67`, issue de T3 Code. Le CLI privé à `82b09e98f5cf585cb45e0a2489159d78c39155da` et le dépôt public de distribution ont aussi été comparés pour vérifier les capacités des hôtes au-delà des seules commandes CLI.

La licence MIT d’origine et son attribution T3 Tools sont conservées dans [LICENSE](LICENSE). Les forks React Native, modules natifs et bibliothèques embarquées conservent leurs notices : [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Les noms `@t3tools/*` restent des identifiants de compatibilité ; ils ne signifient pas que T3 Tools distribue ou valide cette préversion.
