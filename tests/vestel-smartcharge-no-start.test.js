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

test('Vestel Smartcharge Ma charge ne se lance pas commence par la programmation côté véhicule', async () => {
  const data = await loadLocalData();
  const smartcharge = data.nodes.find(node => node.id === 'F-012');
  const symptom = smartcharge.answers.find(answer => answer.id === 'ma-charge-ne-se-lance-pas');

  assert.equal(symptom.next, 'VESTEL-SMARTCHARGE-NOSTART-VEHICLE-SCHEDULE');

  const vehicleSchedule = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-NOSTART-VEHICLE-SCHEDULE');
  assert.ok(vehicleSchedule);
  assert.match(vehicleSchedule.title, /programmation.*véhicule/i);
  assert.match(vehicleSchedule.body, /TIC/i);
  assert.equal(vehicleSchedule.answers.find(answer => answer.id === 'yes').next, 'VESTEL-SMARTCHARGE-NOSTART-DISABLE-VEHICLE-SCHEDULE');
  assert.equal(vehicleSchedule.answers.find(answer => answer.id === 'no').next, 'VESTEL-SMARTCHARGE-NOSTART-CONTRACT-CHANGE');
});

test('si une programmation véhicule est active, QualiDiag demande de la désactiver puis de refaire un essai', async () => {
  const data = await loadLocalData();
  const disable = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-NOSTART-DISABLE-VEHICLE-SCHEDULE');
  const result = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-NOSTART-VEHICLE-SCHEDULE-RESULT');

  assert.ok(disable);
  assert.match(disable.body, /désactiver.*temporairement/i);
  assert.match(disable.body, /essai/i);
  assert.equal(disable.answers.find(answer => answer.id === 'continue').next, 'VESTEL-SMARTCHARGE-NOSTART-VEHICLE-SCHEDULE-RESULT');

  assert.ok(result);
  assert.equal(result.answers.find(answer => answer.id === 'starts').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(result.answers.find(answer => answer.id === 'still-ko').next, 'VESTEL-SMARTCHARGE-NOSTART-CONTRACT-CHANGE');
});

test('le parcours collecte un changement de contrat ou de puissance puis transfère au Service Technique', async () => {
  const data = await loadLocalData();
  const contractChange = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-NOSTART-CONTRACT-CHANGE');

  assert.ok(contractChange);
  assert.match(contractChange.title, /changé.*contrat|changé.*puissance|changement.*contrat|changement.*puissance/i);
  assert.match(contractChange.alert, /contrats? spécifiques/i);
  assert.match(contractChange.alert, /problèmes? de lancement de la charge/i);
  assert.equal(contractChange.answers.find(answer => answer.id === 'yes').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(contractChange.answers.find(answer => answer.id === 'no').next, 'FINAL-NOTE-END-TRANSFER');
  assert.match(contractChange.answers.find(answer => answer.id === 'yes').check, /changement.*contrat|changement.*puissance/i);
});
