export const NODE_FILES = [
  'diagnostics/common.json',
  'diagnostics/vestel.json',
  'diagnostics/wallbox.json',
  'diagnostics/free2move.json',
  'diagnostics/hager.json',
  'diagnostics/schneider-charge.json',
  'diagnostics/schneider-charge-pro.json'
];

const DATA_FILES = {
  brands: 'brands.json',
  models: 'models.json',
  nodes: NODE_FILES,
  powerPolicy: 'power-policy.json',
  schneiderChargePolicy: 'schneider-charge-policy.json',
  procedures: 'procedures.json',
  conclusions: 'conclusions.json',
  resources: 'resources.json'
};

async function fetchJson(file, base) {
  const response = await fetch(new URL(file, base));
  if (!response.ok) throw new Error(`Chargement impossible: ${file} (${response.status})`);
  return response.json();
}

export function applyPowerPolicy(nodes = [], policy = {}) {
  const output = nodes.map(node => ({
    ...node,
    answers: Array.isArray(node.answers) ? node.answers.map(answer => ({ ...answer })) : node.answers
  }));
  const byId = new Map(output.map(node => [node.id, node]));
  const existingIds = new Set(byId.keys());
  const alerts = [];

  for (const group of Object.values(policy ?? {})) {
    const node = byId.get(group?.nodeId);
    if (!node || !Array.isArray(node.answers)) continue;

    const allowed = new Set(group.allowed ?? []);
    const warnings = group.warnings ?? {};
    node.answers = node.answers
      .filter(answer => allowed.has(answer.id))
      .map(answer => {
        const warning = warnings[answer.id];
        if (!warning?.nodeId) return answer;

        if (!existingIds.has(warning.nodeId)) {
          alerts.push({
            id: warning.nodeId,
            type: 'action',
            title: warning.title ?? '⚠️ Alerte puissance',
            body: warning.body ?? '',
            source: 'Validation métier',
            validation: 'valide',
            answers: [{
              id: 'continue',
              label: 'J’ai vérifié, continuer',
              next: answer.next,
              check: warning.check
            }]
          });
          existingIds.add(warning.nodeId);
        }

        return { ...answer, next: warning.nodeId };
      });
  }

  return [...output, ...alerts];
}

export function applySchneiderChargePolicy(nodes = [], policy = {}) {
  const overrides = policy?.nodes ?? {};
  return nodes.map(node => {
    const override = overrides[node.id];
    if (!override) return node;
    return {
      ...node,
      ...override,
      answers: Array.isArray(override.answers)
        ? override.answers.map(answer => ({ ...answer }))
        : node.answers
    };
  });
}

export async function loadData(baseUrl = '../data/') {
  const base = baseUrl instanceof URL ? baseUrl : new URL(baseUrl, import.meta.url);
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, file]) => {
    if (Array.isArray(file)) {
      const chunks = await Promise.all(file.map(path => fetchJson(path, base)));
      return [key, chunks.flat()];
    }
    return [key, await fetchJson(file, base)];
  }));
  const data = Object.fromEntries(entries);
  data.nodes = applyPowerPolicy(data.nodes, data.powerPolicy);
  data.nodes = applySchneiderChargePolicy(data.nodes, data.schneiderChargePolicy);
  return data;
}

export function validateData(data) {
  const errors = [];
  const brands = Array.isArray(data?.brands) ? data.brands : [];
  const models = Array.isArray(data?.models) ? data.models : [];
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const conclusions = Array.isArray(data?.conclusions) ? data.conclusions : [];
  const nodeIds = new Set();
  const conclusionIds = new Set(conclusions.map(item => item.id));
  const brandIds = new Set(brands.map(item => item.id));
  const allowedTypes = new Set(['question', 'action', 'conclusion']);

  for (const node of nodes) {
    if (!node?.id) {
      errors.push('Nœud sans identifiant.');
      continue;
    }
    if (nodeIds.has(node.id)) errors.push(`Identifiant de nœud dupliqué: ${node.id}`);
    nodeIds.add(node.id);
    if (!allowedTypes.has(node.type)) errors.push(`Type de nœud invalide pour ${node.id}: ${node.type}`);
  }

  for (const node of nodes) {
    for (const answer of node.answers ?? []) {
      if (!answer.next) errors.push(`Destination absente pour ${node.id}/${answer.id ?? '?'}`);
      else if (!nodeIds.has(answer.next)) errors.push(`Destination inconnue ${answer.next} depuis ${node.id}`);
    }
    if (node.type === 'conclusion' && !conclusionIds.has(node.conclusionId)) {
      errors.push(`Conclusion inconnue ${node.conclusionId} pour ${node.id}`);
    }
  }

  for (const model of models) {
    if (!brandIds.has(model.brandId)) errors.push(`Marque inconnue ${model.brandId} pour le modèle ${model.id}`);
  }

  return errors;
}
