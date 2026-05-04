import { state, seq, $ } from './state.js';
import { history }        from './history.js';
import { modal, toast }   from './ui.js';
import { requestDraw }    from './canvas.js';
import { saveStorage }    from './storage.js';
import { updateStats }    from './images.js';

export function addClass(name, color) {
  const c = { id: seq.class++, name, color: color || _randomColor() };
  state.classes.push(c);
  if (state.activeClassId == null) state.activeClassId = c.id;
  renderClasses(); syncClassSelector();
}

export async function renameClass(c) {
  const novo = await modal(`Renomear "${c.name}":`, { input: true, defaultValue: c.name, okLabel: 'Renomear' });
  if (!novo || !novo.trim() || novo.trim() === c.name) return;
  history.push(); c.name = novo.trim();
  renderClasses(); syncClassSelector(); requestDraw(); saveStorage();
}

export async function deleteClass(c) {
  const outras = state.classes.filter(x => x.id !== c.id);
  const msg = outras.length
    ? `Eliminar classe "${c.name}"?\n\nAs suas caixas serão movidas para a classe ativa.\nPode desfazer com Ctrl+Z.`
    : `Eliminar classe "${c.name}"?\n\nNão há outras classes — as caixas serão apagadas.`;
  if (!await modal(msg, { okLabel: 'Eliminar' })) return;

  history.push();
  const reassign = outras.length ? (state.activeClassId !== c.id ? state.activeClassId : outras[0].id) : null;
  state.classes = state.classes.filter(x => x.id !== c.id);
  state.images.forEach(im => {
    im.boxes = im.boxes.filter(b => {
      if (b.clsId !== c.id) return true;
      if (reassign) { b.clsId = reassign; return true; }
      return false;
    });
  });
  if (state.activeClassId === c.id) state.activeClassId = state.classes[0]?.id ?? null;
  renderClasses(); syncClassSelector(); requestDraw(); updateStats(); saveStorage();
}

export function renderClasses() {
  $('#clsCount').textContent = state.classes.length;
  const ul = $('#classList'); ul.innerHTML = '';

  state.classes.forEach((c, idx) => {
    const li = document.createElement('li');
    li.dataset.id = c.id;
    li.classList.toggle('active', c.id === state.activeClassId);

    const badge = document.createElement('span');
    badge.className = 'badge'; badge.style.background = c.color; badge.title = 'Clica para mudar a cor';
    badge.addEventListener('click', e => {
      e.stopPropagation();
      const inp = document.createElement('input');
      inp.type = 'color'; inp.value = _hslToHex(c.color);
      inp.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(inp); inp.click();
      inp.addEventListener('input', () => { history.push(); c.color = inp.value; badge.style.background = c.color; requestDraw(); saveStorage(); });
      inp.addEventListener('change', () => document.body.removeChild(inp));
    });

    const name = document.createElement('span'); name.className = 'cname'; name.textContent = c.name;
    const sc   = document.createElement('span'); sc.className = 'cls-shortcut'; sc.textContent = idx < 9 ? `(${idx + 1})` : '';
    const cnt  = state.images.reduce((s, im) => s + im.boxes.filter(b => b.clsId === c.id).length, 0);
    const ce   = document.createElement('span'); ce.className = 'cls-count'; ce.textContent = cnt || '';
    const eBtn = document.createElement('button'); eBtn.className = 'mini edit'; eBtn.title = 'Renomear'; eBtn.textContent = '✎';
    eBtn.addEventListener('click', e => { e.stopPropagation(); renameClass(c); });
    const dBtn = document.createElement('button'); dBtn.className = 'mini del'; dBtn.title = 'Eliminar'; dBtn.textContent = '🗑';
    dBtn.addEventListener('click', e => { e.stopPropagation(); deleteClass(c); });

    li.append(badge, name, sc, ce, eBtn, dBtn);
    li.addEventListener('click', () => { state.activeClassId = c.id; highlightActiveClass(); syncClassSelector(); });
    ul.appendChild(li);
  });
  highlightActiveClass();
}

export function highlightActiveClass() {
  document.querySelectorAll('#classList li').forEach(li =>
    li.classList.toggle('active', +li.dataset.id === state.activeClassId)
  );
}

export function syncClassSelector() {
  const sel = $('#activeClass'); sel.innerHTML = '';
  state.classes.forEach(c => {
    const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt);
  });
  if (state.activeClassId != null) sel.value = state.activeClassId;
}

export function initClasses() {
  $('#btnAddClass').addEventListener('click', () => {
    const name = $('#newClassName').value.trim(); if (!name) return;
    history.push(); addClass(name); $('#newClassName').value = ''; saveStorage(); updateStats();
  });
  $('#newClassName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnAddClass').click(); });
  $('#activeClass').addEventListener('change', e => { state.activeClassId = +e.target.value; highlightActiveClass(); });
}

// ─── Utilitários privados ─────────────────────────────────────────────────────
function _randomColor() { return `hsl(${Math.floor(Math.random() * 360)} 80% 58%)`; }

function _hslToHex(hsl) {
  const m = hsl.match(/hsl\((\d+)[\s,]+(\d+)%?[\s,]+(\d+)%?\)/);
  if (!m) return '#888888';
  let [, h, s, l] = m.map(Number); s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
