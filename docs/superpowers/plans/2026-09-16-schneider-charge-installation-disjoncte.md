# Schneider Charge — Installation disjoncte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le parcours Schneider Charge « Installation disjoncte » sur la logique métier Vestel validée, avec des nœuds Schneider indépendants.

**Architecture:** Conserver `F-084` et `F-085` comme entrée et contrôle de calibre propres à Schneider, enrichir `F-084` avec le troisième choix « Disjoncteur de la borne », puis ajouter deux nœuds Schneider dédiés au réarmement unique et à l’essai de charge. Schneider Charge Pro continue de rejoindre `F-084`, sans aucune référence vers un nœud Vestel.

**Tech Stack:** JSON policies, JavaScript ES modules, Node.js `node:test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-schneider-charge-installation-disjoncte-design.md`

## Global Constraints

- Ne pas modifier `data/diagnostics/schneider-charge.json`.
- Ne référencer aucun identifiant `VESTEL-*` depuis le parcours Schneider.
- Conserver la règle existante de photo lisible du disjoncteur de branchement.
- Conserver Schneider Charge Pro sur le parcours Schneider commun pour « installation disjoncte ».
- Ne modifier aucun autre symptôme Schneider dans ce lot.

---

### Task 1: Verrouiller le parcours cible par des tests RED

**Files:**
- Modify: `tests/schneider-trip-simple.test.js`
- Read-only regression coverage: `tests/schneider-charge-pro.test.js`
- Read-only regression coverage: `tests/vestel-basic-agcp-photo-alert.test.js`

**Interfaces:**
- Consumes: `applySchneiderChargePolicy(nodes, policy)` depuis `app/data.js`.
- Produces: attentes de tests pour `F-084`, `F-085`, `SC-TRIP-CHARGER-REARM` et `SC-TRIP-CHARGER-TEST`.

- [ ] **Step 1: Remplacer le test du choix simple par le parcours à trois appareils**

```js
test('Schneider Installation disjoncte distingue Linky, disjoncteur de branchement et disjoncteur de la borne', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const device = effective.find(node => node.id === 'F-084');

  assert.equal(device.title, 'Quel appareil coupe ?');
  assert.deepEqual(device.answers.map(answer => answer.label), [
    'Compteur Linky',
    'Disjoncteur de branchement',
    'Disjoncteur de la borne'
  ]);
  assert.equal(device.answers.find(answer => answer.id === 'linky').next, 'END-TRANSFER');
  assert.equal(device.answers.find(answer => answer.id === 'main-breaker').next, 'F-085');
  assert.equal(device.answers.find(answer => answer.id === 'charger-breaker').next, 'SC-TRIP-CHARGER-REARM');
  assert.equal(device.validation, 'valide');
});
```

- [ ] **Step 2: Ajouter les tests du disjoncteur de la borne et de l’isolation Vestel**

```js
test('le disjoncteur de la borne est réarmé une seule fois avant un essai de charge', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const rearm = effective.find(node => node.id === 'SC-TRIP-CHARGER-REARM');
  const retry = effective.find(node => node.id === 'SC-TRIP-CHARGER-TEST');

  assert.match(rearm.body, /réarmer une seule fois/i);
  assert.equal(rearm.answers.find(answer => answer.id === 'holds').next, 'SC-TRIP-CHARGER-TEST');
  assert.equal(rearm.answers.find(answer => answer.id === 'drops-immediately').next, 'END-TRANSFER');
  assert.equal(retry.answers.find(answer => answer.id === 'charge-ok').next, 'END-RESOLVED');
  assert.equal(retry.answers.find(answer => answer.id === 'drops-during-charge').next, 'END-TRANSFER');
});

test('le parcours Schneider Installation disjoncte ne référence aucun nœud Vestel', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const ids = ['F-084', 'F-085', 'SC-TRIP-CHARGER-REARM', 'SC-TRIP-CHARGER-TEST'];
  const route = effective.filter(node => ids.includes(node.id));

  assert.doesNotMatch(JSON.stringify(route), /VESTEL-/);
});
```

- [ ] **Step 3: Conserver et adapter le test de calibre existant**

Le test existant doit continuer à vérifier :

```js
assert.equal(calibration.answers.find(answer => answer.id === 'oui').next, 'END-TRANSFER');
assert.equal(calibration.answers.find(answer => answer.id === 'non').next, 'END-ENERGY-SUPPLIER');
```

et les valeurs contextuelles 6 kVA mono → 30 A, 12 kVA mono → 60 A, 12 kVA tri → 20 A et 30 kVA tri → 50 A.

- [ ] **Step 4: Lancer le test ciblé et vérifier le RED**

Run: `node --test tests/schneider-trip-simple.test.js`

Expected: FAIL parce que `F-084` ne propose actuellement que deux choix et que `SC-TRIP-CHARGER-REARM` / `SC-TRIP-CHARGER-TEST` n’existent pas encore.

- [ ] **Step 5: Commit des tests RED**

```bash
git add tests/schneider-trip-simple.test.js
git commit -m "test: align Schneider trip route with validated flow"
```

---

### Task 2: Implémenter le parcours Schneider indépendant

**Files:**
- Modify: `data/schneider-charge-policy.json`
- Test: `tests/schneider-trip-simple.test.js`

**Interfaces:**
- Consumes: contexte `installation.phase` et `installation.power` déjà utilisé par `F-085`.
- Produces: `F-084.answers` à trois choix, plus les nœuds `SC-TRIP-CHARGER-REARM` et `SC-TRIP-CHARGER-TEST`.

- [ ] **Step 1: Modifier `F-084` pour les trois appareils**

```json
"F-084": {
  "title": "Quel appareil coupe ?",
  "body": "Sélectionnez l’appareil qui coupe pendant ou au lancement de la charge.",
  "source": "Forms actuel + validation métier",
  "validation": "valide",
  "answers": [
    {
      "id": "linky",
      "label": "Compteur Linky",
      "next": "END-TRANSFER",
      "check": "Schneider Charge installation disjoncte — compteur Linky coupe, transmission Service Technique"
    },
    {
      "id": "main-breaker",
      "label": "Disjoncteur de branchement",
      "next": "F-085",
      "check": "Schneider Charge installation disjoncte — disjoncteur de branchement"
    },
    {
      "id": "charger-breaker",
      "label": "Disjoncteur de la borne",
      "next": "SC-TRIP-CHARGER-REARM",
      "check": "Schneider Charge installation disjoncte — disjoncteur de la borne"
    }
  ]
}
```

- [ ] **Step 2: Ajouter le réarmement unique du disjoncteur de la borne**

Ajouter dans `addNodes` :

```json
{
  "id": "SC-TRIP-CHARGER-REARM",
  "type": "action",
  "title": "Réarmer le disjoncteur de la borne",
  "body": "Demandez au client de réarmer une seule fois le disjoncteur de la borne.",
  "source": "Validation métier",
  "validation": "valide",
  "answers": [
    {
      "id": "holds",
      "label": "Le disjoncteur tient",
      "next": "SC-TRIP-CHARGER-TEST",
      "check": "Schneider Charge installation disjoncte — disjoncteur de la borne réarmé et maintenu"
    },
    {
      "id": "drops-immediately",
      "label": "Le disjoncteur retombe immédiatement / impossible à réarmer",
      "next": "END-TRANSFER",
      "check": "Schneider Charge installation disjoncte — disjoncteur de la borne retombe immédiatement ou impossible à réarmer, transmission Service Technique"
    }
  ]
}
```

- [ ] **Step 3: Ajouter l’essai de charge**

```json
{
  "id": "SC-TRIP-CHARGER-TEST",
  "type": "question",
  "title": "Refaire un essai de charge",
  "body": "Si le disjoncteur tient après réarmement, demandez au client de refaire un essai de charge.",
  "source": "Validation métier",
  "validation": "valide",
  "answers": [
    {
      "id": "charge-ok",
      "label": "La charge fonctionne normalement",
      "next": "END-RESOLVED",
      "check": "Schneider Charge installation disjoncte — essai de charge OK après réarmement du disjoncteur de la borne"
    },
    {
      "id": "drops-during-charge",
      "label": "Le disjoncteur retombe pendant la charge",
      "next": "END-TRANSFER",
      "check": "Schneider Charge installation disjoncte — disjoncteur de la borne retombe pendant la charge, transmission Service Technique"
    }
  ]
}
```

- [ ] **Step 4: Lancer le test ciblé et vérifier le GREEN**

Run: `node --test tests/schneider-trip-simple.test.js`

Expected: PASS.

- [ ] **Step 5: Vérifier les régressions Schneider Charge Pro et photo AGCP**

Run: `node --test tests/schneider-charge-pro.test.js tests/vestel-basic-agcp-photo-alert.test.js`

Expected: PASS, notamment : Charge Pro pointe toujours vers `F-084` et `F-085` garde l’alerte photo appliquée par la policy transversale.

- [ ] **Step 6: Lancer la suite complète**

Run: `npm test`

Expected: 0 échec.

- [ ] **Step 7: Commit de l’implémentation**

```bash
git add data/schneider-charge-policy.json tests/schneider-trip-simple.test.js
git commit -m "feat: align Schneider Charge trip diagnostic"
```

---

### Task 3: Vérifier la livraison et préparer la PR

**Files:**
- Modify only if required by cache smoke test: `tests/smoke.test.js`, `app/main.js`, `index.html`
- Review: all files changed since `main`

**Interfaces:**
- Consumes: suite complète verte.
- Produces: PR limitée à la spec, au plan, aux tests, à la policy Schneider et éventuellement au bump de cache requis par les tests existants.

- [ ] **Step 1: Si le smoke test exige un nouveau cache, faire le cycle RED → bump → GREEN**

Ne changer la version de cache que si `npm test` échoue uniquement sur les assertions de version. Dans ce cas, incrémenter la version courante de manière cohérente dans `tests/smoke.test.js`, `app/main.js` et `index.html`, puis relancer `npm test`.

- [ ] **Step 2: Vérifier le diff**

Le diff ne doit pas modifier :
- `data/diagnostics/schneider-charge.json` ;
- les policies Vestel ;
- les autres symptômes Schneider.

- [ ] **Step 3: Vérifier une dernière fois la suite complète**

Run: `npm test`

Expected: 0 échec.

- [ ] **Step 4: Ouvrir la PR vers `main`**

Titre : `Aligner Schneider Charge — Installation disjoncte`

Corps attendu : rappeler le parcours à trois appareils, le réarmement unique, l’isolation des nœuds Vestel, la compatibilité Charge Pro et les résultats TDD/CI.
