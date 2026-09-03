const DRAFT_KEY = 'qualidiag:draft:v1';

export function saveDraft(storage, session) {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(session));
  } catch {
    // Le stockage local ne doit jamais bloquer la qualification.
  }
}

export function loadDraft(storage) {
  let raw;
  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    try {
      storage.removeItem(DRAFT_KEY);
    } catch {
      // Ignoré : la qualification reste utilisable.
    }
    return null;
  }
}

export function clearDraft(storage) {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // Le stockage local ne doit jamais bloquer la qualification.
  }
}
