import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyPowerPolicy } from '../app/data.js';

async function loadCommon() {
  const nodes = JSON.parse(await readFile(new URL('../data/diagnostics/common.json', import.meta.url), 'utf8'));
  const policy = JSON.parse(await readFile(new URL('../data/power-policy.json', import.meta.url), 'utf8'));
  return applyPowerPolicy(nodes, policy);
}

test('le tronc commun ne demande aucune identité client', async () => {
  const nodes = await loadCommon();
  const text = JSON.stringify(nodes).toLowerCase();
  assert.equal(text.includes('nom prénom'), false);
  assert.equal(text.includes('nom/prénom'), false);
});

test('propose uniquement les puissances de vente retenues', async () => {
  const nodes = await loadCommon();
  const byId = new Map(nodes.map(node => [node.id, node]));
  assert.deepEqual(byId.get('Q-POWER-MONO').answers.map(answer => answer.label), ['6 kVA', '9 kVA', '12 kVA', 'Autre / à préciser']);
  assert.deepEqual(byId.get('Q-POWER-TRI').answers.map(answer => answer.label), ['12 kVA', '15 kVA', '18 kVA', '24 kVA', '30 kVA', '36 kVA', 'Autre / à préciser']);
});

test('6 kVA mono déclenche une alerte métier avant de poursuivre', async () => {
  const nodes = await loadCommon();
  const byId = new Map(nodes.map(node => [node.id, node]));
  const answer = byId.get('Q-POWER-MONO').answers.find(item => item.id === '6');
  assert.equal(answer.next, 'A-POWER-WARNING-MONO-6');
  const alert = byId.get('A-POWER-WARNING-MONO-6');
  assert.match(alert.title, /alerte/i);
  assert.equal(alert.answers[0].next, 'Q-AC-EXPLOITABLE');
});

test('12 kVA tri déclenche une alerte métier avant de poursuivre', async () => {
  const nodes = await loadCommon();
  const byId = new Map(nodes.map(node => [node.id, node]));
  const answer = byId.get('Q-POWER-TRI').answers.find(item => item.id === '12');
  assert.equal(answer.next, 'A-POWER-WARNING-TRI-12');
  const alert = byId.get('A-POWER-WARNING-TRI-12');
  assert.match(alert.title, /alerte/i);
  assert.equal(alert.answers[0].next, 'Q-AC-EXPLOITABLE');
});

test('désactive la recherche d’information en attendant son futur parcours', async () => {
  const nodes = await loadCommon();
  const start = nodes.find(node => node.id === 'START');
  const info = start.answers.find(answer => answer.id === 'info');
  assert.equal(info.disabled, true);
  assert.match(info.label, /à venir/i);
  assert.equal(info.validation, 'a_valider');
});

test('marque le tronc commun validé métier', async () => {
  const nodes = await loadCommon();
  const validatedIds = ['START', 'Q-PHASE', 'Q-POWER-MONO', 'Q-POWER-TRI', 'A-POWER-WARNING-MONO-6', 'A-POWER-WARNING-TRI-12', 'Q-AC-EXPLOITABLE', 'Q-AC-CONFORME', 'A-AC-NONCONFORME', 'Q-VEHICLE', 'Q-BRAND'];
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const id of validatedIds) assert.equal(byId.get(id).validation, 'valide', id);
});
