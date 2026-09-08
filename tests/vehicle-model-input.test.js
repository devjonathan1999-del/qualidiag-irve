import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toViewModel } from '../app/presenter.js';
import { createSession, recordAnswer } from '../app/session.js';
import { buildSalesforceSummary } from '../app/summary.js';

test('la question véhicule devient un champ libre optionnel', async () => {
  const nodes = JSON.parse(await readFile(new URL('../data/diagnostics/common.json', import.meta.url), 'utf8'));
  const node = nodes.find(item => item.id === 'Q-VEHICLE');

  assert.equal(node.title, 'Quel est le modèle du VE du client ?');
  assert.equal(node.input.type, 'text');
  assert.equal(node.input.key, 'vehicle.model');
  assert.equal(node.input.required, false);
  assert.equal(node.answers.length, 1);
  assert.equal(node.answers[0].label, 'Continuer');
  assert.equal(node.answers[0].next, 'Q-BRAND');
});

test('le presenter restaure le modèle du véhicule déjà saisi', () => {
  const node = {
    id: 'Q-VEHICLE',
    type: 'question',
    title: 'Quel est le modèle du VE du client ?',
    input: {
      type: 'text',
      key: 'vehicle.model',
      label: 'Modèle du véhicule',
      required: false
    },
    answers: [{ id: 'continue', label: 'Continuer', next: 'Q-BRAND' }]
  };

  const vm = toViewModel(node, {
    context: { 'vehicle.model': 'Tesla Model Y' },
    history: []
  }, {});

  assert.equal(vm.input.value, 'Tesla Model Y');
});

test('recordAnswer conserve le modèle du véhicule saisi', () => {
  const session = createSession('Q-VEHICLE');
  const node = { id: 'Q-VEHICLE' };
  const answer = { id: 'continue', next: 'Q-BRAND' };
  const next = recordAnswer(session, node, answer, {
    'vehicle.model': 'Renault Mégane E-Tech'
  });

  assert.equal(next.context['vehicle.model'], 'Renault Mégane E-Tech');
});

test('le résumé Salesforce ajoute le véhicule uniquement lorsqu’il est renseigné', () => {
  const withVehicle = buildSalesforceSummary({
    context: { 'vehicle.model': 'Tesla Model Y' },
    checks: []
  }, { title: 'Transmission Service Technique' });
  assert.match(withVehicle, /Véhicule : Tesla Model Y/);

  const withoutVehicle = buildSalesforceSummary({ context: {}, checks: [] }, {
    title: 'Transmission Service Technique'
  });
  assert.doesNotMatch(withoutVehicle, /Véhicule :/);
});
