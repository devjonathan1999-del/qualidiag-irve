import { loadData, validateData } from './data.js';
import { buildGraph, getNode, resolveAnswer, GraphError } from './engine.js';
import { createSession, recordAnswer, goBack, restartSession } from './session.js';
import { saveDraft, loadDraft, clearDraft } from './storage.js';
import { buildSalesforceSummary } from './summary.js';
import { toViewModel } from './presenter.js';
import { render, renderDraftPrompt, renderFatalDataError, renderGraphError } from './ui.js';

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
  return data?.conclusions?.find(item => item.id === id) ?? { title: 'Transmission Service Technique' };
}

function showGraphError(error) {
  console.error(error);
  const partial = buildSalesforceSummary(session ?? { context: {}, checks: [] }, conclusionById('TRANSFER_TECH'));
  renderGraphError(root, partial, { onCopySummary: copyText, onRestart: restart });
}

function restart() {
  clearDraft(localStorage);
  session = restartSession('START');
  renderCurrent();
}

function renderCurrent() {
  try {
    const node = getNode(graph, session.currentNodeId);
    const viewModel = toViewModel(node, session, data);
    render(root, viewModel, {
      onAnswer(answerId) {
        try {
          const result = resolveAnswer(graph, session.currentNodeId, answerId);
          session = recordAnswer(session, result.node, result.answer);
          saveDraft(localStorage, session);
          renderCurrent();
        } catch (error) {
          if (error instanceof GraphError) showGraphError(error);
          else throw error;
        }
      },
      onBack() {
        session = goBack(session);
        saveDraft(localStorage, session);
        renderCurrent();
      },
      onRestart: restart,
      onCopySummary: copyText
    });
  } catch (error) {
    if (error instanceof GraphError) showGraphError(error);
    else throw error;
  }
}

function offerDraftOrStart() {
  const draft = loadDraft(localStorage);
  if (draft?.currentNodeId) {
    renderDraftPrompt(root, draft, {
      onResumeDraft() {
        session = draft;
        renderCurrent();
      },
      onDiscardDraft() {
        clearDraft(localStorage);
        session = createSession('START');
        renderCurrent();
      }
    });
    return;
  }
  session = createSession('START');
  renderCurrent();
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
    offerDraftOrStart();
  } catch (error) {
    renderFatalDataError(root, [error?.message ?? String(error)]);
  }
}

bootstrap();
