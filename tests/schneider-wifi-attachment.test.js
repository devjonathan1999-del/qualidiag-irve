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

test('Wiser et Smartcharge passent par une alerte pièce à joindre après le test Wi-Fi', async () => {
  const effective = await effectiveSchneiderNodes();
  const wiser = effective.find(node => node.id === 'SC-ORANGE-WIFI-WISER');
  const smartcharge = effective.find(node => node.id === 'SC-ORANGE-WIFI-SMARTCHARGE');

  assert.equal(wiser.answers.find(answer => answer.id === 'conform').next, 'SC-WIFI-ATTACH-WISER');
  assert.equal(wiser.answers.find(answer => answer.id === 'not-conform').next, 'SC-WIFI-ATTACH-REINTERVENTION');
  assert.equal(smartcharge.answers.find(answer => answer.id === 'conform').next, 'SC-WIFI-ATTACH-SMARTCHARGE');
  assert.equal(smartcharge.answers.find(answer => answer.id === 'not-conform').next, 'SC-WIFI-ATTACH-REINTERVENTION');
});

test('les alertes affichent le même rappel et reprennent ensuite le parcours prévu', async () => {
  const effective = await effectiveSchneiderNodes();
  const expectedNext = {
    'SC-WIFI-ATTACH-WISER': 'F-096',
    'SC-WIFI-ATTACH-SMARTCHARGE': 'END-TRANSFER',
    'SC-WIFI-ATTACH-REINTERVENTION': 'END-REINTERVENTION'
  };

  for (const [id, next] of Object.entries(expectedNext)) {
    const node = effective.find(item => item.id === id);
    assert.equal(node.title, '⚠️ Test Wi-Fi à fournir');
    assert.equal(node.body, REMINDER);
    assert.equal(node.answers[0].next, next);
    assert.equal(node.answers[0].set['attachments.wifiTest'], REMINDER);
  }
});

test('le résumé Salesforce rappelle la pièce Wi-Fi à joindre', () => {
  const summary = buildSalesforceSummary({
    context: { 'attachments.wifiTest': REMINDER },
    checks: []
  }, { title: 'Transmission Service Technique' });

  assert.match(summary, /⚠️ Pièce à joindre : test Wi-Fi conforme \(2,4 GHz \/ signal ≥ -65 dBm\)/);
});
