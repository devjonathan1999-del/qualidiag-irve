export function buildSalesforceSummary(session, conclusion = {}) {
  const context = session?.context ?? {};
  const lines = ['QUALIFICATION QUALIDIAG'];
  const fields = [
    ['Installation', context['installation.phase']],
    ['Abonnement', context['installation.power']],
    ['Autocontrôle inexploitable', context['autocontrol.unusableReason']],
    ['Réintervention', context['autocontrol.reintervention']],
    ['Non-conformité AC', context['autocontrol.nonConformity']],
    ['Véhicule', context['vehicle.model']],
    ['Borne', context.brand],
    ['Modèle', context.model],
    ['Symptôme', context.symptom],
    ['Informations complémentaires', context['final.additionalInfo']]
  ];

  for (const [label, value] of fields) {
    if (value) lines.push(`${label} : ${value}`);
  }

  const checks = Array.isArray(session?.checks) ? session.checks.filter(Boolean) : [];
  if (checks.length) {
    lines.push('', 'Vérifications réalisées :');
    for (const check of checks) lines.push(`- ${check}`);
  }

  if (conclusion?.title) lines.push('', `Conclusion : ${conclusion.title}`);
  return lines.join('\n');
}
