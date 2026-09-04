import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';
import { toViewModel } from '../app/presenter.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('Schneider Installation disjoncte reste sur un choix simple Linky ou AGCP', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const device = effective.find(node => node.id === 'F-084');

  assert.equal(device.title, 'Quel appareil déclenche ?');
  assert.deepEqual(device.answers.map(answer => answer.label), ['Compteur Linky', 'AGCP']);
  assert.equal(device.answers[0].next, 'END-TRANSFER');
  assert.equal(device.answers[1].next, 'F-085');
  assert.equal(device.validation, 'valide');
});

test('le contrôle AGCP mène directement au Service Technique ou au fournisseur d’énergie', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const calibration = effective.find(node => node.id === 'F-085');

  assert.equal(calibration.answers.find(answer => answer.id === 'oui').next, 'END-TRANSFER');
  assert.equal(calibration.answers.find(answer => answer.id === 'non').next, 'END-ENERGY-SUPPLIER');
  assert.equal(calibration.validation, 'valide');
});

test('le calibre attendu est affiché selon phase et abonnement déjà renseignés', async () => {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  const effective = applySchneiderChargePolicy(nodes, policy);
  const calibration = effective.find(node => node.id === 'F-085');

  const mono6 = toViewModel(calibration, {
    context: { 'installation.phase': 'Monophasée', 'installation.power': '6 kVA' },
    history: []
  }, {});
  assert.match(mono6.body, /30 A/);

  const mono12 = toViewModel(calibration, {
    context: { 'installation.phase': 'Monophasée', 'installation.power': '12 kVA' },
    history: []
  }, {});
  assert.match(mono12.body, /60 A/);

  const tri12 = toViewModel(calibration, {
    context: { 'installation.phase': 'Triphasée', 'installation.power': '12 kVA' },
    history: []
  }, {});
  assert.match(tri12.body, /20 A/);

  const tri30 = toViewModel(calibration, {
    context: { 'installation.phase': 'Triphasée', 'installation.power': '30 kVA' },
    history: []
  }, {});
  assert.match(tri30.body, /50 A/);
});
