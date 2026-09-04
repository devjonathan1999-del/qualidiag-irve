import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function effectiveSchneiderNodes() {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const policy = await loadJson('../data/schneider-charge-policy.json');
  return applySchneiderChargePolicy(nodes, policy);
}

test('Schneider LED orange commence par la connexion Internet indiquée dans l’autocontrôle', async () => {
  const effective = await effectiveSchneiderNodes();
  const orange = effective.find(node => node.id === 'F-091');

  assert.equal(orange.title, 'LED orange clignotante');
  assert.match(orange.body, /connectée? à Internet.*autocontrôle/i);
  assert.deepEqual(orange.answers.map(answer => answer.id), ['connected', 'not-connected']);
  assert.equal(orange.answers.find(answer => answer.id === 'connected').next, 'SC-ORANGE-SUPERVISION');
  assert.equal(orange.answers.find(answer => answer.id === 'not-connected').next, 'SC-ORANGE-NOT-CONNECTED');
  assert.equal(orange.validation, 'valide');
});

test('si la borne n’est pas connectée, le test Wi-Fi est obligatoire et le pro doit réintervenir', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-ORANGE-NOT-CONNECTED');

  assert.match(node.body, /test Wi-Fi.*obligatoire/i);
  assert.match(node.body, /2,4 GHz/i);
  assert.match(node.body, /-65 dBm/i);
  assert.match(node.body, /réintervenir/i);
  assert.equal(node.answers[0].next, 'END-REINTERVENTION');
});

test('si la borne est connectée, la supervision Wiser ou Smartcharge est identifiée avant le test Wi-Fi', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-ORANGE-SUPERVISION');

  assert.deepEqual(node.answers.map(answer => answer.id), ['wiser', 'smartcharge']);
  assert.equal(node.answers.find(answer => answer.id === 'wiser').next, 'SC-ORANGE-WIFI-WISER');
  assert.equal(node.answers.find(answer => answer.id === 'smartcharge').next, 'SC-ORANGE-WIFI-SMARTCHARGE');
});

test('le test Wi-Fi Wiser exige 2,4 GHz et au moins -65 dBm avant la branche Wiser', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-ORANGE-WIFI-WISER');

  assert.match(node.body, /2,4 GHz/i);
  assert.match(node.body, /-65 dBm/i);
  assert.equal(node.answers.find(answer => answer.id === 'conform').next, 'F-096');
  assert.equal(node.answers.find(answer => answer.id === 'not-conform').next, 'END-REINTERVENTION');
});

test('le test Wi-Fi Smartcharge exige 2,4 GHz et au moins -65 dBm avant le Service Technique', async () => {
  const effective = await effectiveSchneiderNodes();
  const node = effective.find(item => item.id === 'SC-ORANGE-WIFI-SMARTCHARGE');

  assert.match(node.body, /2,4 GHz/i);
  assert.match(node.body, /-65 dBm/i);
  assert.equal(node.answers.find(answer => answer.id === 'conform').next, 'END-TRANSFER');
  assert.equal(node.answers.find(answer => answer.id === 'not-conform').next, 'END-REINTERVENTION');
});
