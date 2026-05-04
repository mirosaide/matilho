import { state, imageCache, curImage, HANDLE_HIT, HANDLE_DRAW, GRID_SIZE } from './state.js';

export const canvas = document.querySelector('#stage');
export const ctx    = canvas.getContext('2d');
export const pane   = document.querySelector('#canvasPane');

// ─── Selecção e draft (lidos pelo draw; escritos por interaction) ─────────────
let _selection = null;
let _draft     = null;
export function getSelection()  { return _selection; }
export function setSelection(s) { _selection = s; }
export function getDraft()      { return _draft; }
export function setDraft(d)     { _draft = d; }

// ─── RAF ──────────────────────────────────────────────────────────────────────
let _raf = false;
export function requestDraw() {
  if (_raf) return;
  _raf = true;
  requestAnimationFrame(() => { _raf = false; draw(); });
}

// ─── Coordenadas ──────────────────────────────────────────────────────────────
export function toScreen(x, y) { return [x * state.zoom + state.panX, y * state.zoom + state.panY]; }
export function toImage(x, y)  { return [(x - state.panX) / state.zoom, (y - state.panY) / state.zoom]; }

// ─── Zoom ─────────────────────────────────────────────────────────────────────
export function fitZoom() {
  const im = curImage(); if (!im) return 1;
  const pad = 40;
  return Math.max(0.05, Math.min(
    (pane.clientWidth  - pad) / im.w,
    (pane.clientHeight - pad) / im.h,
  ));
}

export function syncZoomUI() {
  document.querySelector('#zoomRange').value = state.zoom;
  document.querySelector('#zoomLabel').textContent = (state.zoom * 100).toFixed(0) + '%';
}

export function resetView() {
  state.zoom = fitZoom();
  state.panX = 0; state.panY = 0;
  syncZoomUI();
}

export function changeZoom(factor) {
  const cx = pane.clientWidth / 2, cy = pane.clientHeight / 2;
  const [ix, iy] = toImage(cx, cy);
  state.zoom = Math.min(10, Math.max(0.05, state.zoom * factor));
  syncZoomUI();
  const [sx, sy] = toScreen(ix, iy);
  state.panX += cx - sx; state.panY += cy - sy;
  requestDraw();
}

// ─── Geometria ────────────────────────────────────────────────────────────────
export function normalizeBox(b) {
  const nb = { ...b };
  if (nb.w < 0) { nb.x += nb.w; nb.w = -nb.w; }
  if (nb.h < 0) { nb.y += nb.h; nb.h = -nb.h; }
  return nb;
}

export function hitTest(ix, iy) {
  const im = curImage(); if (!im) return null;
  const s = HANDLE_HIT / state.zoom;
  for (let i = im.boxes.length - 1; i >= 0; i--) {
    const b  = im.boxes[i];
    const nb = normalizeBox(b);
    const corners = {
      'resize-tl': [nb.x,        nb.y],
      'resize-tr': [nb.x + nb.w, nb.y],
      'resize-bl': [nb.x,        nb.y + nb.h],
      'resize-br': [nb.x + nb.w, nb.y + nb.h],
    };
    for (const [key, [px, py]] of Object.entries(corners)) {
      if (Math.abs(ix - px) <= s && Math.abs(iy - py) <= s) return { box: b, part: key };
    }
    if (ix >= nb.x && iy >= nb.y && ix <= nb.x + nb.w && iy <= nb.y + nb.h)
      return { box: b, part: 'move' };
  }
  return null;
}

export function resizeBox(b, mode, ix, iy) {
  if (mode === 'resize-tl') { b.w += b.x - ix; b.h += b.y - iy; b.x = ix; b.y = iy; }
  if (mode === 'resize-tr') { b.w = ix - b.x; b.h += b.y - iy; b.y = iy; }
  if (mode === 'resize-bl') { b.w += b.x - ix; b.x = ix; b.h = iy - b.y; }
  if (mode === 'resize-br') { b.w = ix - b.x; b.h = iy - b.y; }
}

// ─── Render principal ─────────────────────────────────────────────────────────
export function draw() {
  const im = curImage();
  const W = pane.clientWidth, H = pane.clientHeight;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  _drawGrid(W, H);
  if (!im) return;

  ctx.save();
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  _drawImage(im);
  _drawBoxes(im);
  _drawDraft();

  ctx.restore();
}

function _withAlpha(color, a) {
  return color.startsWith('hsl')
    ? color.replace(/^hsl/, 'hsla').replace(')', ` / ${a})`)
    : color;
}

function _drawGrid(W, H) {
  if (!state.showGrid) return;
  ctx.save();
  ctx.strokeStyle = '#192236'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
}

function _drawImage(im) {
  if (!im.url) {
    ctx.fillStyle = '#1a2a44';
    ctx.fillRect(0, 0, im.w || 400, im.h || 300);
    ctx.save();
    ctx.scale(1 / state.zoom, 1 / state.zoom);
    ctx.fillStyle = '#4a7aaa'; ctx.font = '14px Inter, system-ui';
    ctx.fillText('⚠  Re-abre a imagem para visualizar', 16, 32);
    ctx.restore();
    return;
  }
  let img = imageCache.get(im.url);
  if (!img) {
    img = new Image();
    img.onload = requestDraw;
    img.src = im.url;
    imageCache.set(im.url, img);
  }
  if (!img.complete) return;
  ctx.drawImage(img, 0, 0, im.w, im.h);
}

function _drawBoxes(im) {
  for (const b of im.boxes) {
    const nb    = normalizeBox(b);
    const cls   = state.classes.find(x => x.id === b.clsId);
    const color = cls?.color ?? '#ffffff';
    const sel   = b === _selection;

    ctx.lineWidth   = (sel ? 2.5 : 1.5) / state.zoom;
    ctx.strokeStyle = color;
    ctx.fillStyle   = _withAlpha(color, sel ? 0.22 : 0.12);
    ctx.fillRect(nb.x, nb.y, nb.w, nb.h);
    ctx.strokeRect(nb.x, nb.y, nb.w, nb.h);

    if (sel) {
      ctx.fillStyle = '#0ea5e9';
      const s = HANDLE_DRAW / state.zoom;
      [[nb.x, nb.y], [nb.x + nb.w, nb.y], [nb.x, nb.y + nb.h], [nb.x + nb.w, nb.y + nb.h]]
        .forEach(([hx, hy]) => ctx.fillRect(hx - s, hy - s, s * 2, s * 2));
    }
    if (state.showLabels && cls) _drawLabel(nb.x, nb.y, cls.name, color);
  }
}

function _drawLabel(bx, by, name, color) {
  ctx.save();
  const sc = 1 / state.zoom;
  ctx.scale(sc, sc);
  const lx = bx * state.zoom, ly = by * state.zoom;
  const fs = 11;
  ctx.font = `${fs}px Inter, system-ui`;
  const tw = ctx.measureText(name).width;
  const px = 5, py = 3, rw = tw + px * 2, rh = fs + py * 2;
  ctx.fillStyle = '#0b1222dd'; ctx.strokeStyle = color; ctx.lineWidth = 1;
  _roundRect(lx, ly - rh, rw, rh, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8f4ff';
  ctx.fillText(name, lx + px, ly - py);
  ctx.restore();
}

function _drawDraft() {
  if (!_draft) return;
  const nb = normalizeBox(_draft);
  ctx.strokeStyle = '#f59e0b'; ctx.fillStyle = 'rgba(245,158,11,0.1)';
  ctx.lineWidth = 2 / state.zoom;
  ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
  ctx.fillRect(nb.x, nb.y, nb.w, nb.h);
  ctx.strokeRect(nb.x, nb.y, nb.w, nb.h);
  ctx.setLineDash([]);
}

function _roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
