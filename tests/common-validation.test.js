import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadCommon() {
  return JSON.parse(await readFile(new URL('../data/diagnostics/common.json', import.meta.url), 'utf8'));
}

test('le tronc commun ne demande aucune identité client', async () => {
  const nodes = await loadCommon();
  const text = JSON.stringify(nodes).toLowerCase();
  assert.equal(text.includes('nom prénom'), false);
  assert.equal(text.includes('nom/prénom'), false);
});

test('propose les puissances d’abonnement par type d’installation', async () => {
  const nodes = await loadCommon();
  const byId = new Map(nodes.map(node => [node.id, node]));
  assert.deepEqual(byId.get('Q-POWER-MONO').answers.map(answer => answer.label), ['9 kVA', '12 kVA', 'Autre / à préciser']);
  assert.deepEqual(byId.get('Q-POWER-TRI').answers.map(answer => answer.label), ['15 kVA', '18 kVA', '24 kVA', '36 kVA', 'Autre / à préciser']);
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
  const validatedIds = ['START', 'Q-PHASE', 'Q-POWER-MONO', 'Q-POWER-TRI', 'Q-AC-EXPLOITABLE', 'Q-AC-CONFORME', 'A-AC-NONCONFORME', 'Q-VEHICLE', 'Q-BRAND'];
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const id of validatedIds) assert.equal(byId.get(id).validation, 'valide', id);
});
