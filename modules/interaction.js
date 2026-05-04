import { state, seq, curImage, MIN_BOX, $ } from './state.js';
import { history } from './history.js';
import { toast, setStatus, setCursor, setBoxInfo } from './ui.js';
import {
  pane, canvas, getSelection, setSelection, getDraft, setDraft,
  toImage, toScreen, requestDraw, resetView, normalizeBox,
  hitTest, resizeBox, changeZoom, syncZoomUI,
} from './canvas.js';
import { goTo, renderImages, updateStats } from './images.js';
import { renderClasses, highlightActiveClass, syncClassSelector } from './classes.js';
import { saveStorage } from './storage.js';
import { refreshAll }  from './refresh.js';

const _mouse = { x: 0, y: 0, down: false, btn: 0 };
let _dragMode = null;
let _didDrag  = false;

export function initInteraction() {
  // Drag-and-drop de ficheiros
  pane.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  pane.addEventListener('drop',     e => { e.preventDefault(); import('./images.js').then(m => m.addImages(e.dataTransfer.files)); });

  pane.addEventListener('mousemove', _onMouseMove);
  pane.addEventListener('mousedown', _onMouseDown);
  pane.addEventListener('mouseup',   _onMouseUp);
  pane.addEventListener('wheel',     _onWheel, { passive: false });
  pane.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', _onKeyDown);

  document.querySelector('#toolSelect').addEventListener('click', () => setTool('select'));
  document.querySelector('#toolBox').addEventListener('click',    () => setTool('box'));

  document.querySelector('#zoomRange').addEventListener('input', e => {
    state.zoom = +e.target.value;
    document.querySelector('#zoomLabel').textContent = (state.zoom * 100).toFixed(0) + '%';
    requestDraw();
  });

  document.querySelector('#toggleGrid').addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    document.querySelector('#toggleGrid').classList.toggle('active', state.showGrid);
    requestDraw();
  });
  document.querySelector('#toggleLabels').addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    document.querySelector('#toggleLabels').classList.toggle('active', state.showLabels);
    requestDraw();
  });
}

function _onMouseMove(e) {
  const rect = pane.getBoundingClientRect();
  _mouse.x = e.clientX - rect.left;
  _mouse.y = e.clientY - rect.top;
  const [ix, iy] = toImage(_mouse.x, _mouse.y);
  setCursor(ix, iy);

  if (!_mouse.down && state.tool === 'select') {
    const hit = hitTest(ix, iy);
    pane.style.cursor = hit ? (hit.part === 'move' ? 'move' : _handleCursor(hit.part)) : 'default';
  }
  if (!_mouse.down) return;

  if (_mouse.btn === 2) {
    state.panX += e.movementX; state.panY += e.movementY; requestDraw(); return;
  }

  if (state.tool === 'box' && getDraft()) {
    _didDrag = true; // apenas marca que houve movimento; push feito só no mouseup se a caixa for válida
    const d = getDraft();
    d.w = toImage(_mouse.x, 0)[0] - d.x;
    d.h = toImage(0, _mouse.y)[1] - d.y;
    requestDraw(); return;
  }

  const sel = getSelection();
  if (state.tool === 'select' && sel && _dragMode) {
    if (!_didDrag) { history.push(); _didDrag = true; }
    if (_dragMode === 'move') {
      sel.x += e.movementX / state.zoom;
      sel.y += e.movementY / state.zoom;
    } else {
      resizeBox(sel, _dragMode, ix, iy);
    }
    const nb = normalizeBox(sel);
    setBoxInfo(`${nb.w | 0} × ${nb.h | 0} px`);
    requestDraw();
  }
}

function _onMouseDown(e) {
  e.preventDefault();
  _mouse.down = true; _mouse.btn = e.button === 2 ? 2 : 1; _didDrag = false;
  if (_mouse.btn === 2) return;
  const [ix, iy] = toImage(_mouse.x, _mouse.y);

  if (state.tool === 'box') {
    if (!state.activeClassId) { toast('Seleciona uma classe primeiro'); return; }
    setDraft({ x: ix, y: iy, w: 0, h: 0, clsId: state.activeClassId });
  } else {
    const hit = hitTest(ix, iy);
    setSelection(hit?.box ?? null);
    _dragMode = hit?.part ?? null;
    if (!getSelection()) setBoxInfo('');
    requestDraw();
  }
}

function _onMouseUp() {
  const im  = curImage();
  const dft = getDraft();
  if (_mouse.btn === 1 && state.tool === 'box' && dft && im) {
    const nb = normalizeBox(dft);
    if (nb.w > MIN_BOX && nb.h > MIN_BOX) {
      history.push(); // push apenas para caixas válidas
      nb.id = seq.box++; nb.clsId = dft.clsId;
      im.boxes.push(nb); setSelection(nb);
      setBoxInfo(`${nb.w | 0} × ${nb.h | 0} px`);
      setStatus('Caixa criada');
      renderImages(); updateStats(); saveStorage();
    }
    setDraft(null); requestDraw();
  }
  const sel = getSelection();
  if (sel && _didDrag) { Object.assign(sel, normalizeBox(sel)); saveStorage(); }
  _mouse.down = false; _dragMode = null; _didDrag = false;
}

function _onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const [ix, iy] = toImage(_mouse.x, _mouse.y);
  state.zoom = Math.min(10, Math.max(0.05, state.zoom * factor));
  syncZoomUI();
  const [sx, sy] = toScreen(ix, iy);
  state.panX += _mouse.x - sx; state.panY += _mouse.y - sy;
  requestDraw();
}

function _onKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const ctrl = e.ctrlKey || e.metaKey;
  const im   = curImage();
  const sel  = getSelection();

  if (ctrl && e.key === 'z') { e.preventDefault(); history.undo(); return; }
  if (ctrl && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); history.redo(); return; }

  if (ctrl && e.key === 'c') {
    if (sel) { state.clipboard = { ...normalizeBox(sel) }; toast('Caixa copiada'); } return;
  }
  if (ctrl && e.key === 'v') {
    if (state.clipboard && im) {
      history.push();
      const b = { ...state.clipboard, id: seq.box++, x: state.clipboard.x + 10, y: state.clipboard.y + 10 };
      im.boxes.push(b); setSelection(b);
      requestDraw(); renderImages(); updateStats(); saveStorage(); toast('Caixa colada');
    } return;
  }
  if (ctrl && e.key === 'd') {
    e.preventDefault();
    if (sel && im) {
      history.push();
      const b = { ...normalizeBox(sel), id: seq.box++, x: sel.x + 10, y: sel.y + 10 };
      im.boxes.push(b); setSelection(b);
      requestDraw(); renderImages(); updateStats(); saveStorage(); toast('Caixa duplicada');
    } return;
  }

  if (e.key === 'ArrowRight' && !ctrl) { goTo(+1); return; }
  if (e.key === 'ArrowLeft'  && !ctrl) { goTo(-1); return; }

  if ((e.key === 'Delete' || e.key === 'Backspace') && sel && im) {
    history.push();
    im.boxes = im.boxes.filter(b => b !== sel);
    setSelection(null); setBoxInfo('');
    requestDraw(); renderImages(); updateStats(); saveStorage(); return;
  }

  if (e.key === 'Tab' && im?.boxes.length) {
    e.preventDefault();
    const i = im.boxes.indexOf(sel);
    const next = im.boxes[(i + 1) % im.boxes.length];
    setSelection(next);
    const nb = normalizeBox(next);
    setBoxInfo(`${nb.w | 0} × ${nb.h | 0} px`);
    requestDraw(); return;
  }

  const k = e.key.toLowerCase();
  if (k === 'v') { setTool('select'); return; }
  if (k === 'b') { setTool('box');    return; }
  if (k === 'f') { resetView(); requestDraw(); return; }
  if (k === '+' || k === '=') { changeZoom(1.15); return; }
  if (k === '-')               { changeZoom(1 / 1.15); return; }
  if (k === 'r' && sel && state.activeClassId != null) {
    history.push(); sel.clsId = state.activeClassId;
    requestDraw(); renderClasses(); updateStats(); saveStorage(); toast('Classe reatribuída'); return;
  }

  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 9 && state.classes[num - 1]) {
    state.activeClassId = state.classes[num - 1].id;
    highlightActiveClass(); syncClassSelector();
    setStatus(`Classe ativa: ${state.classes[num - 1].name}`);
  }
}

export function setTool(t) {
  state.tool = t;
  document.querySelectorAll('.toggle[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  pane.style.cursor = t === 'box' ? 'crosshair' : 'default';
}

function _handleCursor(part) {
  if (part === 'resize-tl' || part === 'resize-br') return 'nwse-resize';
  if (part === 'resize-tr' || part === 'resize-bl') return 'nesw-resize';
  return 'default';
}
