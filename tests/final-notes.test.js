import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyFinalNotePolicy } from '../app/data.js';
import { buildSalesforceSummary } from '../app/summary.js';
import { recordAnswer, goBack } from '../app/session.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('chaque sortie finale passe par une étape Informations complémentaires facultative', async () => {
  const nodes = await loadJson('../data/diagnostics/common.json');
  const effective = applyFinalNotePolicy(nodes);
  const endIds = nodes.filter(node => node.type === 'conclusion').map(node => node.id);

  for (const endId of endIds) {
    const noteId = `FINAL-NOTE-${endId}`;
    const note = effective.find(node => node.id === noteId);
    assert.ok(note, `Étape finale absente pour ${endId}`);
    assert.equal(note.title, 'Informations complémentaires');
    assert.equal(note.input.type, 'textarea');
    assert.equal(note.input.key, 'final.additionalInfo');
    assert.equal(note.input.required, false);
    assert.equal(note.answers[0].next, endId);
  }

  for (const node of effective) {
    if (node.id.startsWith('FINAL-NOTE-')) continue;
    for (const answer of node.answers ?? []) {
      if (endIds.includes(answer.next)) {
        assert.fail(`${node.id}/${answer.id} contourne l’étape Informations complémentaires`);
      }
    }
  }
});

test('l’ancien écran de complément Forms est contourné au profit du champ final commun', async () => {
  const nodes = await loadJson('../data/diagnostics/common.json');
  const effective = applyFinalNotePolicy(nodes);

  for (const node of effective) {
    for (const answer of node.answers ?? []) {
      assert.notEqual(answer.next, 'F-106');
    }
  }
});

test('les informations complémentaires sont conservées lors du retour', () => {
  const noteNode = {
    id: 'FINAL-NOTE-END-TRANSFER',
    answers: [{ id: 'continue', next: 'END-TRANSFER' }]
  };
  const session = {
    currentNodeId: noteNode.id,
    history: [],
    context: {},
    checks: []
  };

  const answered = recordAnswer(session, noteNode, noteNode.answers[0], {
    'final.additionalInfo': 'Le client signale un comportement intermittent.'
  });
  const restored = goBack(answered);

  assert.equal(restored.currentNodeId, noteNode.id);
  assert.equal(restored.context['final.additionalInfo'], 'Le client signale un comportement intermittent.');
});

test('le résumé Salesforce ajoute les informations complémentaires uniquement si elles sont renseignées', () => {
  const conclusion = { title: 'Transmission Service Technique' };
  const withNote = buildSalesforceSummary({
    context: {
      brand: 'Schneider Charge',
      'final.additionalInfo': 'Capture Smartcharge reçue du client.'
    },
    checks: []
  }, conclusion);
  const withoutNote = buildSalesforceSummary({ context: { brand: 'Schneider Charge' }, checks: [] }, conclusion);

  assert.match(withNote, /Informations complémentaires : Capture Smartcharge reçue du client\./);
  assert.doesNotMatch(withoutNote, /Informations complémentaires :/);
});
