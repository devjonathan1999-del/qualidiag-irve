# QualiDiag IRVE V1 Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un prototype web statique de QualiDiag utilisable depuis Edge/Chrome, avec tronc commun, moteur d’arborescence générique, un parcours pilote complet `Schneider Charge → Charge faible`, reprise d’un brouillon local et résumé prêt à copier dans Salesforce.

**Architecture:** L’application est une SPA statique en JavaScript natif sans framework ni backend. Le moteur, la session, le résumé et le stockage sont des modules purs testables avec le runner natif de Node.js ; les règles métier sont chargées depuis des fichiers JSON et l’UI ne contient aucune règle IRVE en dur.

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, JSON, Node.js 20+ uniquement pour les tests, GitHub Pages pour le déploiement.

**Spec:** `docs/superpowers/specs/2026-09-03-qualidiag-v1-design.md`

## Global Constraints

- Aucun logiciel à installer sur les postes des chargés d'affaires.
- Accès par simple URL dans Edge/Chrome.
- Pas d'authentification en V1.
- Pas d'intégration Salesforce, SharePoint ou M365 en V1.
- Pas de stockage serveur de données client.
- Pas de dépendance à Google Drive pendant l'utilisation.
- Le contenu métier doit être séparé du moteur.
- QualiDiag et TechDiag restent séparés en V1.
- Aucun nom/prénom client n’est requis ni stocké.
- Une question principale par écran.
- Le prototype n’intègre pas silencieusement des règles TechDiag absentes du Forms source.
- Le premier parcours pilote complet est `Schneider Charge → Charge faible`.

---

## File Structure

```text
index.html                     # Point d’entrée navigateur
.nojekyll                      # Empêche le traitement Jekyll sur GitHub Pages
package.json                   # Runner de tests Node, sans dépendance runtime
README.md                      # Lancement local, tests et publication
styles/app.css                 # Design responsive de l’application
app/main.js                    # Bootstrap navigateur et orchestration
app/data.js                    # Chargement + validation des fichiers JSON
app/engine.js                  # Résolution d’un nœud et d’une réponse
app/session.js                 # État de qualification et historique de navigation
app/storage.js                 # Sauvegarde/reprise locale du brouillon
app/summary.js                 # Génération du texte Salesforce
app/presenter.js               # Transformation état métier -> view model UI
app/ui.js                      # Rendu DOM et événements utilisateur
data/brands.json               # Catalogue marques et disponibilité pilote
data/models.json               # Catalogue modèles et disponibilité pilote
data/diagnostics.json          # Graphe de questions/actions
ndata/procedures.json           # Procédures textuelles réutilisables
data/conclusions.json          # Conclusions terminales
ndata/resources.json            # Ressources documentaires de la base
ntests/engine.test.js           # Navigation du moteur
ntests/data.test.js             # Cohérence des références de la base
ntests/session.test.js          # Historique, retour et contexte
ntests/storage.test.js          # Brouillon local
ntests/summary.test.js          # Résumé Salesforce
ntests/presenter.test.js        # View models UI
```

> Correction de structure à appliquer à l’implémentation : les trois chemins préfixés par `ndata/` et les cinq chemins préfixés par `ntests/` ci-dessus sont respectivement `data/` et `tests/`. Cette note évite toute ambiguïté de lecture du plan et ces préfixes ne doivent jamais être créés dans le dépôt.

---

### Task 1: Socle statique et harness de tests

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `styles/app.css`
- Create: `app/main.js`
- Create: `.nojekyll`
- Create: `README.md`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Consumes: aucune.
- Produces: `index.html` charge `./styles/app.css` et `./app/main.js`; `npm test` exécute `node --test tests/*.test.js`.

- [ ] **Step 1: Écrire le test smoke qui exige les fichiers d’entrée**

```js
// tests/smoke.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('index charge le CSS et le module principal', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /styles\/app\.css/);
  assert.match(html, /app\/main\.js/);
  assert.match(html, /id="app"/);
});
```

- [ ] **Step 2: Lancer le test et vérifier l’échec**

Run: `node --test tests/smoke.test.js`

Expected: FAIL avec `ENOENT` sur `index.html`.

- [ ] **Step 3: Créer le socle minimal exécutable**

```json
// package.json
{
  "name": "qualidiag-irve",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

```html
<!-- index.html -->
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>QualiDiag IRVE</title>
  <link rel="stylesheet" href="./styles/app.css">
</head>
<body>
  <main id="app" aria-live="polite"></main>
  <script type="module" src="./app/main.js"></script>
</body>
</html>
```

```js
// app/main.js
const root = document.querySelector('#app');
root.innerHTML = '<section class="shell"><h1>QualiDiag IRVE</h1><p>Chargement de la base…</p></section>';
```

- [ ] **Step 4: Ajouter le CSS de base et la documentation de lancement**

Le CSS doit définir : largeur max 880 px, centrage, cartes, boutons minimum 48 px de haut, focus visible, layout desktop responsive et aucune police distante.

Le `README.md` doit documenter exactement :

```bash
python -m http.server 8080
npm test
```

et l’URL locale `http://localhost:8080/`.

- [ ] **Step 5: Relancer le test**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json index.html styles/app.css app/main.js .nojekyll README.md tests/smoke.test.js
git commit -m "chore: scaffold QualiDiag static app"
```

---

### Task 2: Moteur générique de navigation

**Files:**
- Create: `app/engine.js`
- Test: `tests/engine.test.js`

**Interfaces:**
- Consumes: tableau de nœuds `{id,type,title,answers?}`.
- Produces:
  - `buildGraph(nodes: Array<Node>): Map<string, Node>`
  - `getNode(graph: Map<string, Node>, nodeId: string): Node`
  - `resolveAnswer(graph: Map<string, Node>, nodeId: string, answerId: string): { node: Node, answer: Answer, nextId: string }`
  - `GraphError extends Error` avec `code` parmi `DUPLICATE_NODE`, `NODE_NOT_FOUND`, `ANSWER_NOT_FOUND`, `MISSING_NEXT`.

- [ ] **Step 1: Écrire les tests d’échec du moteur**

```js
// tests/engine.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, getNode, resolveAnswer, GraphError } from '../app/engine.js';

const nodes = [
  {
    id: 'Q1', type: 'question', title: 'Choix ?',
    answers: [{ id: 'yes', label: 'Oui', next: 'END' }]
  },
  { id: 'END', type: 'conclusion', conclusionId: 'RESOLVED' }
];

test('résout une réponse vers le nœud suivant', () => {
  const graph = buildGraph(nodes);
  const result = resolveAnswer(graph, 'Q1', 'yes');
  assert.equal(result.nextId, 'END');
  assert.equal(getNode(graph, result.nextId).type, 'conclusion');
});

test('rejette un nœud absent avec un code stable', () => {
  const graph = buildGraph(nodes);
  assert.throws(() => getNode(graph, 'UNKNOWN'), err => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.code, 'NODE_NOT_FOUND');
    return true;
  });
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `node --test tests/engine.test.js`

Expected: FAIL car `app/engine.js` n’existe pas.

- [ ] **Step 3: Implémenter le moteur minimal**

```js
// app/engine.js
export class GraphError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GraphError';
    this.code = code;
  }
}

export function buildGraph(nodes) {
  const graph = new Map();
  for (const node of nodes) {
    if (graph.has(node.id)) throw new GraphError('DUPLICATE_NODE', `Nœud dupliqué: ${node.id}`);
    graph.set(node.id, node);
  }
  return graph;
}

export function getNode(graph, nodeId) {
  const node = graph.get(nodeId);
  if (!node) throw new GraphError('NODE_NOT_FOUND', `Nœud introuvable: ${nodeId}`);
  return node;
}

export function resolveAnswer(graph, nodeId, answerId) {
  const node = getNode(graph, nodeId);
  const answer = node.answers?.find(item => item.id === answerId);
  if (!answer) throw new GraphError('ANSWER_NOT_FOUND', `Réponse introuvable: ${answerId}`);
  if (!answer.next) throw new GraphError('MISSING_NEXT', `Aucune destination pour ${nodeId}/${answerId}`);
  return { node, answer, nextId: answer.next };
}
```

- [ ] **Step 4: Ajouter les tests duplication, réponse absente et destination vide**

Les assertions doivent contrôler les trois codes `DUPLICATE_NODE`, `ANSWER_NOT_FOUND` et `MISSING_NEXT`.

- [ ] **Step 5: Exécuter les tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/engine.js tests/engine.test.js
git commit -m "feat: add generic diagnostic graph engine"
```

---

### Task 3: Session, contexte et bouton Retour

**Files:**
- Create: `app/session.js`
- Test: `tests/session.test.js`

**Interfaces:**
- Consumes: un `Node` et un `Answer` issus du moteur.
- Produces:
  - `createSession(startNodeId: string): Session`
  - `recordAnswer(session: Session, node: Node, answer: Answer): Session`
  - `goBack(session: Session): Session`
  - `restartSession(startNodeId: string): Session`
- `Session` contient `currentNodeId`, `history`, `context`, `checks`, `startedAt`.
- `Answer.set` est un objet de clés plates (`installation.phase`, `brand`, `model`, `symptom`, etc.) appliquées à `session.context`.
- `Answer.check` ajoute une chaîne à `session.checks`.

- [ ] **Step 1: Écrire les tests de session**

```js
// tests/session.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, recordAnswer, goBack } from '../app/session.js';

const node = { id: 'Q-PHASE', title: 'Installation ?' };
const answer = {
  id: 'mono', label: 'Monophasée', next: 'Q-POWER',
  set: { 'installation.phase': 'Monophasée' },
  check: 'Installation monophasée confirmée'
};

test('enregistre le choix et le contexte', () => {
  const session = recordAnswer(createSession('Q-PHASE'), node, answer);
  assert.equal(session.currentNodeId, 'Q-POWER');
  assert.equal(session.context['installation.phase'], 'Monophasée');
  assert.deepEqual(session.checks, ['Installation monophasée confirmée']);
  assert.equal(session.history.length, 1);
});

test('retour restaure le contexte précédent', () => {
  const initial = createSession('Q-PHASE');
  const advanced = recordAnswer(initial, node, answer);
  const restored = goBack(advanced);
  assert.equal(restored.currentNodeId, 'Q-PHASE');
  assert.equal(restored.context['installation.phase'], undefined);
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `node --test tests/session.test.js`

Expected: FAIL car `app/session.js` n’existe pas.

- [ ] **Step 3: Implémenter une session immuable**

Chaque entrée `history` doit stocker un snapshot `{nodeId, context, checks}` avant transition afin que `goBack()` restaure exactement l’état antérieur, y compris les éléments de contrôle.

- [ ] **Step 4: Tester deux retours successifs et le retour au début**

`goBack()` sur un historique vide doit retourner la session inchangée sans lever d’exception.

- [ ] **Step 5: Exécuter les tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/session.js tests/session.test.js
git commit -m "feat: track qualification session and navigation history"
```

---

### Task 4: Brouillon local sans données nominatives

**Files:**
- Create: `app/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: objet `Session` sérialisable et un adaptateur compatible `Storage`.
- Produces:
  - `saveDraft(storage, session): void`
  - `loadDraft(storage): Session | null`
  - `clearDraft(storage): void`
- Clé fixe: `qualidiag:draft:v1`.

- [ ] **Step 1: Écrire un faux Storage et les tests**

```js
// tests/storage.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDraft, loadDraft, clearDraft } from '../app/storage.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('sauvegarde, recharge et efface le brouillon', () => {
  const storage = memoryStorage();
  const session = { currentNodeId: 'Q1', context: { brand: 'Schneider Charge' } };
  saveDraft(storage, session);
  assert.deepEqual(loadDraft(storage), session);
  clearDraft(storage);
  assert.equal(loadDraft(storage), null);
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `node --test tests/storage.test.js`

Expected: FAIL car `app/storage.js` n’existe pas.

- [ ] **Step 3: Implémenter le stockage avec gestion du JSON corrompu**

`loadDraft()` doit retourner `null` et supprimer la clé si `JSON.parse` échoue ; aucune exception de stockage ne doit bloquer le moteur.

- [ ] **Step 4: Ajouter le test JSON corrompu**

Le test place `'{'` dans la clé puis vérifie `loadDraft(storage) === null`.

- [ ] **Step 5: Exécuter les tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/storage.js tests/storage.test.js
git commit -m "feat: persist local qualification draft"
```

---

### Task 5: Base JSON pilote et validation des références

**Files:**
- Create: `app/data.js`
- Create: `data/brands.json`
- Create: `data/models.json`
- Create: `data/diagnostics.json`
- Create: `data/procedures.json`
- Create: `data/conclusions.json`
- Create: `data/resources.json`
- Test: `tests/data.test.js`

**Interfaces:**
- Consumes: fichiers JSON statiques.
- Produces:
  - `loadData(baseUrl = '../data/'): Promise<AppData>` dans le navigateur.
  - `validateData(data: AppData): string[]` retourne une liste d’erreurs, vide si cohérent.
  - `AppData = {brands, models, nodes, procedures, conclusions, resources}`.

- [ ] **Step 1: Écrire les tests de validation**

```js
// tests/data.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateData } from '../app/data.js';

const valid = {
  brands: [{ id: 'schneider', label: 'Schneider Charge', pilot: true }],
  models: [{ id: 'schneider-charge', brandId: 'schneider', label: 'Schneider Charge', pilot: true }],
  procedures: [], resources: [],
  conclusions: [{ id: 'RESOLVED', status: 'resolved', title: 'Résolu' }],
  nodes: [
    { id: 'START', type: 'question', answers: [{ id: 'go', label: 'Continuer', next: 'END' }] },
    { id: 'END', type: 'conclusion', conclusionId: 'RESOLVED' }
  ]
};

test('accepte une base cohérente', () => {
  assert.deepEqual(validateData(valid), []);
});

test('détecte une destination inexistante', () => {
  const broken = structuredClone(valid);
  broken.nodes[0].answers[0].next = 'UNKNOWN';
  assert.match(validateData(broken).join('\n'), /UNKNOWN/);
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `node --test tests/data.test.js`

Expected: FAIL car `app/data.js` n’existe pas.

- [ ] **Step 3: Implémenter `validateData`**

La validation doit contrôler : IDs de nœuds uniques, chaque `answer.next`, chaque `conclusionId`, `model.brandId`, et type de nœud parmi `question`, `action`, `conclusion`.

- [ ] **Step 4: Créer les catalogues pilotes**

`brands.json` doit contenir les six familles du Forms : Vestel IZI by EDF, Wallbox, Free2Move, Hager, Schneider Charge, Schneider Charge Pro. Seule `Schneider Charge` porte `"pilot": true` dans ce premier incrément.

`models.json` doit au minimum contenir `Schneider Charge` rattaché à la marque pilote ; les autres modèles connus du Forms peuvent être présents avec `"pilot": false`, sans créer de faux parcours.

- [ ] **Step 5: Créer le parcours pilote complet dans `diagnostics.json`**

Le graphe doit contenir exactement ces étapes métier, dans cet ordre :

```text
START
→ Réclamation client / Recherche information
→ Installation Mono / Tri
→ Puissance abonnement
→ Autocontrôle exploitable ?
→ Autocontrôle conforme ?
→ Véhicule optionnel : renseigner / passer
→ Marque : Schneider Charge
→ Modèle : Schneider Charge
→ Symptôme : Charge faible
→ Câble 32 A ?
→ Consommation logement élevée ?
→ Limitation de charge côté véhicule ?
→ Conclusion résolue OU Transmission Service Technique
```

Pour le parcours `Charge faible`, les libellés et l’ordre doivent rester conformes au Forms source : câble 32 A, consommation du logement, limitation véhicule. Le prototype ne doit pas ajouter d’étape technique issue de TechDiag.

- [ ] **Step 6: Créer les conclusions terminales**

`conclusions.json` doit définir au minimum :

```json
[
  {
    "id": "RESOLVED_CA",
    "status": "resolved",
    "title": "Résolu par le chargé d'affaires"
  },
  {
    "id": "TRANSFER_TECH",
    "status": "technical_transfer",
    "title": "Transmission Service Technique"
  },
  {
    "id": "WAITING_ELEMENTS",
    "status": "waiting",
    "title": "En attente d'éléments client"
  }
]
```

`procedures.json` et `resources.json` sont des tableaux JSON valides ; ils peuvent être vides dans ce prototype car le parcours pilote n’en dépend pas.

- [ ] **Step 7: Tester les vrais fichiers JSON**

Le test doit lire les six fichiers avec `readFile`, les parser, appeler `validateData()` et exiger `[]`.

- [ ] **Step 8: Exécuter les tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/data.js data tests/data.test.js
git commit -m "feat: add validated pilot diagnostic data"
```

---

### Task 6: Générateur de résumé Salesforce

**Files:**
- Create: `app/summary.js`
- Test: `tests/summary.test.js`

**Interfaces:**
- Consumes: `Session`, `Conclusion`.
- Produces: `buildSalesforceSummary(session, conclusion): string`.

- [ ] **Step 1: Écrire le test avec le format attendu**

```js
// tests/summary.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesforceSummary } from '../app/summary.js';

const session = {
  context: {
    'installation.phase': 'Monophasée',
    'installation.power': '9 kVA',
    brand: 'Schneider Charge',
    model: 'Schneider Charge',
    symptom: 'Charge faible'
  },
  checks: [
    'Câble 32 A confirmé',
    'Consommation logement vérifiée',
    'Limitation véhicule vérifiée'
  ]
};

const conclusion = { title: 'Transmission Service Technique' };

test('génère un résumé lisible pour Salesforce', () => {
  const text = buildSalesforceSummary(session, conclusion);
  assert.match(text, /Installation : Monophasée/);
  assert.match(text, /Abonnement : 9 kVA/);
  assert.match(text, /Borne : Schneider Charge/);
  assert.match(text, /Symptôme : Charge faible/);
  assert.match(text, /Câble 32 A confirmé/);
  assert.match(text, /Conclusion : Transmission Service Technique/);
  assert.doesNotMatch(text, /Nom|Prénom/);
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `node --test tests/summary.test.js`

Expected: FAIL car `app/summary.js` n’existe pas.

- [ ] **Step 3: Implémenter le format**

Le texte doit avoir exactement les sections :

```text
QUALIFICATION QUALIDIAG
Installation : …
Abonnement : …
Borne : …
Modèle : …
Symptôme : …

Vérifications réalisées :
- …

Conclusion : …
```

Les champs absents sont omis plutôt qu’imprimés vides.

- [ ] **Step 4: Ajouter un test session partielle**

Une session sans modèle ni checks doit produire un résumé valide sans ligne `Modèle` ni section vide `Vérifications réalisées`.

- [ ] **Step 5: Exécuter les tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/summary.js tests/summary.test.js
git commit -m "feat: generate Salesforce qualification summary"
```

---

### Task 7: Presenter testable et interface guidée

**Files:**
- Create: `app/presenter.js`
- Create: `app/ui.js`
- Modify: `app/main.js`
- Modify: `styles/app.css`
- Test: `tests/presenter.test.js`

**Interfaces:**
- Consumes: `Node`, `Session`, catalogues et conclusion.
- Produces:
  - `toViewModel(node, session, data): ViewModel`
  - `render(root, viewModel, handlers): void`
  - handlers : `onAnswer(answerId)`, `onBack()`, `onRestart()`, `onResumeDraft()`, `onDiscardDraft()`, `onCopySummary()`.

- [ ] **Step 1: Tester le view model d’une question**

```js
// tests/presenter.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toViewModel } from '../app/presenter.js';

const node = {
  id: 'Q-CABLE', type: 'question', title: 'Le câble est-il un modèle 32 A ?',
  answers: [
    { id: 'yes', label: 'Oui', next: 'Q-HOME' },
    { id: 'no', label: 'Non', next: 'END' }
  ]
};

const session = {
  context: { brand: 'Schneider Charge', model: 'Schneider Charge', symptom: 'Charge faible' },
  history: [{ nodeId: 'START' }]
};

test('expose contexte, réponses et possibilité de retour', () => {
  const vm = toViewModel(node, session, {});
  assert.equal(vm.title, node.title);
  assert.deepEqual(vm.answers.map(a => a.label), ['Oui', 'Non']);
  assert.equal(vm.canGoBack, true);
  assert.equal(vm.context.brand, 'Schneider Charge');
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `node --test tests/presenter.test.js`

Expected: FAIL car `app/presenter.js` n’existe pas.

- [ ] **Step 3: Implémenter le presenter**

Pour `type: question`, le view model expose `title`, `body`, `answers`, `canGoBack`, `context` et `kind: 'question'`.

Pour `type: action`, il expose `kind: 'action'`, `title`, `body` et les réponses de confirmation définies dans la base.

Pour `type: conclusion`, il expose `kind: 'conclusion'`, le titre de conclusion et le texte généré par `buildSalesforceSummary`.

- [ ] **Step 4: Implémenter le rendu DOM**

L’UI doit produire :
- en-tête `QualiDiag IRVE` ;
- bandeau de contexte avec marque/modèle/symptôme lorsqu’ils existent ;
- carte principale ;
- un bouton par réponse ;
- bouton `Retour` seulement si `canGoBack` ;
- sur conclusion, zone `<pre>` ou `<textarea readonly>` et bouton `Copier pour Salesforce` ;
- bouton `Nouvelle qualification` à la fin.

Aucune règle de choix ne doit être écrite dans `ui.js`.

- [ ] **Step 5: Orchestrer dans `main.js`**

Flux attendu :

```js
const data = await loadData();
const errors = validateData(data);
if (errors.length) renderFatalDataError(errors);
else startOrOfferDraft();
```

Après chaque réponse : `resolveAnswer` → `recordAnswer` → `saveDraft` → `renderCurrent`.

Après `Retour` : `goBack` → `saveDraft` → `renderCurrent`.

Après fin et `Nouvelle qualification` : `clearDraft` → `restartSession('START')`.

`navigator.clipboard.writeText(summary)` est utilisé pour le bouton de copie ; en cas d’échec, le texte reste sélectionnable et un message `Copie automatique impossible — sélectionnez le texte.` est affiché.

- [ ] **Step 6: Ajouter l’écran de reprise de brouillon**

Si `loadDraft(localStorage)` retourne une session : afficher avant le parcours deux boutons `Reprendre la qualification` et `Nouvelle qualification`. Le second efface immédiatement le brouillon.

- [ ] **Step 7: Exécuter les tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Vérification navigateur manuelle**

Run: `python -m http.server 8080`

Vérifier dans Edge ou Chrome :
1. une question principale à la fois ;
2. retour fonctionnel ;
3. rafraîchissement puis reprise du brouillon ;
4. parcours Schneider Charge → Charge faible jusqu’à conclusion ;
5. bouton Copier pour Salesforce ;
6. aucune requête vers Google Drive, Salesforce ou M365 dans l’onglet Network.

- [ ] **Step 9: Commit**

```bash
git add app/main.js app/presenter.js app/ui.js styles/app.css tests/presenter.test.js
git commit -m "feat: add guided QualiDiag browser interface"
```

---

### Task 8: Erreurs sûres, validation finale et préparation GitHub Pages

**Files:**
- Modify: `app/main.js`
- Modify: `app/ui.js`
- Modify: `README.md`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Consumes: `GraphError`, erreurs de `validateData`, brouillon courant.
- Produces: écran d’erreur non bloquant avec résumé partiel lorsque possible.

- [ ] **Step 1: Ajouter un test statique de l’écran d’erreur attendu**

Ajouter à `tests/smoke.test.js` une vérification que `app/ui.js` contient le texte fonctionnel `Parcours incomplet — transmettre au Service Technique` et que `app/main.js` importe `GraphError`.

- [ ] **Step 2: Vérifier que le nouveau test échoue**

Run: `node --test tests/smoke.test.js`

Expected: FAIL avant modification des fichiers.

- [ ] **Step 3: Gérer les erreurs de graphe pendant un parcours**

Sur `NODE_NOT_FOUND`, `ANSWER_NOT_FOUND` ou `MISSING_NEXT` :
- ne pas réinitialiser la session ;
- afficher `Parcours incomplet — transmettre au Service Technique` ;
- générer le résumé depuis les données déjà présentes ;
- proposer `Copier le résumé partiel` et `Nouvelle qualification`.

Sur échec de chargement/validation des JSON : afficher `Impossible de charger la base QualiDiag.` avec la liste technique des erreurs, sans inventer de parcours de remplacement.

- [ ] **Step 4: Documenter le pilote et GitHub Pages**

Le `README.md` doit indiquer :
- `npm test` avant publication ;
- serveur local `python -m http.server 8080` ;
- parcours pilote disponible : `Schneider Charge → Charge faible` ;
- marques non pilotes non présentées comme diagnostics disponibles ;
- procédure GitHub UI : `Settings → Pages → Deploy from a branch → main / (root) → Save` ;
- URL attendue seulement après activation : `https://devjonathan1999-del.github.io/qualidiag-irve/`.

- [ ] **Step 5: Lancer la suite complète**

Run: `npm test`

Expected: tous les tests PASS, aucun test ignoré.

- [ ] **Step 6: Vérification finale navigateur**

Run: `python -m http.server 8080`

Effectuer deux parcours :
- un parcours résolu ;
- un parcours allant jusqu’à `Transmission Service Technique`.

Rafraîchir au milieu de chacun pour confirmer la reprise locale.

- [ ] **Step 7: Commit**

```bash
git add app/main.js app/ui.js README.md tests/smoke.test.js
git commit -m "docs: harden pilot and document GitHub Pages deployment"
```

---

## Self-Review du plan

- **Couverture spec :** socle statique, moteur séparé, JSON métier, tronc commun, choix marque/modèle, diagnostic commun `Charge faible`, conclusion, résumé Salesforce, brouillon local, retour, erreurs sûres et GitHub Pages sont couverts.
- **Hors périmètre respecté :** aucune authentification, aucun backend, aucune écriture Salesforce, aucune connexion M365/SharePoint, aucun stockage nominatif.
- **Périmètre pilote explicite :** un seul parcours métier complet est intégré afin de valider l’architecture avant conversion progressive des 53 pages.
- **Types/interfaces cohérents :** les tâches utilisent les mêmes noms `Session`, `Node`, `Answer`, `Conclusion`, `buildGraph`, `resolveAnswer`, `recordAnswer`, `buildSalesforceSummary` et `toViewModel`.
