import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';
import { toViewModel } from '../app/presenter.js';
import { buildSalesforceSummary } from '../app/summary.js';

const REMINDER = 'Pour la prise en charge, joindre une photo lisible du disjoncteur de branchement, avec le calibre clairement visible.';

async function loadLocalData() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = input instanceof URL ? input : new URL(input);
    try {
      const content = await readFile(url, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(content) };
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
  };

  try {
    return await loadData(new URL('../data/', import.meta.url));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function agcpCalibrationNodes(data) {
  return data.nodes.filter(node => {
    const title = node.title ?? '';
    return /(AGCP|disjoncteur de branchement)/i.test(title) && /calibr/i.test(title);
  });
}

test('chaque question de calibre AGCP ou disjoncteur de branchement exige la même photo lisible', async () => {
  const data = await loadLocalData();
  const nodes = agcpCalibrationNodes(data);

  assert.ok(nodes.length >= 3, 'les contrôles BASIC, Smartcharge et Schneider doivent être couverts');
  assert.ok(nodes.some(node => node.id === 'VESTEL-BASIC-TRIP-MAIN-CALIBRATION'));
  assert.ok(nodes.some(node => node.id === 'VESTEL-SMARTCHARGE-TRIP-MAIN-CALIBRATION'));
  assert.ok(nodes.some(node => node.id === 'F-085'));

  for (const node of nodes) {
    assert.equal(node.alert, REMINDER, `${node.id} doit afficher l’alerte photo`);
    for (const answer of node.answers ?? []) {
      assert.equal(answer.set?.['attachments.mainBreakerPhoto'], REMINDER, `${node.id}/${answer.id} doit conserver le rappel pour Salesforce`);
    }
  }
});

test('le presenter expose l’alerte et l’UI la rend dans un bloc dédié', async () => {
  const data = await loadLocalData();
  const calibration = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-MAIN-CALIBRATION');
  const vm = toViewModel(calibration, {
    context: {
      brand: 'Vestel IZI by EDF',
      model: 'BASIC non connectée Izi by EDF',
      symptom: 'Installation disjoncte',
      'installation.phase': 'Monophasée',
      'installation.power': '9 kVA'
    },
    history: [{ nodeId: 'VESTEL-BASIC-TRIP-DEVICE' }]
  }, data);

  assert.equal(vm.alert, REMINDER);

  const ui = await readFile(new URL('../app/ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');
  assert.match(ui, /viewModel\.alert/);
  assert.match(ui, /alert-panel/);
  assert.match(css, /\.alert-panel\s*\{/);
});

test('le résumé Salesforce rappelle la photo uniquement après un contrôle de calibre AGCP', () => {
  const withPhoto = buildSalesforceSummary({
    context: { 'attachments.mainBreakerPhoto': REMINDER },
    checks: []
  }, { title: 'Transmission Service Technique' });

  const withoutPhoto = buildSalesforceSummary({ context: {}, checks: [] }, { title: 'Transmission Service Technique' });

  assert.match(withPhoto, /photo lisible du disjoncteur de branchement/);
  assert.doesNotMatch(withoutPhoto, /photo lisible du disjoncteur de branchement/);
});
