import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadData } from '../app/data.js';
import { buildSalesforceSummary } from '../app/summary.js';

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

test('Vestel Smartcharge Application distingue aide à l’utilisation et problème technique', async () => {
  const data = await loadLocalData();
  const smartcharge = data.nodes.find(node => node.id === 'F-012');
  const application = smartcharge.answers.find(answer => answer.id === 'application');

  assert.equal(application.next, 'VESTEL-SMARTCHARGE-APP-ISSUE-TYPE');

  const issueType = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-APP-ISSUE-TYPE');
  assert.ok(issueType);
  assert.match(issueType.title, /application/i);
  assert.equal(issueType.answers.find(answer => answer.id === 'usage').next, 'F-022');
  assert.equal(issueType.answers.find(answer => answer.id === 'technical').next, 'VESTEL-SMARTCHARGE-APP-TECH-DESCRIPTION');
});

test('le parcours Application validé métier ne contient aucun lien SharePoint', async () => {
  const data = await loadLocalData();
  const ids = [
    'VESTEL-SMARTCHARGE-APP-ISSUE-TYPE',
    'F-022',
    'VESTEL-SMARTCHARGE-APP-TECH-DESCRIPTION'
  ];
  const nodes = ids.map(id => data.nodes.find(node => node.id === id));

  assert.ok(nodes.every(Boolean));
  assert.equal(nodes[0].validation, 'valide');
  assert.equal(nodes[2].validation, 'valide');
  assert.doesNotMatch(JSON.stringify(nodes), /sharepoint/i);
});

test('un problème technique de l’application exige une description avant transfert', async () => {
  const data = await loadLocalData();
  const description = data.nodes.find(node => node.id === 'VESTEL-SMARTCHARGE-APP-TECH-DESCRIPTION');

  assert.ok(description);
  assert.equal(description.input?.type, 'textarea');
  assert.equal(description.input?.key, 'vestel.smartcharge.applicationIssue');
  assert.equal(description.input?.required, true);
  assert.match(description.body, /message|comportement|problème/i);
  assert.equal(description.answers.find(answer => answer.id === 'continue').next, 'FINAL-NOTE-END-TRANSFER');
});

test('le résumé Salesforce reprend le problème technique de l’application', () => {
  const summary = buildSalesforceSummary({
    context: {
      brand: 'Vestel IZI by EDF',
      model: 'Smartcharge connectée Izi by EDF',
      symptom: 'Application',
      'vestel.smartcharge.applicationIssue': 'L’application affiche une erreur lors de l’ouverture.'
    },
    checks: []
  }, { title: 'Transmission Service Technique' });

  assert.match(summary, /Problème application : L’application affiche une erreur lors de l’ouverture\./);
});
