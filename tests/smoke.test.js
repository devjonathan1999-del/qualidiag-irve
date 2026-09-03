import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('index charge le CSS et le module principal', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /styles\/app\.css/);
  assert.match(html, /app\/main\.js/);
  assert.match(html, /id="app"/);
});
