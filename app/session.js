function cloneContext(context) {
  return { ...context };
}

function cloneChecks(checks) {
  return [...checks];
}

export function createSession(startNodeId) {
  return {
    currentNodeId: startNodeId,
    history: [],
    context: {},
    checks: [],
    startedAt: new Date().toISOString()
  };
}

export function recordAnswer(session, node, answer) {
  const snapshot = {
    nodeId: node.id,
    context: cloneContext(session.context),
    checks: cloneChecks(session.checks)
  };
  const context = { ...session.context, ...(answer.set ?? {}) };
  const checks = answer.check ? [...session.checks, answer.check] : [...session.checks];

  return {
    ...session,
    currentNodeId: answer.next,
    history: [...session.history, snapshot],
    context,
    checks
  };
}

export function goBack(session) {
  if (!session.history.length) return session;
  const previous = session.history.at(-1);
  return {
    ...session,
    currentNodeId: previous.nodeId,
    history: session.history.slice(0, -1),
    context: cloneContext(previous.context),
    checks: cloneChecks(previous.checks)
  };
}

export function restartSession(startNodeId) {
  return createSession(startNodeId);
}
