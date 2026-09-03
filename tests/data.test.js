import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateData } from '../app/data.js';

const valid = {
  brands: [{ id: 'schneider', label: 'Schneider Charge', pilot: true }],
  models: [{ id: 'schneider-charge', brandId: 'schneider', label: 'Schneider Charge', pilot: true }],
  procedures: [], resources: [],
  conclusions: [{ id: 'RESOLVED', status: 'resolved', title: 'Résolu' }],
  nodes: [
    { id: 'START', type: 'question', answers: [{ id: 'go', label: 'Continuer', next: 'END' }] },
    { id: 'END', type: 'conclusion', conclusionId: 'RESOLVED' }
  ]
};

test('accepte une base cohérente', () => {
  assert.deepEqual(validateData(valid), []);
});

test('détecte une destination inexistante', () => {
  const broken = structuredClone(valid);
  broken.nodes[0].answers[0].next = 'UNKNOWN';
  assert.match(validateData(broken).join('\n'), /UNKNOWN/);
});

test('détecte une conclusion inconnue, un type invalide et une marque modèle inconnue', () => {
  const broken = structuredClone(valid);
  broken.nodes[1].conclusionId = 'UNKNOWN';
  broken.nodes[0].type = 'mystery';
  broken.models[0].brandId = 'unknown-brand';
  const errors = validateData(broken).join('\n');
  assert.match(errors, /UNKNOWN/);
  assert.match(errors, /mystery/);
  assert.match(errors, /unknown-brand/);
});

test('les vrais fichiers JSON du pilote sont cohérents', async () => {
  const base = new URL('../data/', import.meta.url);
  const [brands, models, nodes, procedures, conclusions, resources] = await Promise.all(
    ['brands.json', 'models.json', 'diagnostics.json', 'procedures.json', 'conclusions.json', 'resources.json']
      .map(async file => JSON.parse(await readFile(new URL(file, base), 'utf8')))
  );
  assert.deepEqual(validateData({ brands, models, nodes, procedures, conclusions, resources }), []);
});
