import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function loadEffectiveNodes() {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  return applySchneiderChargePolicy(nodes, policy);
}

test('LED rouge fixe commence par vérifier l’insertion ferme du câble côté borne', async () => {
  const nodes = await loadEffectiveNodes();
  const red = nodes.find(node => node.id === 'F-090');

  assert.equal(red.title, 'LED rouge fixe');
  assert.match(red.body, /câble côté borne/i);
  assert.match(red.body, /fermement/i);
  assert.match(red.body, /butée/i);
  assert.equal(red.validation, 'valide');
  assert.equal(red.answers.find(answer => answer.id === 'resolved').next, 'END-RESOLVED');
  assert.equal(red.answers.find(answer => answer.id === 'still-red').next, 'SC-RED-RESTART');
});

test('si le rouge persiste, le chargé d’affaires demande seulement un redémarrage', async () => {
  const nodes = await loadEffectiveNodes();
  const restart = nodes.find(node => node.id === 'SC-RED-RESTART');

  assert.ok(restart);
  assert.match(restart.body, /redémarr/i);
  assert.equal(restart.answers.find(answer => answer.id === 'resolved').next, 'END-RESOLVED');
  assert.equal(restart.answers.find(answer => answer.id === 'still-red').next, 'SC-RED-CONTEXT');
});

test('si le défaut revient, quatre contextes simples sont proposés avant transfert technique', async () => {
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
