import { state, seq, MAX_HISTORY } from './state.js';
import { refreshAll } from './refresh.js';
import { toast }      from './ui.js';

const _past = [], _future = [];

function _snapshot() {
  return {
    classes:       state.classes.map(c => ({ ...c })),
    images:        state.images.map(im => ({ ...im, boxes: im.boxes.map(b => ({ ...b })) })),
    activeClassId: state.activeClassId,
    seq:           { ...seq },
  };
}

function _restore(snap) {
  state.classes       = snap.classes.map(c => ({ ...c }));
  state.images        = snap.images.map(im => ({ ...im, boxes: im.boxes.map(b => ({ ...b })) }));
  state.activeClassId = snap.activeClassId;
  Object.assign(seq, snap.seq);
}

export const history = {
  push() {
    _past.push(_snapshot());
    if (_past.length > MAX_HISTORY) _past.shift();
    _future.length = 0;
  },
  undo() {
    if (!_past.length) { toast('Nada para desfazer'); return; }
    _future.push(_snapshot());
    _restore(_past.pop());
    refreshAll();
    toast('Desfeito');
  },
  redo() {
    if (!_future.length) { toast('Nada para refazer'); return; }
    _past.push(_snapshot());
    _restore(_future.pop());
    refreshAll();
    toast('Refeito');
  },
  clear() { _past.length = 0; _future.length = 0; },
};
