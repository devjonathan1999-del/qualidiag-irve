# Schneider Charge — Installation disjoncte

Date : 2026-09-16

## Objectif

Reprendre le parcours **Schneider Charge — Installation disjoncte** en s’appuyant sur la logique métier déjà validée pour Vestel, tout en conservant un **parcours Schneider totalement indépendant**.

Aucun nœud Vestel ne doit être réutilisé directement. La logique est copiée/adaptée dans des nœuds Schneider dédiés afin de permettre des évolutions ultérieures propres à Schneider.

## Périmètre

Le motif concerné est le choix **« Mon installation disjoncte »** depuis le menu Schneider Charge.

Le parcours Schneider Charge Pro pourra continuer à pointer vers ce parcours Schneider Charge tant que cette mutualisation entre les deux modèles Schneider reste souhaitée. Cette spec ne modifie pas les autres symptômes Schneider.

## Parcours cible

### 1. Identifier l’appareil qui coupe

Question : **« Quel appareil coupe ? »**

Choix :
- **Compteur Linky** → transmission au **Service Technique**.
- **Disjoncteur de branchement** → contrôle du calibre du disjoncteur de branchement.
- **Disjoncteur de la borne** → réarmement unique du disjoncteur de la borne.

### 2. Disjoncteur de branchement

Le contrôle doit utiliser la phase et la puissance d’abonnement déjà présentes dans le contexte QualiDiag.

Valeurs affichées :
- Monophasée 6 kVA → 30 A
- Monophasée 9 kVA → 45 A
- Monophasée 12 kVA → 60 A
- Triphasée 12 kVA → 20 A
- Triphasée 15 kVA → 25 A
- Triphasée 18 kVA → 30 A
- Triphasée 24 kVA → 40 A
- Triphasée 30 kVA → 50 A
- Triphasée 36 kVA → 60 A

Résultats :
- **Calibre correct** → transmission au **Service Technique**.
- **Calibre incorrect** → orientation vers le **fournisseur d’énergie**.

La règle existante de QualiDiag demandant une **photo lisible du disjoncteur de branchement** doit rester applicable à ce contrôle.

### 3. Disjoncteur de la borne

Action : demander au client de **réarmer une seule fois** le disjoncteur de la borne.

Résultats :
- **Le disjoncteur retombe immédiatement / impossible à réarmer** → transmission au **Service Technique**.
- **Le disjoncteur tient** → demander un nouvel essai de charge.

Après nouvel essai :
- **La charge fonctionne normalement** → **résolu**.
- **Le disjoncteur retombe pendant la charge** → transmission au **Service Technique**.

## Architecture de données

Le parcours doit être défini dans la policy Schneider existante ou dans une policy Schneider dédiée si cela améliore la lisibilité, mais les identifiants de nœuds doivent être **propres à Schneider**.

Le fichier Forms brut `data/diagnostics/schneider-charge.json` ne doit pas être modifié.

## Compatibilité Schneider Charge Pro

Le menu Schneider Charge Pro pointe actuellement vers le parcours Schneider Charge pour :
- installation disjoncte ;
- LED rouge fixe ;
- charge faible.

Cette spec conserve ce principe pour **installation disjoncte** : Charge Pro peut réutiliser le parcours Schneider commun, puisqu’il reste dans la famille Schneider et non dans Vestel.

## Tests attendus

Les tests doivent vérifier au minimum :
- les trois choix Linky / disjoncteur de branchement / disjoncteur de la borne ;
- Linky → Service Technique ;
- contrôle de calibre selon phase + abonnement ;
- calibre incorrect → fournisseur d’énergie ;
- disjoncteur de la borne → réarmement unique ;
- retombe immédiatement → Service Technique ;
- tient → essai de charge ;
- essai OK → résolu ;
- retombe pendant charge → Service Technique ;
- Schneider Charge Pro continue de rejoindre ce parcours ;
- la demande de photo du disjoncteur de branchement reste active ;
- aucun nœud Vestel n’est référencé par ce parcours Schneider.

## Hors périmètre

Ne pas modifier dans ce lot :
- LED rouge fixe ;
- LED bleue clignotante ;
- LED orange clignotante ;
- charge faible ;
- Wiser ;
- Smartcharge ;
- données Forms brutes.
