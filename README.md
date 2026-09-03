# QualiDiag IRVE

Prototype web statique de qualification SAV IRVE pour les chargés d'affaires.

## Périmètre du pilote

Le premier parcours complet disponible est :

`Schneider Charge → Charge faible`

Les autres marques du Forms sont présentes dans la base de catalogue mais ne sont pas présentées comme diagnostics disponibles dans ce pilote.

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

## Déploiement GitHub Pages

Dans GitHub :

`Settings → Pages → Deploy from a branch → main / (root) → Save`

Après activation et publication sur `main`, l'URL attendue est :

`https://devjonathan1999-del.github.io/qualidiag-irve/`

Ne pas considérer cette URL comme publiée tant que GitHub Pages n'a pas confirmé le déploiement.

## Contraintes V1

- aucun backend ;
- aucune authentification ;
- aucune écriture directe dans Salesforce ;
- aucune connexion M365 / SharePoint ;
- aucune donnée nominative requise ;
- brouillon stocké uniquement dans le navigateur.
