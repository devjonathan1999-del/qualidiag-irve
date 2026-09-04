import { buildSalesforceSummary } from './summary.js';

const INPUTS_BY_NODE = {
  'A-AC-NONCONFORME': {
    type: 'textarea',
    key: 'autocontrol.nonConformity',
    label: 'Motif de non-conformité',
    placeholder: 'Décrivez la non-conformité constatée…',
    required: true
  }
};

function contextView(context = {}) {
  return {
    brand: context.brand ?? null,
    model: context.model ?? null,
    symptom: context.symptom ?? null
  };
}

function resolveBody(node, context = {}) {
  if (!node.bodyByContext) return node.body ?? '';
  const { key, keys, separator = '|', values = {}, fallback = '' } = node.bodyByContext;
  const lookup = Array.isArray(keys) && keys.length
    ? keys.map(item => context[item] ?? '').join(separator)
    : context[key];
  return values[lookup] ?? fallback;
}

function resolveInput(node, context = {}) {
  const input = node.input ?? INPUTS_BY_NODE[node.id];
  if (!input) return null;
  return {
    ...input,
    value: context[input.key] ?? ''
  };
}

export function toViewModel(node, session, data) {
  const common = {
    id: node.id,
    title: node.title ?? '',
    body: resolveBody(node, session?.context),
    input: resolveInput(node, session?.context),
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
