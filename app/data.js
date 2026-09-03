const DATA_FILES = {
  brands: 'brands.json',
  models: 'models.json',
  nodes: 'diagnostics.json',
  procedures: 'procedures.json',
  conclusions: 'conclusions.json',
  resources: 'resources.json'
};

export async function loadData(baseUrl = '../data/') {
  const base = baseUrl instanceof URL ? baseUrl : new URL(baseUrl, import.meta.url);
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, file]) => {
    const response = await fetch(new URL(file, base));
    if (!response.ok) throw new Error(`Chargement impossible: ${file} (${response.status})`);
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
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
