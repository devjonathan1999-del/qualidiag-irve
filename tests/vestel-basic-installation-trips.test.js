import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';

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

test('Vestel BASIC Installation disjoncte propose exactement Linky, disjoncteur de branchement et disjoncteur de la borne', async () => {
  const data = await loadLocalData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const symptom = basic.answers.find(answer => answer.id === 'installation-disjoncte');

  assert.equal(symptom.next, 'VESTEL-BASIC-TRIP-DEVICE');

  const device = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-DEVICE');
  assert.ok(device);
  assert.deepEqual(device.answers.map(answer => answer.id), ['linky', 'main-breaker', 'charger-breaker']);
  assert.deepEqual(device.answers.map(answer => answer.label), ['Compteur Linky', 'Disjoncteur de branchement', 'Disjoncteur de la borne']);
});

test('si le Linky coupe, le dossier est transmis directement au Service Technique', async () => {
  const data = await loadLocalData();
  const device = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-DEVICE');
  const linky = device.answers.find(answer => answer.id === 'linky');

  assert.equal(linky.next, 'FINAL-NOTE-END-TRANSFER');
  assert.match(linky.check, /gestion dynamique/i);
});

test('le disjoncteur de branchement contrôle le calibre selon phase et abonnement', async () => {
  const data = await loadLocalData();
  const device = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-DEVICE');
  assert.equal(device.answers.find(answer => answer.id === 'main-breaker').next, 'VESTEL-BASIC-TRIP-MAIN-CALIBRATION');

  const calibration = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-MAIN-CALIBRATION');
  assert.ok(calibration);
  assert.deepEqual(calibration.bodyByContext.keys, ['installation.phase', 'installation.power']);
  assert.equal(calibration.bodyByContext.values['Monophasée|9 kVA'], 'Abonnement 9 kVA monophasé : calibre attendu 45 A.');
  assert.equal(calibration.bodyByContext.values['Monophasée|12 kVA'], 'Abonnement 12 kVA monophasé : calibre attendu 60 A.');
  assert.equal(calibration.bodyByContext.values['Triphasée|36 kVA'], 'Abonnement 36 kVA triphasé : calibre attendu 60 A.');
  assert.equal(calibration.answers.find(answer => answer.id === 'correct').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(calibration.answers.find(answer => answer.id === 'too-low').next, 'FINAL-NOTE-END-ENERGY-SUPPLIER');
});

test('le disjoncteur de la borne est réarmé une seule fois avant essai de charge', async () => {
  const data = await loadLocalData();
  const device = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-DEVICE');
  assert.equal(device.answers.find(answer => answer.id === 'charger-breaker').next, 'VESTEL-BASIC-TRIP-CHARGER-REARM');

  const rearm = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-CHARGER-REARM');
  assert.ok(rearm);
  assert.match(rearm.body, /une seule fois/i);
  assert.equal(rearm.answers.find(answer => answer.id === 'holds').next, 'VESTEL-BASIC-TRIP-CHARGER-TEST');
  assert.equal(rearm.answers.find(answer => answer.id === 'drops-immediately').next, 'FINAL-NOTE-END-TRANSFER');

  const chargeTest = data.nodes.find(node => node.id === 'VESTEL-BASIC-TRIP-CHARGER-TEST');
  assert.ok(chargeTest);
  assert.equal(chargeTest.answers.find(answer => answer.id === 'charge-ok').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(chargeTest.answers.find(answer => answer.id === 'drops-during-charge').next, 'FINAL-NOTE-END-TRANSFER');
});
