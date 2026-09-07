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
  const wiserPolicy = await loadJson('../data/schneider-wiser-policy.json');
  const withValidatedSchneider = applySchneiderChargePolicy(nodes, policy);
  return applySchneiderChargePolicy(withValidatedSchneider, wiserPolicy);
}

test('Wiser croix rouge demande le message exact affiché avec trois choix métier', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'F-096');

  assert.equal(wiser.title, 'Quel message exact est affiché dans Wiser ?');
  assert.deepEqual(wiser.answers.map(answer => answer.id), [
    'not-available',
    'reconfigure',
    'other'
  ]);
  assert.equal(wiser.validation, 'valide');
});

test('Schneider Charge non disponible renvoie vers le parcours connectivité déjà validé', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'F-096');

  assert.equal(wiser.answers.find(answer => answer.id === 'not-available').next, 'F-091');
});

test('la demande de reconfiguration Wiser fait refaire l’association puis vérifie si la borne réapparaît', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'F-096');
  const reconfigure = effective.find(node => node.id === 'SC-WISER-RECONFIGURE');
  const result = effective.find(node => node.id === 'SC-WISER-RECONFIGURE-RESULT');

  assert.equal(wiser.answers.find(answer => answer.id === 'reconfigure').next, 'SC-WISER-RECONFIGURE');
  assert.match(reconfigure.body, /refaire l.?association.*Wiser/i);
  assert.equal(reconfigure.answers[0].next, 'SC-WISER-RECONFIGURE-RESULT');
  assert.match(result.title, /apparaît-elle de nouveau.*Wiser/i);
  assert.equal(result.answers.find(answer => answer.id === 'visible').next, 'END-RESOLVED');
  assert.equal(result.answers.find(answer => answer.id === 'still-missing').next, 'END-TRANSFER');
  assert.match(result.answers.find(answer => answer.id === 'still-missing').check, /message affiché/i);
});

test('un autre problème Wiser exige une capture écran avant transfert au Service Technique', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'F-096');
  const other = effective.find(node => node.id === 'SC-WISER-OTHER');

  assert.equal(wiser.answers.find(answer => answer.id === 'other').next, 'SC-WISER-OTHER');
  assert.match(other.body, /capture d.?écran/i);
  assert.equal(other.answers[0].next, 'END-TRANSFER');
});
