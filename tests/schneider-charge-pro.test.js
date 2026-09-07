import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function effectiveNodes() {
  const common = await loadJson('../data/diagnostics/common.json');
  const charge = await loadJson('../data/diagnostics/schneider-charge.json');
  const pro = await loadJson('../data/diagnostics/schneider-charge-pro.json');
  const chargePolicy = await loadJson('../data/schneider-charge-policy.json');
  const wiserPolicy = await loadJson('../data/schneider-wiser-policy.json');
  const smartchargePolicy = await loadJson('../data/schneider-smartcharge-policy.json');
  const proPolicy = await loadJson('../data/schneider-charge-pro-policy.json');

  let effective = [...common, ...charge, ...pro];
  effective = applySchneiderChargePolicy(effective, chargePolicy);
  effective = applySchneiderChargePolicy(effective, wiserPolicy);
  effective = applySchneiderChargePolicy(effective, smartchargePolicy);
  return applySchneiderChargePolicy(effective, proPolicy);
}

test('Schneider Charge Pro expose les cinq symptômes validés et réutilise les parcours communs', async () => {
  const nodes = await effectiveNodes();
  const entry = nodes.find(node => node.id === 'F-098');

  assert.equal(entry.title, 'Quel est le problème rencontré ?');
  assert.equal(entry.validation, 'valide');
  assert.deepEqual(entry.answers.map(answer => answer.id), [
    'l-installation-disjoncte',
    'led-rouge-fixe',
    'led-bleue-clignotante',
    'led-orange-respirant',
    'charge-faible'
  ]);

  assert.equal(entry.answers.find(answer => answer.id === 'l-installation-disjoncte').next, 'F-084');
  assert.equal(entry.answers.find(answer => answer.id === 'led-rouge-fixe').next, 'F-090');
  assert.equal(entry.answers.find(answer => answer.id === 'charge-faible').next, 'F-087');
  assert.equal(entry.answers.find(answer => answer.id === 'led-bleue-clignotante').next, 'SCP-BLUE-WAIT');
  assert.equal(entry.answers.find(answer => answer.id === 'led-orange-respirant').next, 'SCP-ORANGE-RESET');

  assert.equal(nodes.find(node => node.id === 'F-084').validation, 'valide');
  assert.equal(nodes.find(node => node.id === 'F-090').validation, 'valide');
  assert.equal(nodes.find(node => node.id === 'F-087').validation, 'valide');
});

test('Charge Pro LED bleue clignotante distingue une mise en attente volontaire', async () => {
  const nodes = await effectiveNodes();
  const blue = nodes.find(node => node.id === 'SCP-BLUE-WAIT');

  assert.match(blue.title, /volontairement.*attente/i);
  assert.match(blue.body, /véhicule|supervision|gestion de charge|puissance/i);
  assert.equal(blue.answers.find(answer => answer.id === 'waiting').next, 'END-RESOLVED');
  assert.equal(blue.answers.find(answer => answer.id === 'not-waiting').next, 'END-TRANSFER');
  assert.equal(blue.validation, 'valide');
});

test('Charge Pro LED orange clignotante impose un reset 5 minutes au disjoncteur puis un transfert si KO', async () => {
  const nodes = await effectiveNodes();
  const reset = nodes.find(node => node.id === 'SCP-ORANGE-RESET');
  const result = nodes.find(node => node.id === 'SCP-ORANGE-RESULT');

  assert.match(reset.body, /disjoncteur/i);
  assert.match(reset.body, /5\s*minutes/i);
  assert.equal(reset.answers[0].next, 'SCP-ORANGE-RESULT');
  assert.equal(result.answers.find(answer => answer.id === 'resolved').next, 'END-RESOLVED');
  assert.equal(result.answers.find(answer => answer.id === 'still-orange').next, 'END-TRANSFER');
  assert.equal(reset.validation, 'valide');
  assert.equal(result.validation, 'valide');
});

test('le chargement principal inclut la politique Schneider Charge Pro', async () => {
  const source = await readFile(new URL('../app/data.js', import.meta.url), 'utf8');
  assert.match(source, /schneider-charge-pro-policy\.json/);
  assert.match(source, /schneiderChargeProPolicy/);
});
