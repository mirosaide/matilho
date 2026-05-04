import { state, seq, imageCache, curImage, $ } from './state.js';
import { history }   from './history.js';
import { toast, setImageMeta } from './ui.js';
import { requestDraw, resetView, setSelection } from './canvas.js';
import { saveStorage } from './storage.js';
import { saveBlob, deleteBlob } from './db.js';

let _filter = 'all';
let _search = '';

// ─── Carregar imagens ─────────────────────────────────────────────────────────
export function addImages(files) {
  const toLoad = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!toLoad.length) return;
  let pending = toLoad.length, added = 0;

  toLoad.forEach(f => {
    if (state.images.some(im => im.name === f.name)) { pending--; if (!pending) _fin(); return; }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      state.images.push({ id: seq.image++, name: f.name, url, w: img.naturalWidth, h: img.naturalHeight, boxes: [] });
      saveBlob(f.name, f); // guarda o ficheiro no IndexedDB para persistência entre sessões
      added++; pending--; if (!pending) _fin();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast(`Erro ao carregar: ${f.name}`);
      pending--; if (!pending) _fin();
    };
    img.src = url;
  });

  function _fin() {
    if (!added) return;
    renderImages();
    if (state.idx < 0) goTo(0, true); else setImageMeta(curImage());
    saveStorage();
    toast(`${added} imagem(s) carregada(s)`);
  }
}

export function removeImage(realIdx) {
  const im = state.images[realIdx];
  if (im) deleteBlob(im.name);
  state.images.splice(realIdx, 1);
  if (state.idx >= state.images.length) state.idx = state.images.length - 1;
  setSelection(null);
  renderImages(); requestDraw(); setImageMeta(curImage()); updateStats(); saveStorage();
}

// ─── Navegação ────────────────────────────────────────────────────────────────
export function goTo(deltaOrIndex, absolute = false) {
  if (!state.images.length) return;
  state.idx = absolute
    ? deltaOrIndex
    : (state.idx + deltaOrIndex + state.images.length) % state.images.length;
  setSelection(null);
  resetView(); requestDraw(); renderImages(); setImageMeta(curImage());
}

// ─── Render da lista ──────────────────────────────────────────────────────────
export function renderImages() {
  const filtered = _filtered();
  const total    = state.images.length;
  $('#imgCount').textContent = total === filtered.length ? total : `${filtered.length}/${total}`;

  const ul = $('#imageList');
  ul.innerHTML = '';
  $('#canvasEmpty').hidden = total > 0;

  filtered.forEach(im => {
    const realIdx = state.images.indexOf(im);
    const li  = document.createElement('li');
    li.classList.toggle('active', realIdx === state.idx);

    const dot = document.createElement('span');
    dot.className = im.boxes.length ? 'ann-dot annotated' : 'ann-dot empty';
    dot.title = im.boxes.length ? `${im.boxes.length} anotação(ões)` : 'Sem anotações';

    const name = document.createElement('span');
    name.className = 'img-name';
    name.textContent = im.name;

    const cnt = document.createElement('span');
    cnt.className = 'img-box-count';
    cnt.textContent = im.boxes.length || '';

    const del = document.createElement('button');
    del.className = 'mini del img-del';
    del.title = 'Remover imagem';
    del.textContent = '×';
    del.addEventListener('click', e => { e.stopPropagation(); removeImage(realIdx); });

    li.append(dot, name, cnt, del);
    li.addEventListener('click', () => goTo(realIdx, true));
    ul.appendChild(li);
  });

  updateStats();
}

function _filtered() {
  const q = _search.toLowerCase();
  return state.images.filter(im => {
    const s = im.name.toLowerCase().includes(q);
    const f = _filter === 'annotated' ? im.boxes.length > 0
            : _filter === 'empty'     ? im.boxes.length === 0
            : true;
    return s && f;
  });
}

// ─── Painel de estatísticas ───────────────────────────────────────────────────
export function updateStats() {
  const body      = $('#statsBody');
  body.innerHTML  = '';
  const total     = state.images.reduce((s, im) => s + im.boxes.length, 0);
  const annotated = state.images.filter(im => im.boxes.length > 0).length;

  const summary = document.createElement('div');
  summary.className = 'stats-summary';
  const mk = (lbl, val) => { const s = document.createElement('span'); s.innerHTML = `<strong>${val}</strong> ${lbl}`; return s; };
  summary.append(mk('imagens', state.images.length), mk('anotadas', annotated), mk('caixas', total));
  body.appendChild(summary);

  if (!state.classes.length || !total) return;

  state.classes.forEach(c => {
    const count = state.images.reduce((s, im) => s + im.boxes.filter(b => b.clsId === c.id).length, 0);
    const pct   = total ? (count / total * 100).toFixed(0) : 0;

    const row = document.createElement('div');
    row.className = 'stats-row';

    const dot = document.createElement('span'); dot.className = 'stats-dot'; dot.style.background = c.color;
    const nm  = document.createElement('span'); nm.className  = 'stats-name'; nm.textContent = c.name;
    const bw  = document.createElement('div'); bw.className  = 'stats-bar-wrap';
    const bar = document.createElement('div'); bar.className = 'stats-bar';
    bar.style.cssText = `width:${pct}%;background:${c.color}`;
    bw.appendChild(bar);
    const val = document.createElement('span'); val.className = 'stats-val'; val.textContent = count;

    row.append(dot, nm, bw, val);
    body.appendChild(row);
  });
}

// ─── Filtros e pesquisa ───────────────────────────────────────────────────────
export function initImageFilters() {
  $('#searchBox').addEventListener('input', e => { _search = e.target.value; renderImages(); });
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _filter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderImages();
    });
  });
}
