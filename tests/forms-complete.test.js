import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadNodes() {
  return JSON.parse(await readFile(new URL('../data/diagnostics.json', import.meta.url), 'utf8'));
}

const expectedSymptoms = {
  'F-012': ['LED Violet fixe', 'Installation disjoncte', 'Charge faible', 'Ma charge ne se lance pas', 'Application', 'Autre'],
  'F-013': ['LED Rouge', 'LED Violet fixe', 'LED clignote rouge et bleu', 'Installation disjoncte', 'Charge faible', 'Ma charge ne se lance pas pendant mes heures creuses', 'Badge RFID', 'Autre'],
  'F-028': ['Borne LED Rouge', 'Borne éteinte', 'Bluetooth', 'Wi-fi', 'Installation disjoncte', 'Application (Software)', 'Code erreur', 'Câble bloqué', 'Charge faible'],
  'F-054': ["Je n'arrive pas à connecter ma borne à mon réseau Wifi", 'Ma borne est en défaut LED rouge', 'Mon installation disjoncte', 'Ma borne reste en bleu fixe (Charge ne se lance pas)', 'Charge faible'],
  'F-070': ['Mon installation disjoncte', 'LED rouge fixe', 'LED clignote rouge', 'LED vert clignotant', 'Charge faible'],
  'F-082': ['Mon installation disjoncte', 'LED rouge fixe 🔴', 'LED Bleu clignotante 🔵', 'LED Orange clignotante 🟠', 'Charge faible', 'Application Wiser (Croix rouge ❌)', 'Application IZI by EDF (Smartcharge)'],
  'F-098': ["L'installation disjoncte", 'LED rouge fixe', 'LED bleue clignotante', 'LED orange "respirant"', 'Charge faible']
};

test('expose les six familles de bornes du Forms', async () => {
  const nodes = await loadNodes();
  const brand = nodes.find(node => node.id === 'Q-BRAND');
  assert.deepEqual(brand.answers.map(answer => answer.id), [
    'vestel', 'wallbox', 'free2move', 'hager', 'schneider-charge', 'schneider-charge-pro'
  ]);
});

test('expose tous les symptômes principaux du Forms par famille', async () => {
  const nodes = await loadNodes();
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const [nodeId, labels] of Object.entries(expectedSymptoms)) {
    const actual = new Set(byId.get(nodeId).answers.map(answer => answer.label));
    for (const label of labels) assert.equal(actual.has(label), true, `${nodeId}: ${label}`);
  }
});

test('chaque destination existe et chaque noeud métier peut atteindre une conclusion', async () => {
  const nodes = await loadNodes();
  const byId = new Map(nodes.map(node => [node.id, node]));
  const conclusions = new Set(nodes.filter(node => node.type === 'conclusion').map(node => node.id));

  for (const node of nodes) {
    for (const answer of node.answers ?? []) {
      assert.equal(byId.has(answer.next), true, `${node.id}/${answer.id} -> ${answer.next}`);
      assert.equal(/^https?:/i.test(answer.label), false, `${node.id}: URL utilisée comme réponse`);
      assert.equal(/^Lien vers/i.test(answer.label), false, `${node.id}: lien utilisé comme réponse`);
    }
  }

  function reachesTerminal(nodeId, stack = new Set()) {
    if (conclusions.has(nodeId)) return true;
    if (stack.has(nodeId)) return false;
    const nextStack = new Set(stack);
    nextStack.add(nodeId);
    const node = byId.get(nodeId);
    return (node.answers ?? []).some(answer => reachesTerminal(answer.next, nextStack));
  }

  for (const node of nodes) {
    assert.equal(reachesTerminal(node.id), true, `Aucune sortie terminale depuis ${node.id}`);
  }
});

test('conserve les deux destinations absentes de l’export comme inférences explicites', async () => {
  const nodes = await loadNodes();
  const byId = new Map(nodes.map(node => [node.id, node]));
  const inferred = [
    byId.get('F-039').answers.find(answer => answer.id === 'erreur-acces-gestion-charge'),
    byId.get('F-066').answers.find(answer => answer.id === 'erreur-308-persiste')
  ];
  for (const answer of inferred) {
    assert.equal(answer.next, 'F-106');
    assert.match(answer.sourceInference, /Destination absente/);
  }
});

test('le résumé final reprend les trois statuts du Forms', async () => {
  const nodes = await loadNodes();
  const final = nodes.find(node => node.id === 'F-107');
  assert.deepEqual(new Set(final.answers.map(answer => answer.next)), new Set([
    'END-TRANSFER', 'END-RESOLVED', 'END-WAITING'
  ]));
});
