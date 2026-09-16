import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

const CABLE_ALERT = 'Point de vigilance : bien appuyer fortement sur l’insertion du câble côté borne jusqu’en butée.';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function loadEffectiveNodes() {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  return applySchneiderChargePolicy(nodes, policy);
}

test('LED rouge fixe commence par vérifier l’insertion ferme du câble côté borne avec une alerte orange', async () => {
  const nodes = await loadEffectiveNodes();
  const red = nodes.find(node => node.id === 'F-090');

  assert.equal(red.title, 'LED rouge fixe');
  assert.match(red.body, /câble côté borne/i);
  assert.match(red.body, /fermement/i);
  assert.match(red.body, /butée/i);
  assert.equal(red.alert, CABLE_ALERT);
  assert.equal(red.validation, 'valide');
  assert.equal(red.answers.find(answer => answer.id === 'resolved').next, 'END-RESOLVED');
  assert.equal(red.answers.find(answer => answer.id === 'still-red').next, 'SC-RED-RESTART');
});

test('si le rouge persiste, la borne est coupée 5 minutes au disjoncteur avant de contrôler la LED', async () => {
  const nodes = await loadEffectiveNodes();
  const restart = nodes.find(node => node.id === 'SC-RED-RESTART');
  const afterReset = nodes.find(node => node.id === 'SC-RED-AFTER-RESET');

  assert.ok(restart);
  assert.match(restart.body, /disjoncteur/i);
  assert.match(restart.body, /5\s*minutes/i);
  assert.equal(restart.answers[0].next, 'SC-RED-AFTER-RESET');

  assert.ok(afterReset);
  assert.equal(afterReset.answers.find(answer => answer.id === 'normal').next, 'SC-RED-CHARGE-TEST');
  assert.equal(afterReset.answers.find(answer => answer.id === 'red').next, 'SC-RED-CONTEXT');
});

test('si la LED redevient normale, un essai de charge résout ou transfère le dossier', async () => {
  const nodes = await loadEffectiveNodes();
  const chargeTest = nodes.find(node => node.id === 'SC-RED-CHARGE-TEST');

  assert.ok(chargeTest);
  assert.equal(chargeTest.answers.find(answer => answer.id === 'charge-ok').next, 'END-RESOLVED');
  assert.equal(chargeTest.answers.find(answer => answer.id === 'charge-ko').next, 'END-TRANSFER');
  assert.equal(chargeTest.validation, 'valide');
});

test('si la LED reste rouge, quatre contextes simples sont conservés avant transfert technique', async () => {
  const nodes = await loadEffectiveNodes();
  const context = nodes.find(node => node.id === 'SC-RED-CONTEXT');

  assert.ok(context);
  assert.deepEqual(context.answers.map(answer => answer.label), [
    'Dès le branchement du câble',
    'Au lancement de la charge',
    'Pendant la charge',
    'Aléatoirement'
  ]);
  assert.equal(context.answers.every(answer => answer.next === 'END-TRANSFER'), true);
  assert.equal(context.validation, 'valide');
});
