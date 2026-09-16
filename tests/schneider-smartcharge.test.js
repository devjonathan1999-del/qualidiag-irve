import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applySchneiderChargePolicy } from '../app/data.js';

async function loadJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

async function effectiveSchneiderNodes() {
  const nodes = await loadJson('../data/diagnostics/schneider-charge.json');
  const chargePolicy = await loadJson('../data/schneider-charge-policy.json');
  const wiserPolicy = await loadJson('../data/schneider-wiser-policy.json');
  const smartchargePolicy = await loadJson('../data/schneider-smartcharge-policy.json');
  let effective = applySchneiderChargePolicy(nodes, chargePolicy);
  effective = applySchneiderChargePolicy(effective, wiserPolicy);
  return applySchneiderChargePolicy(effective, smartchargePolicy);
}

test('le menu principal Schneider Charge est validé métier', async () => {
  const effective = await effectiveSchneiderNodes();
  const menu = effective.find(node => node.id === 'F-082');

  assert.ok(menu);
  assert.equal(menu.validation, 'valide');
  assert.match(menu.source, /validation métier/i);
});

test('Smartcharge commence par distinguer usage et problème technique', async () => {
  const effective = await effectiveSchneiderNodes();
  const smartcharge = effective.find(node => node.id === 'F-083');

  assert.equal(smartcharge.title, 'Quel est le problème rencontré avec Smartcharge ?');
  assert.deepEqual(smartcharge.answers.map(answer => answer.id), ['usage', 'technical']);
  assert.equal(smartcharge.validation, 'valide');
});

test('la branche usage demande de fournir le guide sans lien SharePoint puis vérifie le résultat', async () => {
  const effective = await effectiveSchneiderNodes();
  const smartcharge = effective.find(node => node.id === 'F-083');
  const guide = effective.find(node => node.id === 'SC-SMART-USAGE-GUIDE');
  const result = effective.find(node => node.id === 'SC-SMART-USAGE-RESULT');

  assert.equal(smartcharge.answers.find(answer => answer.id === 'usage').next, 'SC-SMART-USAGE-GUIDE');
  assert.match(guide.body, /fournir|transmettre/i);
  assert.match(guide.body, /guide d.?utilisation.*Smartcharge/i);
  assert.doesNotMatch(guide.body, /sharepoint|https?:\/\//i);
  assert.equal(guide.answers[0].next, 'SC-SMART-USAGE-RESULT');
  assert.match(result.title, /problème.*résolu.*guide/i);
  assert.equal(result.answers.find(answer => answer.id === 'resolved').next, 'END-RESOLVED');
  assert.equal(result.answers.find(answer => answer.id === 'not-resolved').next, 'END-TRANSFER');
});

test('le parcours Schneider Smartcharge validé ne contient aucun lien SharePoint', async () => {
  const effective = await effectiveSchneiderNodes();
  const ids = [
    'F-083',
    'SC-SMART-USAGE-GUIDE',
    'SC-SMART-USAGE-RESULT',
    'SC-SMART-TECH-CAPTURE',
    'SC-SMART-TECH-CONNECTIVITY'
  ];
  const nodes = ids.map(id => effective.find(node => node.id === id));

  assert.ok(nodes.every(Boolean));
  assert.doesNotMatch(JSON.stringify(nodes), /sharepoint/i);
});

test('la branche technique demande une capture puis vérifie la connexion Internet', async () => {
  const effective = await effectiveSchneiderNodes();
  const smartcharge = effective.find(node => node.id === 'F-083');
  const capture = effective.find(node => node.id === 'SC-SMART-TECH-CAPTURE');
  const connectivity = effective.find(node => node.id === 'SC-SMART-TECH-CONNECTIVITY');

  assert.equal(smartcharge.answers.find(answer => answer.id === 'technical').next, 'SC-SMART-TECH-CAPTURE');
  assert.match(capture.body, /capture d.?écran/i);
  assert.equal(capture.answers[0].next, 'SC-SMART-TECH-CONNECTIVITY');
  assert.match(connectivity.title, /connectée? à Internet/i);
  assert.equal(connectivity.answers.find(answer => answer.id === 'connected').next, 'END-TRANSFER');
  assert.equal(connectivity.answers.find(answer => answer.id === 'not-connected').next, 'F-091');
});
