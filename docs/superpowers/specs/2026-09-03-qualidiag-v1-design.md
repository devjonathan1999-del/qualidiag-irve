# QualiDiag IRVE — Design V1

Date: 2026-09-03

## 1. Objectif

Transformer le Forms actuel de qualification SAV IRVE en une application web simple, utilisable par les chargés d'affaires depuis un navigateur d'entreprise, sans installation, sans compte utilisateur et sans accès direct aux outils internes du SI.

La V1 doit permettre de :
- guider le chargé d'affaires dans une qualification structurée ;
- mutualiser les diagnostics communs entre fabricants ;
- conserver des branches spécifiques par marque/modèle ;
- collecter uniquement les éléments nécessaires au diagnostic ;
- produire un résumé prêt à copier dans Salesforce ;
- fonctionner comme une application web statique publiable sur GitHub Pages.

## 2. Contraintes retenues

- Aucun logiciel à installer sur les postes des chargés d'affaires.
- Accès par simple URL dans Edge/Chrome.
- Pas d'authentification en V1.
- Pas d'intégration Salesforce, SharePoint ou M365 en V1.
- Pas de stockage serveur de données client.
- Pas de dépendance à Google Drive pendant l'utilisation.
- Le contenu métier doit être séparé du moteur pour permettre des mises à jour sans réécrire l'interface.
- Le dépôt GitHub public sert de source de déploiement GitHub Pages.

## 3. Positionnement

QualiDiag et TechDiag restent séparés en V1.

- QualiDiag : qualification simplifiée pour chargés d'affaires.
- TechDiag : diagnostic technique poussé pour équipe technique / professionnels.

Leur moteur pourra être mutualisé ultérieurement, mais ce n'est pas une exigence V1.

## 4. Architecture cible

Application statique sans backend :

```text
index.html
assets/
app/
  engine.js
  navigation.js
  summary.js
  storage.js
  ui.js
data/
  brands.json
  models.json
  diagnostics.json
  procedures.json
  conclusions.json
  resources.json
styles/
  app.css
```

### 4.1 Moteur

Le moteur lit les nœuds de diagnostic dans les fichiers de données et détermine :
- la question à afficher ;
- les réponses disponibles ;
- l'action associée ;
- le nœud suivant ;
- la conclusion éventuelle ;
- les éléments à collecter.

Aucune règle métier importante ne doit être codée en dur dans l'interface.

### 4.2 Données métier

Chaque nœud doit être identifiable par un ID stable.

Exemple conceptuel :

```json
{
  "id": "COMMON-CHARGE-LOW-01",
  "type": "question",
  "label": "Le câble utilisé est-il bien un modèle 32 A ?",
  "answers": [
    { "label": "Oui", "next": "COMMON-CHARGE-LOW-02" },
    { "label": "Non", "next": "CONCLUSION-CABLE-LIMITATION" }
  ]
}
```

Les données seront progressivement extraites des 53 pages du Forms actuel.

## 5. Parcours utilisateur V1

### 5.1 Accueil

Deux entrées :
- Démarrer une qualification
- Rechercher une information

La recherche d'information peut rester minimale au premier incrément ; le parcours de qualification est prioritaire.

### 5.2 Tronc commun

Ordre cible :
1. Type d'utilisation : réclamation / recherche d'information
2. Installation : mono / tri
3. Puissance d'abonnement
4. Autocontrôle exploitable ?
5. Autocontrôle conforme ?
6. Véhicule (optionnel)
7. Marque de la borne
8. Modèle
9. Symptôme
10. Diagnostic guidé
11. Conclusion
12. Résumé Salesforce

Le nom/prénom client n'est pas nécessaire au moteur et ne doit pas être conservé en V1.

## 6. Diagnostics mutualisés

Les branches suivantes doivent être modélisées comme procédures communes lorsqu'elles sont réellement identiques :

- COMMON-INSTALLATION-TRIP : installation disjoncte
- COMMON-CHARGE-LOW : charge faible
- COMMON-WIFI-CHECK : contrôle Wi-Fi
- COMMON-SUBSCRIPTION-CHECK : cohérence abonnement / calibre

Une branche fabricant peut entrer dans un diagnostic commun puis revenir vers une étape spécifique.

## 7. Branches fabricants V1

Fabricants issus du Forms :
- Vestel IZI by EDF
  - Basic
  - Smartcharge
- Wallbox
  - Copper SB
  - Pulsar Socket Plus
- Free2Move
- Hager
- Schneider Charge
- Schneider Charge Pro

Les contenus métier sont repris depuis le Forms existant sans ajouter silencieusement des règles TechDiag non présentes dans cette source.

## 8. Sorties / conclusions

Statuts de sortie prévus :
- Résolu par le chargé d'affaires
- En attente d'éléments client
- Réintervention professionnel
- Orientation fournisseur d'énergie
- Orientation fabricant
- Transmission Service Technique

Une conclusion peut aussi imposer une collecte :
- photo ;
- capture écran ;
- liste d'alarmes ;
- test Wi-Fi ;
- autre élément explicitement défini dans le parcours.

## 9. Résumé Salesforce

La V1 ne se connecte pas à Salesforce.

Elle génère un bloc texte copiable avec :
- installation ;
- abonnement ;
- marque / modèle ;
- symptôme ;
- vérifications réalisées ;
- résultats ;
- conclusion ;
- éléments demandés ou manquants ;
- complément libre facultatif.

Bouton principal de fin : `Copier pour Salesforce`.

## 10. Données locales

La V1 peut conserver temporairement le parcours en cours dans le navigateur afin d'éviter une perte lors d'un rafraîchissement accidentel.

Principes :
- aucune donnée client sensible n'est requise ;
- pas d'historique nominatif ;
- possibilité de recommencer une qualification ;
- effacement du brouillon à la fin ou sur demande.

## 11. Interface

Principes :
- interface claire, inspirée de TechDiag mais destinée à un public moins technique ;
- une question principale par écran ;
- gros boutons de réponse ;
- progression visible ;
- bouton retour ;
- contexte courant visible : marque, modèle, symptôme ;
- messages d'action distincts des questions ;
- conclusion très lisible ;
- responsive desktop, avec priorité aux postes Windows d'entreprise.

Aucune dépendance UI lourde n'est requise en V1.

## 12. Gestion des erreurs

Si un nœud référencé est introuvable :
- arrêter proprement le parcours ;
- afficher un message `Parcours incomplet — transmettre au Service Technique` ;
- conserver les réponses déjà saisies ;
- permettre de copier le résumé partiel.

Si un fichier de données ne charge pas :
- afficher une erreur explicite de chargement de la base ;
- ne pas inventer de parcours de remplacement.

## 13. Tests attendus

Le moteur doit être testable indépendamment de l'UI.

Tests prioritaires :
- navigation question -> réponse -> nœud suivant ;
- branchement vers un diagnostic commun ;
- retour vers une branche fabricant ;
- détection d'un nœud manquant ;
- conclusion terminale ;
- génération du résumé Salesforce ;
- restauration d'un brouillon local.

Au minimum, un parcours complet de chaque fabricant devra être vérifié avant une diffusion pilote.

## 14. Déploiement

Cible V1 : GitHub Pages sur le dépôt `devjonathan1999-del/qualidiag-irve`.

Le déploiement doit rester statique : aucun serveur applicatif requis.

URL cible probable :
`https://devjonathan1999-del.github.io/qualidiag-irve/`

Cette URL devra être confirmée par GitHub Pages après activation ; elle ne doit pas être considérée comme publiée avant vérification.

## 15. Hors périmètre V1

- authentification ;
- synchronisation cloud ;
- écriture directe dans Salesforce ;
- connecteur SharePoint / M365 ;
- historique centralisé des qualifications ;
- statistiques d'utilisation ;
- moteur commun TechDiag / QualiDiag ;
- administration web de la base ;
- stockage de données client sur serveur.

## 16. Incrément de démarrage

Premier incrément implémenté après validation de cette spécification :
1. squelette statique ;
2. moteur de nœuds générique ;
3. tronc commun ;
4. choix marque / modèle ;
5. un parcours de démonstration complet ;
6. conclusion ;
7. résumé Salesforce ;
8. tests du moteur.

Les autres branches du Forms seront intégrées ensuite progressivement dans la même structure de données.
