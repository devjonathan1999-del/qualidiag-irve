import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';
import { buildSalesforceSummary } from '../app/summary.js';

const PHOTO_ALERT = 'Pour confirmer que le câble est bien en 32 A, demander au client une photo lisible du câble ou de son marquage.';
const PHOTO_SUMMARY = 'Photo du câble T2 / marquage 32 A demandée pour confirmation.';

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

test('Vestel Smartcharge Charge faible commence par le contrôle du câble T2 32 A', async () => {
  const data = await loadLocalData();
  const smartcharge = data.nodes.find(node => node.id === 'F-012');
  const symptom = smartcharge.answers.find(answer => answer.id === 'charge-faible');

  assert.equal(symptom.next, 'VESTEL-SMARTCHARGE-LOW-CABLE');

  const cable = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-LOW-CABLE');
  assert.ok(cable);
  assert.match(cable.title, /câble T2.*32 A/i);
  assert.equal(cable.answers.find(answer => answer.id === 'no').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(cable.answers.find(answer => answer.id === 'yes').next, 'VESTEL-SMARTCHARGE-LOW-VEHICLE');
});

test('chaque contrôle Vestel du câble 32 A affiche la demande de photo en alerte et la conserve pour Salesforce', async () => {
  const data = await loadLocalData();
  for (const id of ['VESTEL-BASIC-LOW-CABLE', 'VESTEL-SMARTCHARGE-LOW-CABLE']) {
    const cable = data.nodes.find(node => node.id === id);
    assert.ok(cable, `${id} doit exister`);
    assert.equal(cable.alert, PHOTO_ALERT);
    for (const answer of cable.answers ?? []) {
      assert.equal(answer.set?.['attachments.t2CablePhoto'], PHOTO_SUMMARY);
    }
  }
});

test('Smartcharge vérifie ensuite la limitation véhicule puis le caractère fixe ou variable de la puissance', async () => {
  const data = await loadLocalData();
  const vehicle = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-LOW-VEHICLE');
  const behavior = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-LOW-BEHAVIOR');

  assert.ok(vehicle);
  assert.match(vehicle.body, /limitation.*véhicule/i);
  assert.equal(vehicle.answers.find(answer => answer.id === 'limited').next, 'FINAL-NOTE-END-RESOLVED');
  assert.equal(vehicle.answers.find(answer => answer.id === 'not-limited').next, 'VESTEL-SMARTCHARGE-LOW-BEHAVIOR');

  assert.ok(behavior);
  assert.match(behavior.title, /fixe ou variable/i);
  assert.equal(behavior.answers.find(answer => answer.id === 'fixed').next, 'FINAL-NOTE-END-TRANSFER');
  assert.equal(behavior.answers.find(answer => answer.id === 'variable').next, 'VESTEL-SMARTCHARGE-LOW-REDUCE-LOAD');
});

test('Smartcharge variable demande de réduire la consommation puis résout ou transfère selon le résultat', async () => {
  const data = await loadLocalData();
  const reduce = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-LOW-REDUCE-LOAD');
  const result = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-LOW-RESULT');

  assert.ok(reduce);
  assert.match(reduce.body, /réduire temporairement les gros consommateurs/i);
  assert.equal(reduce.answers.find(answer => answer.id === 'continue').next, 'VESTEL-SMARTCHARGE-LOW-RESULT');

  assert.ok(result);
  assert.equal(result.answers.find(answer => answer.id === 'power-rises').next, 'FINAL-NOTE-END-RESOLVED');
  assert.match(result.answers.find(answer => answer.id === 'power-rises').check, /gestion dynamique/i);
  assert.equal(result.answers.find(answer => answer.id === 'still-low').next, 'FINAL-NOTE-END-TRANSFER');
});

test('le résumé Salesforce reprend la demande de photo câble uniquement lorsque ce contrôle a été parcouru', () => {
  const withPhoto = buildSalesforceSummary({
    context: { 'attachments.t2CablePhoto': PHOTO_SUMMARY },
    checks: []
  }, { title: 'Transmission Service Technique' });
  const withoutPhoto = buildSalesforceSummary({ context: {}, checks: [] }, { title: 'Transmission Service Technique' });

  assert.match(withPhoto, /Photo du câble T2 \/ marquage 32 A demandée/);
  assert.doesNotMatch(withoutPhoto, /Photo du câble T2 \/ marquage 32 A demandée/);
});
