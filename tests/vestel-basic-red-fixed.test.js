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
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(content)
      };
    } catch {
      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    }
  };

  try {
    return await loadData(new URL('../data/', import.meta.url));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('Vestel BASIC LED rouge fixe commence par un redémarrage de 5 minutes', async () => {
  const data = await loadLocalData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const red = basic.answers.find(answer => answer.id === 'led-rouge');

  assert.equal(red.next, 'VESTEL-BASIC-RED-RESET');

  const reset = data.nodes.find(node => node.id === 'VESTEL-BASIC-RED-RESET');
  assert.ok(reset);
  assert.match(reset.body, /disjoncteur/i);
  assert.match(reset.body, /5\s*min/i);
  assert.equal(reset.validation, 'valide');
});

test('Vestel BASIC LED rouge fixe qualifie le résultat après redémarrage', async () => {
  const data = await loadLocalData();
  const afterReset = data.nodes.find(node => node.id === 'VESTEL-BASIC-RED-AFTER-RESET');
  assert.ok(afterReset);
  assert.deepEqual(afterReset.answers.map(answer => answer.id), ['normal', 'red']);

  const normal = afterReset.answers.find(answer => answer.id === 'normal');
  const red = afterReset.answers.find(answer => answer.id === 'red');
  assert.equal(normal.next, 'VESTEL-BASIC-RED-CHARGE-TEST');
  assert.equal(red.next, 'VESTEL-BASIC-RED-VE-CONTEXT');

  const chargeTest = data.nodes.find(node => node.id === 'VESTEL-BASIC-RED-CHARGE-TEST');
  assert.ok(chargeTest);
  assert.equal(chargeTest.answers.find(answer => answer.id === 'charge-ok').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(chargeTest.answers.find(answer => answer.id === 'charge-ko').next, 'FINAL-NOTE-END-TRANSFER');

  const context = data.nodes.find(node => node.id === 'VESTEL-BASIC-RED-VE-CONTEXT');
  assert.ok(context);
  assert.match(context.title, /avec ou sans.*véhicule/i);
  assert.deepEqual(context.answers.map(answer => answer.id), ['with-vehicle', 'without-vehicle', 'both']);
  for (const answer of context.answers) {
    assert.equal(answer.next, 'FINAL-NOTE-END-TRANSFER');
  }
});
