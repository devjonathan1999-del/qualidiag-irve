export class GraphError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GraphError';
    this.code = code;
  }
}

export function buildGraph(nodes) {
  const graph = new Map();
  for (const node of nodes) {
    if (graph.has(node.id)) {
      throw new GraphError('DUPLICATE_NODE', `Nœud dupliqué: ${node.id}`);
    }
    graph.set(node.id, node);
  }
  return graph;
}

export function getNode(graph, nodeId) {
  const node = graph.get(nodeId);
  if (!node) throw new GraphError('NODE_NOT_FOUND', `Nœud introuvable: ${nodeId}`);
  return node;
}

export function resolveAnswer(graph, nodeId, answerId) {
  const node = getNode(graph, nodeId);
  const answer = node.answers?.find(item => item.id === answerId);
  if (!answer) throw new GraphError('ANSWER_NOT_FOUND', `Réponse introuvable: ${answerId}`);
  if (!answer.next) throw new GraphError('MISSING_NEXT', `Aucune destination pour ${nodeId}/${answerId}`);
  return { node, answer, nextId: answer.next };
}
