import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, recordAnswer, goBack, restartSession } from '../app/session.js';

const node = { id: 'Q-PHASE', title: 'Installation ?' };
const answer = {
  id: 'mono', label: 'Monophasée', next: 'Q-POWER',
  set: { 'installation.phase': 'Monophasée' },
  check: 'Installation monophasée confirmée'
};

test('enregistre le choix et le contexte', () => {
  const session = recordAnswer(createSession('Q-PHASE'), node, answer);
  assert.equal(session.currentNodeId, 'Q-POWER');
  assert.equal(session.context['installation.phase'], 'Monophasée');
  assert.deepEqual(session.checks, ['Installation monophasée confirmée']);
  assert.equal(session.history.length, 1);
});

test('retour restaure le contexte précédent', () => {
  const initial = createSession('Q-PHASE');
  const advanced = recordAnswer(initial, node, answer);
  const restored = goBack(advanced);
  assert.equal(restored.currentNodeId, 'Q-PHASE');
  assert.equal(restored.context['installation.phase'], undefined);
});

test('deux retours successifs restaurent chaque état', () => {
  const first = createSession('Q1');
  const s1 = recordAnswer(first, { id: 'Q1' }, { id: 'a', label: 'A', next: 'Q2', set: { first: 'A' } });
  const s2 = recordAnswer(s1, { id: 'Q2' }, { id: 'b', label: 'B', next: 'Q3', set: { second: 'B' } });
  const back1 = goBack(s2);
  assert.equal(back1.currentNodeId, 'Q2');
  assert.equal(back1.context.second, undefined);
  assert.equal(back1.context.first, 'A');
  const back2 = goBack(back1);
  assert.equal(back2.currentNodeId, 'Q1');
  assert.deepEqual(back2.context, {});
});

test('retour au début ne lève pas et recommencer crée une nouvelle session', () => {
  const initial = createSession('START');
  assert.equal(goBack(initial), initial);
  const restarted = restartSession('START');
  assert.equal(restarted.currentNodeId, 'START');
  assert.deepEqual(restarted.history, []);
});
