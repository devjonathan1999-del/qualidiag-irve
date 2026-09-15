import { loadData, validateData } from './data.js?v=20260915-1';
import { buildGraph, getNode, resolveAnswer, GraphError } from './engine.js?v=20260915-1';
import { createSession, recordAnswer, goBack, restartSession } from './session.js?v=20260915-1';
import { saveDraft, loadDraft, clearDraft } from './storage.js?v=20260915-1';
import { buildSalesforceSummary } from './summary.js?v=20260915-1';
import { toViewModel } from './presenter.js?v=20260915-1';
import { render, renderDraftPrompt, renderFatalDataError, renderGraphError } from './ui.js?v=20260915-1';

const root = document.querySelector('#app');
let data;
let graph;
let session;

function copyText(text, statusElement) {
  const failMessage = 'Copie automatique impossible — sélectionnez le texte.';
  if (!navigator.clipboard?.writeText) {
    if (statusElement) statusElement.textContent = failMessage;
    return;
  }
  navigator.clipboard.writeText(text)
    .then(() => { if (statusElement) statusElement.textContent = 'Résumé copié.'; })
    .catch(() => { if (statusElement) statusElement.textContent = failMessage; });
}

function conclusionById(id) {
  return data.conclusions.find(item => item.id === id);
}

function refresh() {
  const node = getNode(graph, session.currentNodeId);
  const view = toViewModel(node, session, {
    canGoBack: session.history.length > 0,
    conclusions: data.conclusions
  });
  render(root, view, {
    onAnswer(answerId, inputValue) {
      session = recordAnswer(graph, session, answerId, inputValue);
      saveDraft(session);
      refresh();
    },
    onBack() {
      session = goBack(session);
      saveDraft(session);
      refresh();
    },
    onRestart() {
      clearDraft();
      session = restartSession(data.startNodeId ?? 'START');
      saveDraft(session);
      refresh();
    },
    onCopy(summary, statusElement) {
      copyText(summary, statusElement);
    }
  });
}

function startNew() {
  session = createSession(data.startNodeId ?? 'START');
  saveDraft(session);
  refresh();
}

async function bootstrap() {
  try {
    data = await loadData();
    const errors = validateData(data);
    if (errors.length) {
      renderFatalDataError(root, errors);
      return;
    }
    graph = buildGraph(data.nodes);
    const draft = loadDraft();
    if (draft?.currentNodeId && graph.has(draft.currentNodeId)) {
      renderDraftPrompt(root, {
        onResume() {
          session = draft;
          refresh();
        },
        onRestart() {
          clearDraft();
          startNew();
        }
      });
      return;
    }
    startNew();
  } catch (error) {
    if (error instanceof GraphError) {
      renderGraphError(root, error);
      return;
    }
    renderFatalDataError(root, [error.message ?? String(error)]);
  }
}

bootstrap();
