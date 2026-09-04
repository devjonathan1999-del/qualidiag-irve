# QualiDiag IRVE

Application web statique de qualification SAV IRVE pour les chargés d'affaires.

## Périmètre de la V1

La première passe reprend l'ensemble du Forms de qualification actuel, réparti par famille de bornes :

- Vestel IZI by EDF ;
- Wallbox ;
- Free2Move ;
- Hager ;
- Schneider Charge ;
- Schneider Charge Pro.

Le tronc commun conserve les informations nécessaires à la qualification sans demander de donnée nominative.

## Statut métier des données

Cette conversion est une **transcription provisoire du Forms actuel** destinée à être relue branche par branche.

Les nœuds issus du Forms portent :

```json
"source": "Forms actuel",
"validation": "a_valider"
```

Cela ne signifie pas que chaque règle technique est validée pour devenir une règle canonique QualiDiag. Les corrections seront intégrées progressivement pendant la revue métier.

Deux réponses du document Word n'ont pas de destination visible dans l'export. Elles sont dirigées provisoirement vers le résumé final et portent un champ `sourceInference` explicite :

- Wallbox : erreur lors de l'accès à l'onglet « gestion de la charge » ;
- Free2Move : erreur 308 toujours présente après la manipulation proposée.

Aucune règle TechDiag n'est injectée silencieusement dans cette passe.

## Organisation des diagnostics

Les parcours sont séparés pour faciliter les contrôles métier :

```text
data/diagnostics/
├── common.json
├── vestel.json
├── wallbox.json
├── free2move.json
├── hager.json
├── schneider-charge.json
└── schneider-charge-pro.json
```

`app/data.js` assemble ces fichiers au chargement. Le moteur de navigation reste générique.

## Lancer localement

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080/`.

## Tests

Avant toute publication :

```bash
npm test
```

Les tests vérifient notamment la cohérence des destinations du graphe, la présence des six familles, les symptômes principaux du Forms et l'existence d'une sortie terminale pour chaque parcours.

## Déploiement GitHub Pages

GitHub Pages publie la branche `main` depuis la racine du dépôt.

URL :

`https://devjonathan1999-del.github.io/qualidiag-irve/`

Une branche de travail ou une PR ne modifie pas le site public tant qu'elle n'est pas fusionnée dans `main`.

## Contraintes V1

- aucun backend ;
- aucune authentification ;
- aucune écriture directe dans Salesforce ;
- aucune connexion M365 / SharePoint au runtime ;
- aucune donnée nominative requise ;
- brouillon stocké uniquement dans le navigateur ;
- QualiDiag et TechDiag restent deux projets distincts.
