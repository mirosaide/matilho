import { $ } from './state.js';

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;

export function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 300);
  }, ms);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
let _resolve = null;

export function modal(msg, { input = false, okLabel = 'OK', defaultValue = '' } = {}) {
  return new Promise(resolve => {
    _resolve = resolve;
    $('#modalMsg').textContent  = msg;
    $('#modalOk').textContent   = okLabel;
    const inp = $('#modalInput');
    inp.hidden = !input;
    if (input) { inp.value = defaultValue; setTimeout(() => inp.focus(), 40); }
    $('#modal').hidden = false;
  });
}

function _close(value) {
  $('#modal').hidden = true;
  if (_resolve) { _resolve(value); _resolve = null; }
}

export function initModal() {
  $('#modalOk').addEventListener('click', () => {
    const inp = $('#modalInput');
    _close(inp.hidden ? true : inp.value);
  });
  $('#modalCancel').addEventListener('click', () => _close(null));
  $('#modal').addEventListener('click', e => { if (e.target === e.currentTarget) _close(null); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) _close(null);
  });
}

// ─── Barra de estado ──────────────────────────────────────────────────────────
export function setStatus(msg)     { $('#status').textContent = msg; }
export function setCursor(x, y)    { $('#cursor').textContent = `x:${x | 0} y:${y | 0}`; }
export function setBoxInfo(msg)    { $('#boxInfo').textContent = msg; }
export function setImageMeta(im) {
  if (!im) { $('#imageMeta').textContent = '—'; return; }
  const n = im.boxes.length;
  $('#imageMeta').textContent =
    `${im.name} — ${im.w}×${im.h} — ${n} anotaç${n === 1 ? 'ão' : 'ões'}`;
}
