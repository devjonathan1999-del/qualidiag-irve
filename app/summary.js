export function buildSalesforceSummary(session, conclusion = {}) {
  const context = session?.context ?? {};
  const lines = ['QUALIFICATION QUALIDIAG'];
  const fields = [
    ['Installation', context['installation.phase']],
    ['Abonnement', context['installation.power']],
    ['Borne', context.brand],
    ['Modèle', context.model],
    ['Symptôme', context.symptom]
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
