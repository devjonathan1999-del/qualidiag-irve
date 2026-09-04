import test from 'node:test';
import assert from 'node:assert/strict';
import { NODE_FILES } from '../app/data.js';

test('charge une source de diagnostic séparée par famille', () => {
  assert.deepEqual(NODE_FILES, [
    'diagnostics/common.json',
    'diagnostics/vestel.json',
    'diagnostics/wallbox.json',
    'diagnostics/free2move.json',
    'diagnostics/hager.json',
    'diagnostics/schneider-charge.json',
    'diagnostics/schneider-charge-pro.json'
  ]);
});
