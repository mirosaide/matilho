import { state, seq, imageCache, curImage, clamp } from './state.js';
import { history }   from './history.js';
import { toast }     from './ui.js';
import { renderImages, updateStats } from './images.js';
import { requestDraw } from './canvas.js';
import { saveStorage } from './storage.js';

// ─── Configurações por augmentação ────────────────────────────────────────────
const AUG_DEFS = [
  { id: 'flipH',      label: 'Flip horizontal',     hasSlider: false },
  { id: 'flipV',      label: 'Flip vertical',        hasSlider: false },
  { id: 'bright',     label: 'Brilho',               hasSlider: true, unit: '%', min: 10, max: 60, def: 30 },
  { id: 'contrast',   label: 'Contraste',            hasSlider: true, unit: '%', min: 10, max: 60, def: 30 },
  { id: 'blur',       label: 'Desfoque',             hasSlider: true, unit: 'px', min: 1, max: 8, def: 2 },
  { id: 'noise',      label: 'Ruído gaussiano',      hasSlider: true, unit: '%', min: 5, max: 40, def: 15 },
  { id: 'crop',       label: 'Crop aleatório (80–95%)', hasSlider: false },
];

// ─── Inicialização da UI ──────────────────────────────────────────────────────
export function initAugmentation() {
  _buildModal();
  document.querySelector('#btnAugment').addEventListener('click', () => {
    document.querySelector('#augModal').hidden = false;
  });
  document.querySelector('#augCloseBtn').addEventListener('click', () => {
    document.querySelector('#augModal').hidden = true;
  });
  document.querySelector('#augModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.querySelector('#augModal').hidden = true;
  });
  document.querySelector('#augGenBtn').addEventListener('click', _generate);
}

function _buildModal() {
  const container = document.querySelector('#augOptions');
  AUG_DEFS.forEach(def => {
    const wrap = document.createElement('label');
    wrap.className = 'aug-option';

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.id = `aug_${def.id}`; chk.value = def.id;
    if (def.id === 'flipH') chk.checked = true;

    const lbl = document.createElement('span');
    lbl.textContent = def.label;

    wrap.append(chk, lbl);

    if (def.hasSlider) {
      const slider = document.createElement('input');
      slider.type = 'range'; slider.id = `aug_${def.id}_val`;
      slider.min = def.min; slider.max = def.max; slider.value = def.def;

      const valSpan = document.createElement('span');
      valSpan.id = `aug_${def.id}_lbl`;
      valSpan.textContent = `${def.def}${def.unit}`;

      slider.addEventListener('input', () => { valSpan.textContent = `${slider.value}${def.unit}`; });
      wrap.append(slider, valSpan);
    }

    container.appendChild(wrap);
  });
}

// ─── Geração ──────────────────────────────────────────────────────────────────
async function _generate() {
  const selected = AUG_DEFS.filter(d => document.querySelector(`#aug_${d.id}`)?.checked);
  if (!selected.length) { toast('Seleciona pelo menos uma augmentação'); return; }

  const scope = document.querySelector('input[name="augScope"]:checked')?.value ?? 'current';
  const images = scope === 'all'
    ? state.images.filter(im => im.url)
    : [curImage()].filter(im => im?.url);

  if (!images.length) { toast('Nenhuma imagem disponível'); return; }

  const total    = images.length * selected.length;
  const genBtn   = document.querySelector('#augGenBtn');
  const progress = document.querySelector('#augProgress');
  const bar      = document.querySelector('#augProgressBar');
  const txt      = document.querySelector('#augProgressText');

  genBtn.disabled = true;
  progress.hidden = false;
  let done = 0;

  history.push();
  let generated = 0;

  for (const im of images) {
    const imgEl = imageCache.get(im.url);
    if (!imgEl?.complete) continue;

    for (const def of selected) {
      const intensity = def.hasSlider ? +document.querySelector(`#aug_${def.id}_val`).value : null;
      const result    = await _applyAug(imgEl, im, def.id, intensity);
      if (result) { state.images.push(result); generated++; }
      done++;
      const pct = Math.round(done / total * 100);
      bar.style.width = `${pct}%`;
      txt.textContent = `${done}/${total}`;
    }
  }

  renderImages(); requestDraw(); updateStats(); saveStorage();
  genBtn.disabled = false;
  progress.hidden = true;
  bar.style.width = '0%';
  toast(`${generated} imagem(ns) gerada(s)`);
  document.querySelector('#augModal').hidden = true;
}

// ─── Aplicar transformação individual ────────────────────────────────────────
async function _applyAug(imgEl, im, type, intensity) {
  const off    = document.createElement('canvas');
  off.width    = im.w; off.height = im.h;
  const octx   = off.getContext('2d');
  let newBoxes = im.boxes.map(b => ({ ...b, id: seq.box++ }));

  switch (type) {
    case 'flipH':
      octx.translate(im.w, 0); octx.scale(-1, 1);
      octx.drawImage(imgEl, 0, 0);
      newBoxes = newBoxes.map(b => ({ ...b, x: im.w - b.x - b.w }));
      break;

    case 'flipV':
      octx.translate(0, im.h); octx.scale(1, -1);
      octx.drawImage(imgEl, 0, 0);
      newBoxes = newBoxes.map(b => ({ ...b, y: im.h - b.y - b.h }));
      break;

    case 'bright': {
      octx.drawImage(imgEl, 0, 0);
      const d = octx.getImageData(0, 0, im.w, im.h);
      const f = 1 + intensity / 100;
      for (let i = 0; i < d.data.length; i += 4) {
        d.data[i]   = clamp(d.data[i]   * f, 0, 255);
        d.data[i+1] = clamp(d.data[i+1] * f, 0, 255);
        d.data[i+2] = clamp(d.data[i+2] * f, 0, 255);
      }
      octx.putImageData(d, 0, 0);
      break;
    }

    case 'contrast': {
      octx.drawImage(imgEl, 0, 0);
      const d = octx.getImageData(0, 0, im.w, im.h);
      const f = 1 + intensity / 100;
      for (let i = 0; i < d.data.length; i += 4) {
        d.data[i]   = clamp((d.data[i]   - 128) * f + 128, 0, 255);
        d.data[i+1] = clamp((d.data[i+1] - 128) * f + 128, 0, 255);
        d.data[i+2] = clamp((d.data[i+2] - 128) * f + 128, 0, 255);
      }
      octx.putImageData(d, 0, 0);
      break;
    }

    case 'blur':
      octx.filter = `blur(${intensity}px)`;
      octx.drawImage(imgEl, 0, 0);
      octx.filter = 'none';
      break;

    case 'noise': {
      octx.drawImage(imgEl, 0, 0);
      const d = octx.getImageData(0, 0, im.w, im.h);
      const amp = intensity / 100 * 255;
      for (let i = 0; i < d.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 2 * amp;
        d.data[i]   = clamp(d.data[i]   + n, 0, 255);
        d.data[i+1] = clamp(d.data[i+1] + n, 0, 255);
        d.data[i+2] = clamp(d.data[i+2] + n, 0, 255);
      }
      octx.putImageData(d, 0, 0);
      break;
    }

    case 'crop': {
      const factor = 0.80 + Math.random() * 0.15;
      const cw = Math.round(im.w * factor), ch = Math.round(im.h * factor);
      const cx = Math.round(Math.random() * (im.w - cw));
      const cy = Math.round(Math.random() * (im.h - ch));
      octx.drawImage(imgEl, cx, cy, cw, ch, 0, 0, im.w, im.h);
      const sx = im.w / cw, sy = im.h / ch;
      newBoxes = newBoxes
        .map(b => ({ ...b, x: (b.x - cx) * sx, y: (b.y - cy) * sy, w: b.w * sx, h: b.h * sy }))
        .filter(b => b.x < im.w && b.y < im.h && b.x + b.w > 0 && b.y + b.h > 0)
        .map(b => {
          const x2 = Math.min(im.w, b.x + b.w), y2 = Math.min(im.h, b.y + b.h);
          const nx = Math.max(0, b.x), ny = Math.max(0, b.y);
          return { ...b, x: nx, y: ny, w: x2 - nx, h: y2 - ny };
        })
        .filter(b => b.w > 5 && b.h > 5);
      break;
    }
  }

  const blob = await new Promise(res => off.toBlob(res, 'image/png'));
  if (!blob) return null;

  const url    = URL.createObjectURL(blob);
  const newImg = new Image();
  await new Promise(res => { newImg.onload = res; newImg.src = url; });
  imageCache.set(url, newImg);

  return {
    id:    seq.image++,
    name:  im.name.replace(/\.[^.]+$/, '') + `_aug_${type}.png`,
    url, w: im.w, h: im.h,
    boxes: newBoxes,
    isAug: true,
  };
}
