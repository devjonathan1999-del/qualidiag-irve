function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function contextMarkup(context = {}) {
  const items = [context.brand, context.model, context.symptom].filter(Boolean);
  if (!items.length) return '';
  return `<div class="context" aria-label="Contexte du diagnostic">${items.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`;
}

export function answerButtons(answers = []) {
  return answers.map(answer => {
    const disabled = answer.disabled ? ' disabled aria-disabled="true"' : '';
    return `<button class="answer" type="button" data-answer="${escapeHtml(answer.id)}"${disabled}>${escapeHtml(answer.label)}</button>`;
  }).join('');
}

function inputMarkup(input) {
  if (!input) return '';
  const required = input.required ? ' required' : '';
  const placeholder = input.placeholder ? ` placeholder="${escapeHtml(input.placeholder)}"` : '';
  if (input.type === 'textarea') {
    return `<div class="field-group">
      <label class="field-label" for="qualidiag-input">${escapeHtml(input.label ?? 'Complément')}</label>
      <textarea id="qualidiag-input" class="field-input" data-input data-input-key="${escapeHtml(input.key)}" rows="5"${required}${placeholder}>${escapeHtml(input.value ?? '')}</textarea>
      <p class="field-error" data-input-error aria-live="polite"></p>
    </div>`;
  }
  return '';
}

function shell(content) {
  return `<section class="shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">Qualification SAV IRVE</p>
        <h1>QualiDiag IRVE</h1>
      </div>
      <span class="version">Pilote V1</span>
    </header>
    ${content}
  </section>`;
}

export function render(root, viewModel, handlers = {}) {
  const isConclusion = viewModel.kind === 'conclusion';
  const controls = isConclusion
    ? `<div class="actions">
         <button class="primary" type="button" data-copy>Copier pour Salesforce</button>
         <button class="secondary" type="button" data-restart>Nouvelle qualification</button>
       </div>`
    : `<div class="answers">${answerButtons(viewModel.answers)}</div>`;

  root.innerHTML = shell(`
    ${contextMarkup(viewModel.context)}
    <article class="card ${escapeHtml(viewModel.kind)}">
      <div class="kind-badge">${viewModel.kind === 'action' ? 'Action' : viewModel.kind === 'conclusion' ? 'Conclusion' : 'Question'}</div>
      <h2>${escapeHtml(viewModel.title)}</h2>
      ${viewModel.body ? `<p class="body-copy">${escapeHtml(viewModel.body)}</p>` : ''}
      ${!isConclusion ? inputMarkup(viewModel.input) : ''}
      ${isConclusion ? `<textarea class="summary" readonly aria-label="Résumé Salesforce">${escapeHtml(viewModel.summary)}</textarea><p class="copy-status" data-copy-status aria-live="polite"></p>` : ''}
      ${controls}
      ${viewModel.canGoBack && !isConclusion ? '<button class="back" type="button" data-back>← Retour</button>' : ''}
    </article>
  `);

  const inputElement = root.querySelector('[data-input]');
  const inputError = root.querySelector('[data-input-error]');
  inputElement?.addEventListener('input', () => {
    if (inputError) inputError.textContent = '';
  });

  root.querySelectorAll('[data-answer]').forEach(button => {
    button.addEventListener('click', () => {
      const fieldSet = {};
      if (viewModel.input && inputElement) {
        const value = inputElement.value.trim();
        if (viewModel.input.required && !value) {
          if (inputError) inputError.textContent = 'Ce champ est obligatoire.';
          inputElement.focus();
          return;
        }
        fieldSet[viewModel.input.key] = value;
      }
      handlers.onAnswer?.(button.dataset.answer, fieldSet);
    });
  });
  root.querySelector('[data-back]')?.addEventListener('click', () => handlers.onBack?.());
  root.querySelector('[data-restart]')?.addEventListener('click', () => handlers.onRestart?.());
  root.querySelector('[data-copy]')?.addEventListener('click', () => handlers.onCopySummary?.(viewModel.summary, root.querySelector('[data-copy-status]')));
}

export function renderDraftPrompt(root, draft, handlers = {}) {
  const context = draft?.context ?? {};
  const details = [context.brand, context.model, context.symptom].filter(Boolean).join(' · ') || 'Qualification en cours';
  root.innerHTML = shell(`
    <article class="card">
      <div class="kind-badge">Brouillon local</div>
      <h2>Une qualification était en cours</h2>
      <p class="body-copy">${escapeHtml(details)}</p>
      <div class="actions">
        <button class="primary" type="button" data-resume>Reprendre la qualification</button>
        <button class="secondary" type="button" data-discard>Nouvelle qualification</button>
      </div>
    </article>
  `);
  root.querySelector('[data-resume]')?.addEventListener('click', () => handlers.onResumeDraft?.());
  root.querySelector('[data-discard]')?.addEventListener('click', () => handlers.onDiscardDraft?.());
}

export function renderFatalDataError(root, errors = []) {
  root.innerHTML = shell(`
    <article class="card error-card">
      <div class="kind-badge">Erreur</div>
      <h2>Impossible de charger la base QualiDiag.</h2>
      ${errors.length ? `<ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}
    </article>
  `);
}

export function renderGraphError(root, summary, handlers = {}) {
  root.innerHTML = shell(`
    <article class="card error-card">
      <div class="kind-badge">Parcours incomplet</div>
      <h2>Parcours incomplet — transmettre au Service Technique</h2>
      <p class="body-copy">Les réponses déjà renseignées sont conservées.</p>
      <textarea class="summary" readonly aria-label="Résumé partiel">${escapeHtml(summary)}</textarea>
      <p class="copy-status" data-copy-status aria-live="polite"></p>
      <div class="actions">
        <button class="primary" type="button" data-copy-partial>Copier le résumé partiel</button>
        <button class="secondary" type="button" data-restart>Nouvelle qualification</button>
      </div>
    </article>
  `);
  root.querySelector('[data-copy-partial]')?.addEventListener('click', () => handlers.onCopySummary?.(summary, root.querySelector('[data-copy-status]')));
  root.querySelector('[data-restart]')?.addEventListener('click', () => handlers.onRestart?.());
}
