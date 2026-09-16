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

test('la refonte privilégie une lecture verticale sur desktop comme sur mobile', async () => {
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');

  assert.match(css, /\.shell\s*\{[^}]*width:\s*min\(760px,/s);
  assert.match(css, /\.answers\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.body-copy\s*\{[^}]*white-space:\s*pre-line/s);
  assert.match(css, /\.context-breadcrumb/);
  assert.match(css, /\.body-panel/);
});

test('la palette est sobre avec un bleu ardoise et un accent turquoise doux', async () => {
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');

  assert.match(css, /--ink:\s*#17324f/i);
  assert.match(css, /--accent:\s*#2aa7a1/i);
  assert.match(css, /--surface:\s*#f8fafb/i);
  assert.match(css, /button:focus-visible[^}]*outline:\s*3px solid var\(--accent\)/s);
});

test('l’accueil reprend les cartes verticales enrichies de la maquette validée', async () => {
  const css = await readFile(new URL('../styles/app.css', import.meta.url), 'utf8');

  assert.match(css, /#app:has\(\.answer\[data-answer="complaint"\]\)/);
  assert.match(css, /Signalez un problème rencontré par un client et accédez au diagnostic adapté\./);
  assert.match(css, /Consultez prochainement des ressources et informations générales\./);
  assert.doesNotMatch(css, /DES DIAGNOSTICS FIABLES/i);
});
