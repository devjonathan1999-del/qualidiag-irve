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

test('Vestel BASIC Charge faible commence par vérifier que le câble T2 est bien en 32 A', async () => {
  const data = await loadLocalData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const symptom = basic.answers.find(answer => answer.id === 'charge-faible');

  assert.equal(symptom.next, 'VESTEL-BASIC-LOW-CABLE');

  const cable = data.nodes.find(node => node.id === 'VESTEL-BASIC-LOW-CABLE');
  assert.ok(cable);
  assert.match(cable.title, /câble T2.*32 A/i);
  assert.equal(cable.answers.find(answer => answer.id === 'no').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(cable.answers.find(answer => answer.id === 'yes').next, 'VESTEL-BASIC-LOW-VEHICLE');
});

test('après confirmation du câble 32 A, QualiDiag vérifie une limitation côté véhicule', async () => {
  const data = await loadLocalData();
  const vehicle = data.nodes.find(node => node.id === 'VESTEL-BASIC-LOW-VEHICLE');

  assert.ok(vehicle);
  assert.match(vehicle.body, /limitation.*véhicule/i);
  assert.equal(vehicle.answers.find(answer => answer.id === 'limited').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(vehicle.answers.find(answer => answer.id === 'not-limited').next, 'VESTEL-BASIC-LOW-BEHAVIOR');
});

test('la puissance fixe mène au Service Technique et la puissance variable poursuit le diagnostic', async () => {
  const data = await loadLocalData();
  const behavior = data.nodes.find(node => node.id === 'VESTEL-BASIC-LOW-BEHAVIOR');

  assert.ok(behavior);
  assert.match(behavior.title, /fixe ou variable/i);
  assert.match(behavior.answers.find(answer => answer.id === 'fixed').label, /4,5 kW/i);
  assert.match(behavior.answers.find(answer => answer.id === 'variable').label, /7,4 kW.*5 kW/i);
  assert.equal(behavior.answers.find(answer => answer.id === 'fixed').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(behavior.answers.find(answer => answer.id === 'variable').next, 'VESTEL-BASIC-LOW-REDUCE-LOAD');
});

test('si la puissance est variable, la baisse temporaire de consommation confirme ou non la gestion dynamique', async () => {
  const data = await loadLocalData();
  const reduce = data.nodes.find(node => node.id === 'VESTEL-BASIC-LOW-REDUCE-LOAD');
  const result = data.nodes.find(node => node.id === 'VESTEL-BASIC-LOW-RESULT');

  assert.ok(reduce);
  assert.match(reduce.body, /réduire temporairement les gros consommateurs/i);
  assert.equal(reduce.answers.find(answer => answer.id === 'continue').next, 'VESTEL-BASIC-LOW-RESULT');

  assert.ok(result);
  assert.equal(result.answers.find(answer => answer.id === 'power-rises').next, 'FINAL-NOTE-END-RESOLVED');
  assert.match(result.answers.find(answer => answer.id === 'power-rises').check, /gestion dynamique/i);
  assert.equal(result.answers.find(answer => answer.id === 'still-low').next, 'FINAL-NOTE-END-TRANSFER');
});
