import { state, seq, STORAGE_KEY } from './state.js';

export function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      classes:       state.classes,
      activeClassId: state.activeClassId,
      seq,
      images: state.images.map(im => ({ id: im.id, name: im.name, w: im.w, h: im.h, boxes: im.boxes })),
    }));
  } catch (_) { /* QuotaExceededError — silencioso */ }
}

export function loadStorage(onLoaded) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.classes       = data.classes       || [];
    state.activeClassId = data.activeClassId ?? state.classes[0]?.id ?? null;
    Object.assign(seq, data.seq || {});
    state.images = (data.images || []).map(im => ({ url: null, ...im, boxes: im.boxes || [] }));
    if (state.classes.length || state.images.length) onLoaded?.();
  } catch (_) { /* Storage corrompido */ }
}
