import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';
import { buildSalesforceSummary } from '../app/summary.js';

const common = JSON.parse(await readFile(new URL('../data/diagnostics/common.json', import.meta.url), 'utf8'));
const policy = JSON.parse(await readFile(new URL('../data/autocontrol-policy.json', import.meta.url), 'utf8'));
const effectiveNodes = applySchneiderChargePolicy(common, policy);
const byId = new Map(effectiveNodes.map(node => [node.id, node]));

test('un autocontrôle non exploitable demande obligatoirement pourquoi', () => {
  const exploitable = byId.get('Q-AC-EXPLOITABLE');
  const no = exploitable.answers.find(answer => answer.id === 'no');
  assert.equal(no.next, 'A-AC-UNUSABLE-REASON');

  const reason = byId.get('A-AC-UNUSABLE-REASON');
  assert.equal(reason.type, 'action');
  assert.equal(reason.title, "Pourquoi l’autocontrôle n’est-il pas exploitable ?");
  assert.equal(reason.input.type, 'textarea');
  assert.equal(reason.input.key, 'autocontrol.unusableReason');
  assert.equal(reason.input.required, true);
  assert.match(reason.input.placeholder, /Photos manquantes/);
  assert.equal(reason.answers[0].next, 'Q-AC-REINTERVENTION');
});

test('le statut de réintervention est qualifié sans terminer le parcours', () => {
  const node = byId.get('Q-AC-REINTERVENTION');
  assert.equal(node.title, 'Une réintervention est-elle en cours ?');

  const yes = node.answers.find(answer => answer.id === 'yes');
  const no = node.answers.find(answer => answer.id === 'no');

  assert.equal(yes.next, 'Q-VEHICLE');
  assert.equal(no.next, 'Q-VEHICLE');
  assert.deepEqual(yes.set, { 'autocontrol.reintervention': 'En cours' });
  assert.deepEqual(no.set, { 'autocontrol.reintervention': 'Aucune réintervention en cours' });
});

test('le résumé Salesforce reprend le motif inexploitable et le statut de réintervention', () => {
  const summary = buildSalesforceSummary({
    context: {
      'autocontrol.unusableReason': 'Photos illisibles',
      'autocontrol.reintervention': 'En cours'
    },
    checks: []
  }, { title: 'Qualification poursuivie' });

  assert.match(summary, /Autocontrôle inexploitable : Photos illisibles/);
  assert.match(summary, /Réintervention : En cours/);
});
