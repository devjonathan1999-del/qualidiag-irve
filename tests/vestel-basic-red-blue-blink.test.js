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

test('Vestel BASIC rouge et bleu clignotant commence par un essai au badge RFID utilisateur', async () => {
  const data = await loadLocalData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const symptom = basic.answers.find(answer => answer.id === 'led-clignote-rouge-et-bleu');

  assert.equal(symptom.next, 'VESTEL-BASIC-RB-BADGE-TEST');

  const badge = data.nodes.find(node => node.id === 'VESTEL-BASIC-RB-BADGE-TEST');
  assert.ok(badge);
  assert.match(badge.body, /heure[s]? creuse/i);
  assert.match(badge.body, /badge RFID utilisateur/i);
  assert.match(badge.body, /Master/i);
  assert.equal(badge.validation, 'valide');
  assert.equal(badge.answers.find(answer => answer.id === 'charging').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(badge.answers.find(answer => answer.id === 'not-charging').next, 'VESTEL-BASIC-RB-VE-SCHEDULE');
});

test('Vestel BASIC rouge et bleu clignotant contrôle la planification véhicule avant transfert', async () => {
  const data = await loadLocalData();
  const schedule = data.nodes.find(node => node.id === 'VESTEL-BASIC-RB-VE-SCHEDULE');
  assert.ok(schedule);
  assert.deepEqual(schedule.answers.map(answer => answer.id), ['active', 'none']);
  assert.equal(schedule.answers.find(answer => answer.id === 'active').next, 'VESTEL-BASIC-RB-DISABLE-SCHEDULE');
  assert.equal(schedule.answers.find(answer => answer.id === 'none').next, 'VESTEL-BASIC-RB-CONTRACT-CHANGE');

  const disable = data.nodes.find(node => node.id === 'VESTEL-BASIC-RB-DISABLE-SCHEDULE');
  assert.ok(disable);
  assert.match(disable.body, /désactiv/i);
  assert.equal(disable.answers[0].next, 'VESTEL-BASIC-RB-RETRY');

  const retry = data.nodes.find(node => node.id === 'VESTEL-BASIC-RB-RETRY');
  assert.ok(retry);
  assert.equal(retry.answers.find(answer => answer.id === 'charging').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(retry.answers.find(answer => answer.id === 'not-charging').next, 'VESTEL-BASIC-RB-CONTRACT-CHANGE');
});

test('Vestel BASIC rouge et bleu clignotant collecte un changement récent de contrat ou puissance puis transmet', async () => {
  const data = await loadLocalData();
  const change = data.nodes.find(node => node.id === 'VESTEL-BASIC-RB-CONTRACT-CHANGE');
  assert.ok(change);
  assert.match(change.title, /contrat|puissance/i);
  assert.deepEqual(change.answers.map(answer => answer.id), ['yes', 'no']);
  for (const answer of change.answers) {
    assert.equal(answer.next, 'FINAL-NOTE-END-TRANSFER');
  }
});
