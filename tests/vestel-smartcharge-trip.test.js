import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';

async function localData() {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = input instanceof URL ? input : new URL(input);
    try {
      const content = await readFile(url, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(content) };
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
  };
  try { return await loadData(new URL('../data/', import.meta.url)); }
  finally { globalThis.fetch = oldFetch; }
}

test('Vestel Smartcharge Installation disjoncte propose Linky, disjoncteur de branchement et disjoncteur de la borne', async () => {
  const data = await localData();
  const smartcharge = data.nodes.find(node => node.id === 'F-012');
  const trip = smartcharge.answers.find(answer => answer.id === 'installation-disjoncte');
  assert.equal(trip.next, 'VESTEL-SMARTCHARGE-TRIP-DEVICE');

  const device = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-TRIP-DEVICE');
  assert.ok(device);
  assert.deepEqual(device.answers.map(answer => answer.id), ['linky', 'main-breaker', 'charger-breaker']);
  assert.equal(device.answers.find(answer => answer.id === 'linky').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(device.answers.find(answer => answer.id === 'main-breaker').next, 'VESTEL-SMARTCHARGE-TRIP-MAIN-CALIBRATION');
  assert.equal(device.answers.find(answer => answer.id === 'charger-breaker').next, 'VESTEL-SMARTCHARGE-TRIP-CHARGER-REARM');
});

test('le disjoncteur de branchement contrôle le calibre puis oriente selon le résultat', async () => {
  const data = await localData();
  const calibration = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-TRIP-MAIN-CALIBRATION');
  assert.ok(calibration);
  assert.equal(calibration.bodyByContext.values['Monophasée|9 kVA'], 'Abonnement 9 kVA monophasé : calibre attendu 45 A.');
  assert.equal(calibration.bodyByContext.values['Triphasée|18 kVA'], 'Abonnement 18 kVA triphasé : calibre attendu 30 A.');
  assert.equal(calibration.answers.find(answer => answer.id === 'correct').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(calibration.answers.find(answer => answer.id === 'incorrect').next, 'FINAL-NOTE-END-ENERGY-SUPPLIER');
});

test('le disjoncteur de la borne est réarmé une seule fois puis un essai de charge décide de la suite', async () => {
  const data = await localData();
  const rearm = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-TRIP-CHARGER-REARM');
  assert.ok(rearm);
  assert.match(rearm.body, /une seule fois/i);
  assert.equal(rearm.answers.find(answer => answer.id === 'holds').next, 'VESTEL-SMARTCHARGE-TRIP-CHARGER-TEST');
  assert.equal(rearm.answers.find(answer => answer.id === 'drops-immediately').next, 'FINAL-NOTE-END-TRANSFER');

  const retry = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-TRIP-CHARGER-TEST');
  assert.ok(retry);
  assert.equal(retry.answers.find(answer => answer.id === 'charge-ok').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(retry.answers.find(answer => answer.id === 'drops-during-charge').next, 'FINAL-NOTE-END-TRANSFER');
});
