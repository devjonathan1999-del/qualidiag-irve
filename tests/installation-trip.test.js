import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadNodes() {
  return JSON.parse(await readFile(new URL('../data/diagnostics.json', import.meta.url), 'utf8'));
}

test('Schneider Charge propose le symptôme Installation disjoncte', async () => {
  const nodes = await loadNodes();
  const symptom = nodes.find(node => node.id === 'Q-SYMPTOM');
  const answer = symptom.answers.find(item => item.id === 'installation-trip');
  assert.equal(answer.label, 'Installation disjoncte');
  assert.equal(answer.next, 'COMMON-INSTALLATION-TRIP-DEVICE');
});

test('le diagnostic commun distingue Linky et AGCP', async () => {
  const nodes = await loadNodes();
  const device = nodes.find(node => node.id === 'COMMON-INSTALLATION-TRIP-DEVICE');
  assert.deepEqual(device.answers.map(item => item.id), ['linky', 'agcp']);
  assert.equal(device.answers.find(item => item.id === 'linky').next, 'END-TRANSFER');
  assert.equal(device.answers.find(item => item.id === 'agcp').next, 'COMMON-INSTALLATION-TRIP-AGCP');
});

test('le contrôle AGCP contient les calibres attendus et oriente vers le fournisseur si incohérent', async () => {
  const nodes = await loadNodes();
  const agcp = nodes.find(node => node.id === 'COMMON-INSTALLATION-TRIP-AGCP');
  assert.equal(agcp.bodyByContext.values['9 kVA'], 'Calibre attendu : 45 A');
  assert.equal(agcp.bodyByContext.values['12 kVA'], 'Calibre attendu : 60 A');
  assert.equal(agcp.bodyByContext.values['15 kVA'], 'Calibre attendu : 25 A');
  assert.equal(agcp.bodyByContext.values['18 kVA'], 'Calibre attendu : 30 A');
  assert.equal(agcp.bodyByContext.values['24 kVA'], 'Calibre attendu : 40 A');
  assert.equal(agcp.bodyByContext.values['36 kVA'], 'Calibre attendu : 60 A');
  assert.equal(agcp.answers.find(item => item.id === 'yes').next, 'END-TRANSFER');
  assert.equal(agcp.answers.find(item => item.id === 'no').next, 'END-ENERGY-SUPPLIER');
});
