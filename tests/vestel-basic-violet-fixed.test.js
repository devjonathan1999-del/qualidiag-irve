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

test('Vestel BASIC violet fixe commence par réduire temporairement les gros consommateurs', async () => {
  const data = await loadLocalData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const violet = basic.answers.find(answer => answer.id === 'led-violet-fixe');

  assert.equal(violet.next, 'VESTEL-BASIC-VIOLET-REDUCE-LOAD');

  const reduce = data.nodes.find(node => node.id === 'VESTEL-BASIC-VIOLET-REDUCE-LOAD');
  assert.ok(reduce);
  assert.match(reduce.body, /réduire|couper/i);
  assert.match(reduce.body, /consomm/i);
  assert.equal(reduce.validation, 'valide');
});

test('Vestel BASIC violet fixe se résout si la charge démarre sinon qualifie le contexte VE puis transfère', async () => {
  const data = await loadLocalData();
  const result = data.nodes.find(node => node.id === 'VESTEL-BASIC-VIOLET-RESULT');
  assert.ok(result);
  assert.deepEqual(result.answers.map(answer => answer.id), ['charging', 'still-violet']);
  assert.equal(result.answers.find(answer => answer.id === 'charging').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(result.answers.find(answer => answer.id === 'still-violet').next, 'VESTEL-BASIC-VIOLET-VE-CONTEXT');

  const context = data.nodes.find(node => node.id === 'VESTEL-BASIC-VIOLET-VE-CONTEXT');
  assert.ok(context);
  assert.match(context.title, /avec ou sans.*véhicule/i);
  assert.deepEqual(context.answers.map(answer => answer.id), ['with-vehicle', 'without-vehicle', 'both']);
  for (const answer of context.answers) {
    assert.equal(answer.next, 'FINAL-NOTE-END-TRANSFER');
  }
});
