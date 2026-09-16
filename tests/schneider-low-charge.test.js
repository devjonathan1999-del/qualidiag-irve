import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function effectiveSchneiderNodes() {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  return applySchneiderChargePolicy(nodes, policy);
}

async function vestelBasicLowChargeNodes() {
  const policy = await loadJson('../data/vestel-basic-low-charge-policy.json');
  return policy.addNodes;
}

test('les écrans communs Schneider Charge faible reprennent exactement les textes affichés du Vestel', async () => {
  const schneider = await effectiveSchneiderNodes();
  const vestel = await vestelBasicLowChargeNodes();
  const mappings = [
    ['F-087', 'VESTEL-BASIC-LOW-CABLE'],
    ['SC-LOW-VEHICLE', 'VESTEL-BASIC-LOW-VEHICLE'],
    ['SC-LOW-BEHAVIOR', 'VESTEL-BASIC-LOW-BEHAVIOR'],
    ['SC-LOW-REDUCE-LOAD', 'VESTEL-BASIC-LOW-REDUCE-LOAD'],
    ['SC-LOW-RESULT', 'VESTEL-BASIC-LOW-RESULT']
  ];

  for (const [schneiderId, vestelId] of mappings) {
    const schneiderNode = schneider.find(item => item.id === schneiderId);
    const vestelNode = vestel.find(item => item.id === vestelId);

    assert.equal(schneiderNode.title, vestelNode.title, `${schneiderId} title`);
    assert.equal(schneiderNode.body ?? null, vestelNode.body ?? null, `${schneiderId} body`);
    assert.equal(schneiderNode.alert ?? null, vestelNode.alert ?? null, `${schneiderId} alert`);
    assert.deepEqual(
      schneiderNode.answers.map(answer => answer.label),
      vestelNode.answers.map(answer => answer.label),
      `${schneiderId} answer labels`
    );
  }
});

test('Schneider Charge faible commence par vérifier le câble T2 32 A avec photo obligatoire', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'F-087');

  assert.match(node.title, /câble T2.*32 A/i);
  assert.match(node.body, /câble T2.*32 A/i);
  assert.match(node.alert, /photo.*câble.*marquage/i);
  assert.deepEqual(node.answers.map(answer => answer.id).sort(), ['cable-16a', 'cable-32a']);
  assert.equal(node.answers.find(answer => answer.id === 'cable-32a').next, 'SC-LOW-VEHICLE');
  assert.equal(node.answers.find(answer => answer.id === 'cable-16a').next, 'END-RESOLVED');
  for (const answer of node.answers) {
    assert.match(answer.set?.['attachments.t2CablePhoto'] ?? '', /photo.*câble T2/i);
  }
  assert.equal(node.validation, 'valide');
});

test('après un câble 32 A, QualiDiag vérifie une limitation de puissance côté véhicule', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-VEHICLE');

  assert.match(node.body, /véhicule.*limit/i);
  assert.equal(node.answers.find(answer => answer.id === 'vehicle-limited').next, 'END-RESOLVED');
  assert.equal(node.answers.find(answer => answer.id === 'vehicle-not-limited').next, 'SC-LOW-PEAK');
  assert.equal(node.validation, 'valide');
});

test('QualiDiag conserve le cas Schneider 12 kVA avec Peak Controller réglé à 50 A', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-PEAK');

  assert.match(node.body, /12 kVA/i);
  assert.match(node.body, /Peak Controller/i);
  assert.match(node.body, /50 A/i);
  assert.equal(node.answers.find(answer => answer.id === 'peak-12kva-50a').next, 'SC-LOW-PEAK-MANEUVER');
  assert.equal(node.answers.find(answer => answer.id === 'not-peak-case').next, 'SC-LOW-BEHAVIOR');
});

test('la procédure Peak Controller demande SET puis une rotation complète avant de poursuivre si la charge reste faible', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-PEAK-MANEUVER');

  assert.match(node.body, /SET/i);
  assert.match(node.body, /rotation complète/i);
  assert.match(node.body, /revenir à 50 A/i);
  assert.equal(node.answers.find(answer => answer.id === 'charge-normal').next, 'END-RESOLVED');
  assert.equal(node.answers.find(answer => answer.id === 'still-low').next, 'SC-LOW-BEHAVIOR');
});

test('après câble véhicule et Peak Controller, QualiDiag distingue une puissance fixe ou variable', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-BEHAVIOR');

  assert.match(node.title, /fixe.*variable/i);
  assert.equal(node.answers.find(answer => answer.id === 'fixed').next, 'END-TRANSFER');
  assert.equal(node.answers.find(answer => answer.id === 'variable').next, 'SC-LOW-REDUCE-LOAD');
  assert.equal(node.validation, 'valide');
});

test('une puissance variable demande de réduire temporairement les gros consommateurs', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-REDUCE-LOAD');

  assert.match(node.body, /réduire temporairement.*gros consommateurs/i);
  assert.equal(node.answers[0].next, 'SC-LOW-RESULT');
  assert.equal(node.validation, 'valide');
});

test('le résultat du test de consommation résout la gestion dynamique ou transfère au Service Technique', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-RESULT');

  assert.match(node.title, /puissance.*remonte/i);
  assert.equal(node.answers.find(answer => answer.id === 'power-rises').next, 'END-RESOLVED');
  assert.equal(node.answers.find(answer => answer.id === 'still-low').next, 'END-TRANSFER');
  assert.equal(node.validation, 'valide');
});
