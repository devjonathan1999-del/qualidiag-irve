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

test('Schneider Charge faible commence par vérifier que le câble T2 est bien en 32 A', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'F-087');

  assert.equal(node.title, 'Charge faible');
  assert.match(node.body, /câble T2.*32 A/i);
  assert.deepEqual(node.answers.map(answer => answer.id), ['cable-32a', 'cable-16a']);
  assert.equal(node.answers.find(answer => answer.id === 'cable-32a').next, 'SC-LOW-VEHICLE');
  assert.equal(node.answers.find(answer => answer.id === 'cable-16a').next, 'END-RESOLVED');
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

test('QualiDiag isole le cas 12 kVA avec Peak Controller réglé à 50 A', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-PEAK');

  assert.match(node.body, /12 kVA/i);
  assert.match(node.body, /Peak Controller/i);
  assert.match(node.body, /50 A/i);
  assert.equal(node.answers.find(answer => answer.id === 'peak-12kva-50a').next, 'SC-LOW-PEAK-MANEUVER');
  assert.equal(node.answers.find(answer => answer.id === 'not-peak-case').next, 'SC-LOW-DPM');
});

test('la procédure Peak Controller demande SET puis une rotation complète pour revenir à 50 A', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-PEAK-MANEUVER');

  assert.match(node.body, /SET/i);
  assert.match(node.body, /rotation complète/i);
  assert.match(node.body, /revenir à 50 A/i);
  assert.equal(node.answers.find(answer => answer.id === 'charge-normal').next, 'END-RESOLVED');
  assert.equal(node.answers.find(answer => answer.id === 'still-low').next, 'SC-LOW-DPM');
});

test('en dernier recours, la gestion dynamique est vérifiée avant transmission au Service Technique', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-LOW-DPM');

  assert.match(node.body, /gestion dynamique/i);
  assert.match(node.body, /consommation.*logement/i);
  assert.equal(node.answers.find(answer => answer.id === 'dynamic-limitation').next, 'END-RESOLVED');
  assert.equal(node.answers.find(answer => answer.id === 'no-obvious-cause').next, 'END-TRANSFER');
  assert.equal(node.validation, 'valide');
});
