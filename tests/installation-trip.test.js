import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadSchneiderNodes() {
  return JSON.parse(await readFile(new URL('../data/diagnostics/schneider-charge.json', import.meta.url), 'utf8'));
}

test('Schneider Charge propose le symptôme Installation disjoncte', async () => {
  const nodes = await loadSchneiderNodes();
  const symptom = nodes.find(node => node.id === 'F-082');
  const answer = symptom.answers.find(item => item.id === 'mon-installation-disjoncte');
  assert.equal(answer.label, 'Mon installation disjoncte');
  assert.equal(answer.next, 'F-084');
});

test('le Forms distingue Linky et disjoncteur de branchement', async () => {
  const nodes = await loadSchneiderNodes();
  const device = nodes.find(node => node.id === 'F-084');
  assert.deepEqual(device.answers.map(item => item.id), ['le-compteur-linky', 'le-disjoncteur-de-branchement']);
  assert.equal(device.answers.find(item => item.id === 'le-compteur-linky').next, 'F-106');
  assert.equal(device.answers.find(item => item.id === 'le-disjoncteur-de-branchement').next, 'F-085');
});

test('le contrôle de calibre reprend l’abaque du Forms et mène au conseil fournisseur si nécessaire', async () => {
  const nodes = await loadSchneiderNodes();
  const calibration = nodes.find(node => node.id === 'F-085');
  assert.match(calibration.body, /9 kVA.*45 A/s);
  assert.match(calibration.body, /12 kVA.*60 A/s);
  assert.match(calibration.body, /15 kVA.*25 A/s);
  assert.match(calibration.body, /18 kVA.*30 A/s);
  assert.match(calibration.body, /24 kVA.*40 A/s);
  assert.match(calibration.body, /36 kVA.*60 A/s);
  assert.equal(calibration.answers.find(item => item.id === 'oui').next, 'F-106');
  assert.equal(calibration.answers.find(item => item.id === 'non').next, 'F-086');
  const supplier = nodes.find(node => node.id === 'F-086');
  assert.match(supplier.body, /fournisseur d'énergie/);
  assert.equal(supplier.answers[0].next, 'F-106');
});
