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

test('Vestel BASIC offpeak uses validated route', async () => {
  const data = await localData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const answer = basic.answers.find(item => item.id === 'ma-charge-ne-se-lance-pas-pendant-mes-heur');
  assert.equal(answer.next, 'VESTEL-BASIC-OFFPEAK-VE-SCHEDULE');
});
