import { state, imageCache } from './state.js';
import { toast, modal }      from './ui.js';
import { goTo }              from './images.js';
import { removeImage }       from './images.js';

// Variância do Laplaciano por URL (cache entre análises)
const _scoreCache = new Map();

// ─── Algoritmo: Variância do Laplaciano ───────────────────────────────────────
// Converte para escala de cinzento, aplica kernel Laplaciano 3×3,
// calcula a variância do resultado. Score alto = imagem nítida.
function _laplacianVariance(url) {
  return new Promise(resolve => {
    const img = imageCache.get(url);
    if (!img?.complete) { resolve(null); return; }

    // Reduzir para max 512px para performance (o score escala proporcionalmente)
    const MAX  = 512;
    const sc   = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w    = Math.max(1, Math.round(img.naturalWidth  * sc));
    const h    = Math.max(1, Math.round(img.naturalHeight * sc));

    const off  = document.createElement('canvas');
    off.width  = w; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);

    const data = octx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
    }

    // Kernel Laplaciano 3×3: [0,1,0 / 1,-4,1 / 0,1,0]
    let sum = 0, sumSq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const v =
          gray[(y-1)*w + x] +
          gray[(y+1)*w + x] +
          gray[y*w + (x-1)] +
          gray[y*w + (x+1)] -
          4 * gray[y*w + x];
        sum   += v;
        sumSq += v * v;
        n++;
      }
    }
    const mean = sum / n;
    resolve(Math.round((sumSq / n) - mean * mean));
  });
}

// ─── Thumbnail de uma imagem num canvas 120×80 ────────────────────────────────
function _thumb(url, w, h) {
  const c = document.createElement('canvas');
  c.width  = 120; c.height = 80;
  const cx = c.getContext('2d');
  cx.fillStyle = '#0a1018'; cx.fillRect(0, 0, 120, 80);
  if (!url) return c;
  const img = imageCache.get(url);
  if (img?.complete) {
    const scale = Math.min(120 / w, 80 / h);
    const dw = w * scale, dh = h * scale;
    const dx = (120 - dw) / 2, dy = (80 - dh) / 2;
    cx.drawImage(img, dx, dy, dw, dh);
  }
  return c;
}

// ─── UI do Quality Check ──────────────────────────────────────────────────────
export function initQC() {
  document.querySelector('#btnQC').addEventListener('click', _openQC);
  document.querySelector('#btnQCBack').addEventListener('click', _closeQC);
  document.querySelector('#btnAnalyseAll').addEventListener('click', _analyseAll);
  document.querySelector('#btnSelectFailed').addEventListener('click', _selectFailed);
  document.querySelector('#btnDeleteQC').addEventListener('click', _deleteSelected);
  document.querySelector('#qcThreshold').addEventListener('input', e => {
    document.querySelector('#qcThresholdVal').textContent = e.target.value;
    _refreshBadges();
  });
}

function _openQC() {
  document.querySelector('#mainView').hidden = true;
  document.querySelector('#qcView').hidden   = false;
  _renderGrid();
}

function _closeQC() {
  document.querySelector('#qcView').hidden   = true;
  document.querySelector('#mainView').hidden = false;
}

// ─── Interpretação do score ───────────────────────────────────────────────────
function _interpret(score, threshold) {
  if (score === null || score === undefined) return { label: 'Não analisada', cls: '' };
  if (score >= threshold * 4) return { label: 'Muito nítida',            cls: 'pass' };
  if (score >= threshold)     return { label: 'Nítida',                  cls: 'pass' };
  if (score >= threshold / 2) return { label: 'Ligeiramente desfocada',  cls: 'warn' };
  return                               { label: 'Desfocada',             cls: 'fail' };
}

// Percentagem da barra (0–100), capada a 5× o threshold como "100%"
function _barPct(score, threshold) {
  if (!score) return 0;
  return Math.min(100, Math.round(score / (threshold * 5) * 100));
}

// ─── Renderizar grid de cards ─────────────────────────────────────────────────
function _renderGrid() {
  const grid      = document.querySelector('#qcGrid');
  const threshold = +document.querySelector('#qcThreshold').value;
  grid.innerHTML  = '';

  if (!state.images.length) {
    grid.innerHTML = '<p class="qc-empty">Nenhuma imagem carregada. Carrega imagens e clica em "Analisar todas".</p>';
    return;
  }

  state.images.forEach((im, realIdx) => {
    const score = _scoreCache.has(im.url ?? im.name) ? _scoreCache.get(im.url ?? im.name) : null;
    const pass  = score === null ? null : score >= threshold;
    const interp = _interpret(score, threshold);

    const card = document.createElement('div');
    card.className   = `qc-card ${pass === null ? '' : pass ? 'pass' : 'fail'}`;
    card.dataset.idx = realIdx;

    // Checkbox
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.className = 'qc-chk';

    // Thumbnail
    const thumb = _thumb(im.url, im.w, im.h);
    thumb.className = 'qc-thumb';
    thumb.title = 'Clica para abrir no anotador';
    thumb.addEventListener('click', () => { _closeQC(); goTo(realIdx, true); });

    // Informação
    const info = document.createElement('div');
    info.className = 'qc-info';
    info.id = `qci_${realIdx}`;

    info.appendChild(_buildInfo(im.name, score, threshold, interp, pass, realIdx));
    card.append(chk, thumb, info);
    grid.appendChild(card);
  });

  _updateSummary();
}

function _buildInfo(name, score, threshold, interp, pass, idx) {
  const frag = document.createDocumentFragment();

  const namEl = document.createElement('span');
  namEl.className = 'qc-name'; namEl.textContent = name; namEl.title = name;

  // Label de interpretação
  const lblEl = document.createElement('span');
  lblEl.className = `qc-label ${interp.cls}`;
  lblEl.id = `qcl_${idx}`;
  lblEl.textContent = score !== null
    ? `${interp.label} (${score})`
    : 'Clica em "Analisar todas"';

  // Barra visual de nitidez
  const barWrap = document.createElement('div');
  barWrap.className = 'qc-bar-wrap';
  barWrap.title = `Score: ${score ?? '—'} · Threshold: ${threshold}`;

  const bar = document.createElement('div');
  bar.className = `qc-bar-fill ${interp.cls}`;
  bar.id = `qcb_${idx}`;
  bar.style.width = `${_barPct(score, threshold)}%`;

  // Linha de threshold
  const tline = document.createElement('div');
  tline.className = 'qc-bar-threshold';
  tline.style.left = '20%'; // threshold está sempre a 20% (1/5 do máximo)

  barWrap.append(bar, tline);
  frag.append(namEl, lblEl, barWrap);
  return frag;
}

// ─── Analisar todas as imagens ────────────────────────────────────────────────
async function _analyseAll() {
  const btn  = document.querySelector('#btnAnalyseAll');
  btn.disabled = true; btn.textContent = '⏳ A analisar...';

  for (let i = 0; i < state.images.length; i++) {
    const im = state.images[i];
    if (!im.url) continue;
    const score = await _laplacianVariance(im.url);
    if (score !== null) _scoreCache.set(im.url, score);
  }

  btn.disabled = false; btn.textContent = '▶ Analisar';
  _renderGrid();
  toast('Análise concluída');
}

// ─── Actualizar cards sem re-renderizar tudo (quando o threshold muda) ────────
function _refreshBadges() {
  const threshold = +document.querySelector('#qcThreshold').value;
  document.querySelectorAll('.qc-card').forEach(card => {
    const idx    = +card.dataset.idx;
    const im     = state.images[idx];
    if (!im) return;
    const score  = _scoreCache.get(im.url ?? im.name);
    const pass   = score === undefined ? null : score >= threshold;
    const interp = _interpret(score ?? null, threshold);

    card.classList.remove('pass', 'fail');
    if (pass !== null) card.classList.add(pass ? 'pass' : 'fail');

    const lblEl = document.querySelector(`#qcl_${idx}`);
    if (lblEl && score !== undefined) {
      lblEl.textContent = `${interp.label} (${score})`;
      lblEl.className   = `qc-label ${interp.cls}`;
    }

    const barEl = document.querySelector(`#qcb_${idx}`);
    if (barEl && score !== undefined) {
      barEl.style.width = `${_barPct(score, threshold)}%`;
      barEl.className   = `qc-bar-fill ${interp.cls}`;
    }
  });
  _updateSummary();
}

// ─── Seleccionar imagens reprovadas ───────────────────────────────────────────
function _selectFailed() {
  const threshold = +document.querySelector('#qcThreshold').value;
  document.querySelectorAll('.qc-card').forEach(card => {
    const idx  = +card.dataset.idx;
    const im   = state.images[idx];
    if (!im) return;
    const score = _scoreCache.get(im.url ?? im.name);
    const fail  = score !== undefined && score < threshold;
    card.querySelector('.qc-chk').checked = fail;
  });
  _updateSummary();
}

// ─── Apagar imagens seleccionadas ─────────────────────────────────────────────
async function _deleteSelected() {
  const cards   = [...document.querySelectorAll('.qc-card')];
  const toDelete = cards.filter(c => c.querySelector('.qc-chk').checked).map(c => +c.dataset.idx);
  if (!toDelete.length) { toast('Nenhuma imagem seleccionada'); return; }

  const ok = await modal(`Apagar ${toDelete.length} imagem(ns) seleccionada(s)?`, { okLabel: 'Apagar' });
  if (!ok) return;

  // Apagar da maior para o menor índice para não deslocar
  toDelete.sort((a, b) => b - a).forEach(idx => {
    const im = state.images[idx];
    if (im?.url) _scoreCache.delete(im.url);
    removeImage(idx);
  });

  _renderGrid();
  toast(`${toDelete.length} imagem(ns) apagada(s)`);
}

// ─── Sumário ──────────────────────────────────────────────────────────────────
function _updateSummary() {
  const threshold = +document.querySelector('#qcThreshold').value;
  let pass = 0, fail = 0, pending = 0;
  state.images.forEach(im => {
    const score = _scoreCache.get(im.url ?? im.name);
    if (score === undefined) pending++;
    else if (score >= threshold) pass++;
    else fail++;
  });
  document.querySelector('#qcSummary').textContent =
    `${state.images.length} imagens · nítidas ${pass} · desfocadas ${fail} · por analisar ${pending}`;
}
