import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesforceSummary } from '../app/summary.js';

const session = {
  context: {
    'installation.phase': 'Monophasée',
    'installation.power': '9 kVA',
    brand: 'Schneider Charge',
    model: 'Schneider Charge',
    symptom: 'Charge faible'
  },
  checks: [
    'Câble 32 A confirmé',
    'Consommation logement vérifiée',
    'Limitation véhicule vérifiée'
  ]
};

const conclusion = { title: 'Transmission Service Technique' };

test('génère un résumé lisible pour Salesforce', () => {
  const text = buildSalesforceSummary(session, conclusion);
  assert.match(text, /Installation : Monophasée/);
  assert.match(text, /Abonnement : 9 kVA/);
  assert.match(text, /Borne : Schneider Charge/);
  assert.match(text, /Symptôme : Charge faible/);
  assert.match(text, /Câble 32 A confirmé/);
  assert.match(text, /Conclusion : Transmission Service Technique/);
  assert.doesNotMatch(text, /Nom|Prénom/);
});

test('omet les champs et sections absents dans une session partielle', () => {
  const text = buildSalesforceSummary({ context: { brand: 'Schneider Charge' }, checks: [] }, { title: 'Information fournie' });
  assert.match(text, /Borne : Schneider Charge/);
  assert.doesNotMatch(text, /Modèle :/);
  assert.doesNotMatch(text, /Vérifications réalisées/);
  assert.match(text, /Conclusion : Information fournie/);
});
