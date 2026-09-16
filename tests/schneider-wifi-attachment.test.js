import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';
import { buildSalesforceSummary } from '../app/summary.js';

const REMINDER = '⚠️ Pièce à joindre : test Wi-Fi conforme (2,4 GHz / signal ≥ -65 dBm)';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function effectiveSchneiderNodes() {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const schneiderPolicy = await loadJson('../data/schneider-charge-policy.json');
  const attachmentPolicy = await loadJson('../data/schneider-wifi-attachment-policy.json');
  return applySchneiderChargePolicy(
    applySchneiderChargePolicy(nodes, schneiderPolicy),
    attachmentPolicy
  );
}

test('les résultats du test Wi-Fi poursuivent directement le parcours sans écran intermédiaire', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'SC-ORANGE-WIFI-WISER');
  const smartcharge = effective.find(node => node.id === 'SC-ORANGE-WIFI-SMARTCHARGE');
  const notConnected = effective.find(node => node.id === 'SC-ORANGE-NOT-CONNECTED');

  assert.equal(wiser.answers.find(answer => answer.id === 'conform').next, 'F-096');
  assert.equal(wiser.answers.find(answer => answer.id === 'not-conform').next, 'END-REINTERVENTION');
  assert.equal(smartcharge.answers.find(answer => answer.id === 'conform').next, 'END-TRANSFER');
  assert.equal(smartcharge.answers.find(answer => answer.id === 'not-conform').next, 'END-REINTERVENTION');
  assert.equal(notConnected.answers[0].next, 'END-REINTERVENTION');

  assert.equal(effective.some(node => node.id.startsWith('SC-WIFI-ATTACH-')), false);
});

test('chaque sortie du test Wi-Fi conserve le rappel de pièce à joindre pour Salesforce', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'SC-ORANGE-WIFI-WISER');
  const smartcharge = effective.find(node => node.id === 'SC-ORANGE-WIFI-SMARTCHARGE');
  const notConnected = effective.find(node => node.id === 'SC-ORANGE-NOT-CONNECTED');

  for (const answer of wiser.answers) {
    assert.equal(answer.set['attachments.wifiTest'], REMINDER);
  }
  for (const answer of smartcharge.answers) {
    assert.equal(answer.set['attachments.wifiTest'], REMINDER);
  }
  assert.equal(notConnected.answers[0].set['attachments.wifiTest'], REMINDER);
});

test('le résumé Salesforce rappelle la pièce Wi-Fi à joindre', () => {
  const summary = buildSalesforceSummary({
    context: { 'attachments.wifiTest': REMINDER },
    checks: []
  }, { title: 'Transmission Service Technique' });

  assert.match(summary, /⚠️ Pièce à joindre : test Wi-Fi conforme \(2,4 GHz \/ signal ≥ -65 dBm\)/);
});
