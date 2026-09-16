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

test('Vestel Smartcharge violet fixe indique une attente puis vérifie le programme de charge', async () => {
  const data = await localData();
  const smartcharge = data.nodes.find(node => node.id === 'F-012');
  const violet = smartcharge.answers.find(answer => answer.id === 'led-violet-fixe');
  assert.equal(violet.next, 'VESTEL-SMARTCHARGE-VIOLET-PROGRAM');

  const program = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-VIOLET-PROGRAM');
  assert.ok(program);
  assert.match(program.body, /violet fixe.*attente/i);
  assert.equal(program.answers.find(answer => answer.id === 'yes').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(program.answers.find(answer => answer.id === 'no').next, 'VESTEL-SMARTCHARGE-PROGRAM-GUIDE');
});

test('sans programme, QualiDiag explique la création puis conclut résolu', async () => {
  const data = await localData();
  const guide = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-PROGRAM-GUIDE');
  assert.ok(guide);
  assert.match(guide.body, /application IZI by EDF/i);
  assert.match(guide.body, /Programmes/i);
  assert.match(guide.body, /créer/i);
  assert.equal(guide.answers.find(answer => answer.id === 'continue').next, 'FINAL-NOTE-END-RESOLVED');
});
