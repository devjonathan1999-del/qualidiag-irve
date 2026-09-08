import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const CACHE_VERSION = '20260908-3';

test('index charge le CSS et le module principal avec une version de cache', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /styles\/app\.css\?v=[^"']+/);
  assert.match(html, new RegExp(`app\\/main\\.js\\?v=${CACHE_VERSION}`));
  assert.match(html, /id="app"/);
});

test('les modules applicatifs et les données évitent les ressources périmées', async () => {
  const main = await readFile(new URL('app/main.js', root), 'utf8');
  const data = await readFile(new URL('app/data.js', root), 'utf8');

  assert.match(main, new RegExp(`from '\\.\\/ui\\.js\\?v=${CACHE_VERSION}'`));
  assert.match(main, new RegExp(`from '\\.\\/data\\.js\\?v=${CACHE_VERSION}'`));
  assert.match(main, new RegExp(`from '\\.\\/engine\\.js\\?v=${CACHE_VERSION}'`));
  assert.match(data, /fetch\(new URL\(file, base\),\s*\{\s*cache:\s*'no-store'\s*\}\)/s);
});

test('prévoit un écran sûr pour les parcours incomplets', async () => {
  const ui = await readFile(new URL('app/ui.js', root), 'utf8');
  const main = await readFile(new URL('app/main.js', root), 'utf8');
  assert.match(ui, /Parcours incomplet — transmettre au Service Technique/);
  assert.match(main, /GraphError/);
});
