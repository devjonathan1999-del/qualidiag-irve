import test from 'node:test';
import assert from 'node:assert/strict';
import { answerButtons } from '../app/ui.js';
import { toViewModel } from '../app/presenter.js';

test('le presenter conserve l’état disabled d’une réponse', () => {
  const node = {
    id: 'START',
    type: 'question',
    title: 'Choix',
    answers: [{ id: 'info', label: 'Information à venir', disabled: true, next: 'END' }]
  };
  const vm = toViewModel(node, { context: {}, history: [] }, {});
  assert.equal(vm.answers[0].disabled, true);
});

test('une réponse disabled est rendue comme bouton non cliquable', () => {
  const html = answerButtons([{ id: 'info', label: 'Information à venir', disabled: true }]);
  assert.match(html, /disabled/);
  assert.match(html, /aria-disabled="true"/);
});
