import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('Schneider LED bleue clignotante reste sur une seule question de programmation', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const blue = effective.find(node => node.id === 'F-089');

  assert.equal(blue.title, 'LED bleue clignotante');
  assert.match(blue.body, /charge.*programmée/i);
  assert.match(blue.body, /véhicule|Smartcharge|Wiser/i);
  assert.doesNotMatch(blue.body, /puiss app soutir/i);
  assert.doesNotMatch(blue.body, /bouton \+/i);
  assert.deepEqual(blue.answers.map(answer => answer.id), ['scheduled', 'not-scheduled']);
});

test('une programmation explique le comportement, sinon le dossier part au Service Technique', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const blue = effective.find(node => node.id === 'F-089');

  const scheduled = blue.answers.find(answer => answer.id === 'scheduled');
  const notScheduled = blue.answers.find(answer => answer.id === 'not-scheduled');

  assert.match(scheduled.label, /véhicule|Smartcharge|Wiser/i);
  assert.equal(scheduled.next, 'END-RESOLVED');
  assert.equal(notScheduled.next, 'END-TRANSFER');
  assert.equal(blue.validation, 'valide');
});
