# Tibaldo OS pour iPhone

Application iOS native privée qui ouvre `https://app.tibaldo.fr` dans une vue WebKit dédiée, sans interface Safari.

## Première installation

1. Ouvrir `TibaldoOSNative/TibaldoOS.xcodeproj` dans Xcode.
2. Ajouter le compte Apple dans Xcode > Settings > Apple Accounts.
3. Sélectionner la cible `TibaldoOS`, puis Signing & Capabilities.
4. Choisir la Personal Team et conserver Automatically manage signing.
5. Connecter et déverrouiller l’iPhone, le sélectionner dans la barre Xcode, puis lancer avec `⌘R`.

L’iPhone Tibaldo utilise iOS 27. Il faut donc ouvrir le projet avec Xcode 27 bêta tant que la version stable compatible n’est pas installée.

## Renouvellement gratuit

Avant l’expiration des sept jours :

1. Connecter et déverrouiller l’iPhone.
2. Double-cliquer sur `Ouvrir Tibaldo OS dans Xcode.command`.
3. Vérifier que `Iphone Tibaldo` est sélectionné dans la barre Xcode.
4. Cliquer sur ▶︎ ou utiliser `⌘R`.

La Personal Team est déjà configurée dans le projet. Ce nouveau lancement renouvelle gratuitement l’application pour sept jours.
