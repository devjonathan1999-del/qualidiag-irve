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

test('Vestel BASIC RFID propose les trois besoins valides', async () => {
  const data = await localData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const symptom = basic.answers.find(answer => answer.id === 'badge-rfid');
  assert.equal(symptom.next, 'VESTEL-BASIC-RFID-MENU');

  const menu = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-MENU');
  assert.ok(menu);
  assert.equal(menu.answers.length, 3);
  assert.equal(menu.answers.find(answer => answer.id === 'register').next, 'VESTEL-BASIC-RFID-REGISTER');
  assert.equal(menu.answers.find(answer => answer.id === 'remove').next, 'VESTEL-BASIC-RFID-REMOVE');
  assert.equal(menu.answers.find(answer => answer.id === 'reader').next, 'VESTEL-BASIC-RFID-READER-TEST');
});

test('enregistrement et retrait utilisent la carte Master puis le badge utilisateur sous 10 secondes', async () => {
  const data = await localData();
  const register = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-REGISTER');
  const remove = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-REMOVE');

  assert.ok(register);
  assert.match(register.body, /carte (RFID )?Master/i);
  assert.match(register.body, /10 secondes/i);
  assert.match(register.body, /voyant vert/i);
  assert.match(register.body, /une seule carte/i);
  assert.equal(register.answers.find(answer => answer.id === 'success').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(register.answers.find(answer => answer.id === 'failure').next, 'VESTEL-BASIC-RFID-READER-TEST');

  assert.ok(remove);
  assert.match(remove.body, /carte (RFID )?Master/i);
  assert.match(remove.body, /10 secondes/i);
  assert.match(remove.body, /voyant rouge/i);
  assert.match(remove.body, /une seule carte/i);
  assert.equal(remove.answers.find(answer => answer.id === 'success').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(remove.answers.find(answer => answer.id === 'failure').next, 'VESTEL-BASIC-RFID-READER-TEST');
});

test('le diagnostic lecteur utilise la carte Master comme test de référence', async () => {
  const data = await localData();
  const reader = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-READER-TEST');
  assert.ok(reader);
  assert.match(reader.body, /carte (RFID )?Master/i);
  assert.match(reader.body, /BIP|voyant/i);
  assert.equal(reader.answers.find(answer => answer.id === 'reacts').next, 'VESTEL-BASIC-RFID-REPAIR-USER-BADGE');
  assert.equal(reader.answers.find(answer => answer.id === 'no-reaction').next, 'VESTEL-BASIC-RFID-SECOND-BADGE');
});

test('si le lecteur ne réagit à aucun badge le dossier est transféré au Service Technique', async () => {
  const data = await localData();
  const second = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-SECOND-BADGE');
  const secondResult = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-SECOND-BADGE-RESULT');
  assert.ok(second);
  assert.equal(second.answers.find(answer => answer.id === 'available').next, 'VESTEL-BASIC-RFID-SECOND-BADGE-RESULT');
  assert.equal(second.answers.find(answer => answer.id === 'unavailable').next, 'FINAL-NOTE-END-TRANSFER');
  assert.ok(secondResult);
  assert.equal(secondResult.answers.find(answer => answer.id === 'reacts').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(secondResult.answers.find(answer => answer.id === 'no-reaction').next, 'FINAL-NOTE-END-TRANSFER');
});

test('si la carte Master réagit, QualiDiag propose de réenregistrer le badge utilisateur', async () => {
  const data = await localData();
  const repair = data.nodes.find(node => node.id === 'VESTEL-BASIC-RFID-REPAIR-USER-BADGE');
  assert.ok(repair);
  assert.match(repair.body, /réenregistr/i);
  assert.equal(repair.answers.find(answer => answer.id === 'success').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(repair.answers.find(answer => answer.id === 'failure').next, 'FINAL-NOTE-END-TRANSFER');
});
