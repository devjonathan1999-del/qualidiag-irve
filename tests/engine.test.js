import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, getNode, resolveAnswer, GraphError } from '../app/engine.js';

const nodes = [
  {
    id: 'Q1', type: 'question', title: 'Choix ?',
    answers: [{ id: 'yes', label: 'Oui', next: 'END' }]
  },
  { id: 'END', type: 'conclusion', conclusionId: 'RESOLVED' }
];

test('résout une réponse vers le nœud suivant', () => {
  const graph = buildGraph(nodes);
  const result = resolveAnswer(graph, 'Q1', 'yes');
  assert.equal(result.nextId, 'END');
  assert.equal(getNode(graph, result.nextId).type, 'conclusion');
});

test('rejette un nœud absent avec un code stable', () => {
  const graph = buildGraph(nodes);
  assert.throws(() => getNode(graph, 'UNKNOWN'), err => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.code, 'NODE_NOT_FOUND');
    return true;
  });
});

test('rejette un identifiant de nœud dupliqué', () => {
  assert.throws(() => buildGraph([{ id: 'X' }, { id: 'X' }]), err => {
    assert.equal(err.code, 'DUPLICATE_NODE');
    return true;
  });
});

test('rejette une réponse absente', () => {
  const graph = buildGraph(nodes);
  assert.throws(() => resolveAnswer(graph, 'Q1', 'no'), err => {
    assert.equal(err.code, 'ANSWER_NOT_FOUND');
    return true;
  });
});

test('rejette une réponse sans destination', () => {
  const graph = buildGraph([{ id: 'Q', type: 'question', answers: [{ id: 'yes', label: 'Oui' }] }]);
  assert.throws(() => resolveAnswer(graph, 'Q', 'yes'), err => {
    assert.equal(err.code, 'MISSING_NEXT');
    return true;
  });
});
