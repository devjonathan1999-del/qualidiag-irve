import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';
import { toViewModel } from '../app/presenter.js';
import { buildSalesforceSummary } from '../app/summary.js';

const REMINDER = 'Alerte : pour la prise en charge, joindre une photo lisible du disjoncteur de branchement, avec le calibre clairement visible.';

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

test('Vestel BASIC demande une photo lisible sur le contrôle du disjoncteur de branchement', async () => {
  const data = await loadLocalData();
  const device = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-DEVICE');
  const mainBreaker = device.answers.find(answer => answer.id === 'main-breaker');
  const calibration = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-MAIN-CALIBRATION');

  assert.equal(mainBreaker.set['attachments.mainBreakerPhoto'], REMINDER);
  assert.equal(calibration.alert, REMINDER);
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

test('le résumé Salesforce rappelle la photo uniquement lorsque la branche AGCP a été parcourue', () => {
  const withPhoto = buildSalesforceSummary({
    context: { 'attachments.mainBreakerPhoto': REMINDER },
    checks: []
  }, { title: 'Transmission Service Technique' });

  const withoutPhoto = buildSalesforceSummary({ context: {}, checks: [] }, { title: 'Transmission Service Technique' });

  assert.match(withPhoto, /photo lisible du disjoncteur de branchement/);
  assert.doesNotMatch(withoutPhoto, /photo lisible du disjoncteur de branchement/);
});
