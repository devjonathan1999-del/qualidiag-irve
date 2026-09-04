import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toViewModel } from '../app/presenter.js';
import { createSession, recordAnswer } from '../app/session.js';
import { buildSalesforceSummary } from '../app/summary.js';

async function loadCommon() {
  return JSON.parse(await readFile(new URL('../data/diagnostics/common.json', import.meta.url), 'utf8'));
}

test('la non-conformité AC expose un champ multiligne obligatoire', async () => {
  const nodes = await loadCommon();
  const node = nodes.find(item => item.id === 'A-AC-NONCONFORME');
  assert.equal(node.input.type, 'textarea');
  assert.equal(node.input.key, 'autocontrol.nonConformity');
  assert.equal(node.input.required, true);
});

test('le presenter expose le champ de saisie avec sa valeur existante', () => {
  const node = {
    id: 'A-AC-NONCONFORME',
    type: 'action',
    title: 'Préciser la non-conformité',
    input: {
      type: 'textarea',
      key: 'autocontrol.nonConformity',
      label: 'Motif de non-conformité',
      required: true
    },
    answers: [{ id: 'continue', label: 'Continuer', next: 'NEXT' }]
  };
  const session = { context: { 'autocontrol.nonConformity': 'Terre non conforme' }, history: [] };
  const vm = toViewModel(node, session, {});
  assert.equal(vm.input.key, 'autocontrol.nonConformity');
  assert.equal(vm.input.value, 'Terre non conforme');
  assert.equal(vm.input.required, true);
});

test('recordAnswer conserve la saisie dans le contexte de qualification', () => {
  const session = createSession('A-AC-NONCONFORME');
  const node = { id: 'A-AC-NONCONFORME' };
  const answer = { id: 'continue', next: 'Q-VEHICLE' };
  const next = recordAnswer(session, node, answer, {
    'autocontrol.nonConformity': 'Absence de repérage au tableau'
  });
  assert.equal(next.context['autocontrol.nonConformity'], 'Absence de repérage au tableau');
});

test('le résumé Salesforce reprend le motif de non-conformité', () => {
  const summary = buildSalesforceSummary({
    context: { 'autocontrol.nonConformity': 'Protection non conforme' },
    checks: []
  }, { title: 'Transmission Service Technique' });
  assert.match(summary, /Non-conformité AC : Protection non conforme/);
});

test('l’UI prévoit un textarea obligatoire pour les champs multiligne', async () => {
  const source = await readFile(new URL('../app/ui.js', import.meta.url), 'utf8');
  assert.match(source, /data-input/);
  assert.match(source, /textarea/);
  assert.match(source, /required/);
});
