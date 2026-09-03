import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDraft, loadDraft, clearDraft } from '../app/storage.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('sauvegarde, recharge et efface le brouillon', () => {
  const storage = memoryStorage();
  const session = { currentNodeId: 'Q1', context: { brand: 'Schneider Charge' } };
  saveDraft(storage, session);
  assert.deepEqual(loadDraft(storage), session);
  clearDraft(storage);
  assert.equal(loadDraft(storage), null);
});

test('supprime un brouillon JSON corrompu', () => {
  const storage = memoryStorage();
  storage.setItem('qualidiag:draft:v1', '{');
  assert.equal(loadDraft(storage), null);
  assert.equal(storage.getItem('qualidiag:draft:v1'), null);
});

test('une erreur de stockage ne bloque pas la qualification', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  assert.doesNotThrow(() => saveDraft(broken, { currentNodeId: 'Q1' }));
  assert.equal(loadDraft(broken), null);
  assert.doesNotThrow(() => clearDraft(broken));
});
