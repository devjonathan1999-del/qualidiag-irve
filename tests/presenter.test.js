import test from 'node:test';
import assert from 'node:assert/strict';
import { toViewModel } from '../app/presenter.js';

const node = {
  id: 'Q-CABLE', type: 'question', title: 'Le câble est-il un modèle 32 A ?',
  answers: [
    { id: 'yes', label: 'Oui', next: 'Q-HOME' },
    { id: 'no', label: 'Non', next: 'END' }
  ]
};

const session = {
  context: { brand: 'Schneider Charge', model: 'Schneider Charge', symptom: 'Charge faible' },
  history: [{ nodeId: 'START' }]
};

test('expose contexte, réponses et possibilité de retour', () => {
  const vm = toViewModel(node, session, {});
  assert.equal(vm.title, node.title);
  assert.deepEqual(vm.answers.map(a => a.label), ['Oui', 'Non']);
  assert.equal(vm.canGoBack, true);
  assert.equal(vm.context.brand, 'Schneider Charge');
});

test('présente une conclusion avec résumé Salesforce', () => {
  const conclusionNode = { id: 'END', type: 'conclusion', conclusionId: 'TRANSFER_TECH' };
  const data = { conclusions: [{ id: 'TRANSFER_TECH', title: 'Transmission Service Technique' }] };
  const vm = toViewModel(conclusionNode, session, data);
  assert.equal(vm.kind, 'conclusion');
  assert.equal(vm.title, 'Transmission Service Technique');
  assert.match(vm.summary, /Conclusion : Transmission Service Technique/);
});

test('résout un texte métier selon une valeur du contexte', () => {
  const dynamicNode = {
    id: 'Q-AGCP',
    type: 'question',
    title: 'Le calibre de l’AGCP est-il cohérent ?',
    bodyByContext: {
      key: 'installation.power',
      values: {
        '9 kVA': 'Calibre attendu : 45 A',
        '12 kVA': 'Calibre attendu : 60 A'
      },
      fallback: 'Vérifier le calibre attendu selon l’abonnement.'
    },
    answers: []
  };
  const vm = toViewModel(dynamicNode, { ...session, context: { ...session.context, 'installation.power': '9 kVA' } }, {});
  assert.equal(vm.body, 'Calibre attendu : 45 A');
});
