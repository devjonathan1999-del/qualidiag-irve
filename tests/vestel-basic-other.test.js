import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';
import { buildSalesforceSummary } from '../app/summary.js';

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

test('Vestel BASIC Autre demande une description libre obligatoire avant transfert', async () => {
  const data = await localData();
  const basic = data.nodes.find(node => node.id === 'F-013');
  const other = basic.answers.find(answer => answer.id === 'autre');
  assert.equal(other.next, 'VESTEL-BASIC-OTHER-DESCRIPTION');

  const description = data.nodes.find(node => node.id === 'VESTEL-BASIC-OTHER-DESCRIPTION');
  assert.ok(description);
  assert.equal(description.input.type, 'textarea');
  assert.equal(description.input.key, 'vestel.basic.otherDescription');
  assert.equal(description.input.required, true);
  assert.equal(description.answers.find(answer => answer.id === 'continue').next, 'FINAL-NOTE-END-TRANSFER');
});

test('le résumé Salesforce reprend la description du problème Vestel BASIC Autre', () => {
  const summary = buildSalesforceSummary({
    context: {
      brand: 'Vestel',
      model: 'BASIC non connectée Izi by EDF',
      symptom: 'Autre',
      'vestel.basic.otherDescription': 'La borne émet un bruit inhabituel au branchement.'
    },
    checks: []
  }, { title: 'Transmission Service Technique' });

  assert.match(summary, /Description du problème : La borne émet un bruit inhabituel au branchement\./);
});
