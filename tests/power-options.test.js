import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadCommon() {
  return JSON.parse(await readFile(new URL('../data/diagnostics/common.json', import.meta.url), 'utf8'));
}

test('propose toutes les puissances utiles en monophasé', async () => {
  const nodes = await loadCommon();
  const node = nodes.find(item => item.id === 'Q-POWER-MONO');
  assert.deepEqual(node.answers.map(answer => answer.label), [
    '3 kVA',
    '6 kVA',
    '9 kVA',
    '12 kVA',
    'Autre / à préciser'
  ]);
});

test('propose toutes les puissances utiles en triphasé', async () => {
  const nodes = await loadCommon();
  const node = nodes.find(item => item.id === 'Q-POWER-TRI');
  assert.deepEqual(node.answers.map(answer => answer.label), [
    '6 kVA',
    '9 kVA',
    '12 kVA',
    '15 kVA',
    '18 kVA',
    '24 kVA',
    '30 kVA',
    '36 kVA',
    'Autre / à préciser'
  ]);
});
