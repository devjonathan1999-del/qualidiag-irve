import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as ui from '../app/ui.js';

test('le contexte est présenté comme un fil d’Ariane compact', () => {
  assert.equal(typeof ui.contextMarkup, 'function');
  const html = ui.contextMarkup({
    brand: 'Vestel IZI by EDF',
    model: 'BASIC non connectée Izi by EDF',
    symptom: 'Installation disjoncte'
  });

  assert.match(html, /context-breadcrumb/);
  assert.match(html, /aria-label="Contexte du diagnostic"/);
  assert.match(html, /context-separator/);
  assert.match(html, /Vestel IZI by EDF/);
  assert.match(html, /Installation disjoncte/);
});

test('le texte d’aide est isolé dans un bloc lisible', () => {
  assert.equal(typeof ui.bodyMarkup, 'function');
  const html = ui.bodyMarkup('Monophasé :\n9 kVA → 45 A\n\nTriphasé :\n15 kVA → 25 A');

  assert.match(html, /body-panel/);
  assert.match(html, /body-copy/);
  assert.match(html, /Monophasé/);
  assert.match(html, /Triphasé/);
});

test('la feuille de style prévoit une grille de réponses responsive et conserve les retours à la ligne', async () => {
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');

  assert.match(css, /\.answers\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/s);
  assert.match(css, /\.body-copy\s*\{[^}]*white-space:\s*pre-line/s);
  assert.match(css, /\.context-breadcrumb/);
  assert.match(css, /\.body-panel/);
});

test('la carte principale est plus large mais visuellement plus compacte', async () => {
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');

  assert.match(css, /\.shell\s*\{[^}]*width:\s*min\(1040px,/s);
  assert.match(css, /\.card\s*\{[^}]*border-radius:\s*18px/s);
  assert.match(css, /\.app-header\s*\{[^}]*margin-bottom:\s*14px/s);
});
