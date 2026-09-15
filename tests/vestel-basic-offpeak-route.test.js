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

test('Vestel BASIC offpeak checks vehicle schedule before contract change', async () => {
  const data = await localData();
  const schedule = data.nodes.find(node => node.id === 'VESTEL-BASIC-OFFPEAK-VE-SCHEDULE');
  assert.ok(schedule);
  assert.match(schedule.body, /TIC/i);
  assert.match(schedule.body, /programmation.*véhicule/i);
  assert.equal(schedule.answers.find(answer => answer.id === 'active').next, 'VESTEL-BASIC-OFFPEAK-DISABLE-SCHEDULE');
  assert.equal(schedule.answers.find(answer => answer.id === 'none').next, 'VESTEL-BASIC-OFFPEAK-CONTRACT-CHANGE');
});

test('active vehicle schedule is disabled temporarily and retested in offpeak hours', async () => {
  const data = await localData();
  const disable = data.nodes.find(node => node.id === 'VESTEL-BASIC-OFFPEAK-DISABLE-SCHEDULE');
  const retry = data.nodes.find(node => node.id === 'VESTEL-BASIC-OFFPEAK-RETRY');
  assert.ok(disable);
  assert.match(disable.body, /désactiver temporairement/i);
  assert.match(disable.body, /heures creuses/i);
  assert.equal(disable.answers.find(answer => answer.id === 'continue').next, 'VESTEL-BASIC-OFFPEAK-RETRY');
  assert.ok(retry);
  assert.equal(retry.answers.find(answer => answer.id === 'charging').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(retry.answers.find(answer => answer.id === 'not-charging').next, 'VESTEL-BASIC-OFFPEAK-CONTRACT-CHANGE');
});

test('specific contracts are flagged as possible launch issues before technical transfer', async () => {
  const data = await localData();
  const contract = data.nodes.find(node => node.id === 'VESTEL-BASIC-OFFPEAK-CONTRACT-CHANGE');
  assert.ok(contract);
  assert.match(contract.body, /TEMPO/i);
  assert.match(contract.body, /Super Heures Creuses/i);
  assert.match(contract.body, /Zen Flex/i);
  assert.match(contract.body, /lancement de la charge/i);
  assert.equal(contract.answers.find(answer => answer.id === 'yes').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(contract.answers.find(answer => answer.id === 'no').next, 'FINAL-NOTE-END-TRANSFER');
});
