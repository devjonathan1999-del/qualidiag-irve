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

test('prévoit un écran sûr pour les parcours incomplets', async () => {
  const ui = await readFile(new URL('app/ui.js', root), 'utf8');
  const main = await readFile(new URL('app/main.js', root), 'utf8');
  assert.match(ui, /Parcours incomplet — transmettre au Service Technique/);
  assert.match(main, /GraphError/);
});
