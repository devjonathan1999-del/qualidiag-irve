import { buildSalesforceSummary } from './summary.js';

function contextView(context = {}) {
  return {
    brand: context.brand ?? null,
    model: context.model ?? null,
    symptom: context.symptom ?? null
  };
}

function resolveBody(node, context = {}) {
  if (!node.bodyByContext) return node.body ?? '';
  const { key, values = {}, fallback = '' } = node.bodyByContext;
  return values[context[key]] ?? fallback;
}

export function toViewModel(node, session, data) {
  const common = {
    id: node.id,
    title: node.title ?? '',
    body: resolveBody(node, session?.context),
    canGoBack: (session?.history?.length ?? 0) > 0,
    context: contextView(session?.context)
  };

  if (node.type === 'conclusion') {
    const conclusion = data?.conclusions?.find(item => item.id === node.conclusionId) ?? {
      id: node.conclusionId,
      title: 'Conclusion indisponible'
    };
    return {
      ...common,
      kind: 'conclusion',
      title: conclusion.title,
      conclusion,
      summary: buildSalesforceSummary(session, conclusion),
      answers: []
    };
  }

  return {
    ...common,
    kind: node.type === 'action' ? 'action' : 'question',
    answers: (node.answers ?? []).map(answer => ({
      id: answer.id,
      label: answer.label,
      disabled: Boolean(answer.disabled)
    }))
  };
}
