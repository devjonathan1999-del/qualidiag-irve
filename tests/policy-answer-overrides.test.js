import test from 'node:test';
import assert from 'node:assert/strict';
import { applySchneiderChargePolicy } from '../app/data.js';

test('une policy peut modifier une seule réponse sans écraser les autres réponses du nœud', () => {
  const nodes = [{
    id: 'F-013',
    type: 'question',
    answers: [
      { id: 'led-rouge', label: 'LED Rouge', next: 'RED' },
      { id: 'charge-faible', label: 'Charge faible', next: 'OLD' },
      { id: 'badge-rfid', label: 'Badge RFID', next: 'RFID' }
    ]
  }];

  const policy = {
    nodes: {
      'F-013': {
        answerOverrides: [
          { id: 'charge-faible', next: 'NEW' }
        ]
      }
    }
  };

  const result = applySchneiderChargePolicy(nodes, policy);
  const answers = result.find(node => node.id === 'F-013').answers;

  assert.deepEqual(answers, [
    { id: 'led-rouge', label: 'LED Rouge', next: 'RED' },
    { id: 'charge-faible', label: 'Charge faible', next: 'NEW' },
    { id: 'badge-rfid', label: 'Badge RFID', next: 'RFID' }
  ]);
});
