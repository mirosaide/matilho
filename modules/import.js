import { state, seq } from './state.js';
import { history }    from './history.js';
import { toast }      from './ui.js';
import { renderImages, updateStats } from './images.js';
import { requestDraw } from './canvas.js';
import { saveStorage } from './storage.js';
import { addClass, renderClasses, syncClassSelector } from './classes.js';

// ─── Importar anotações YOLO ──────────────────────────────────────────────────
export async function importYOLO(files) {
  const txts = Array.from(files).filter(f => f.name.endsWith('.txt') && f.name !== 'classes.txt');
  if (!txts.length) { toast('Nenhum .txt encontrado'); return; }
  let imported = 0;

  for (const f of txts) {
    const base = f.name.replace(/\.txt$/, '');
    const im   = state.images.find(im => im.name.replace(/\.[^.]+$/, '') === base);
    if (!im) continue;

    const lines = (await f.text()).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    history.push();
    im.boxes = [];
    for (const line of lines) {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length < 5 || parts.some(isNaN)) continue;
      const [ci, xc, yc, ww, hh] = parts;
      const cls = state.classes[ci];
      if (!cls) continue;
      im.boxes.push({ id: seq.box++, clsId: cls.id,
        x: (xc - ww/2) * im.w, y: (yc - hh/2) * im.h, w: ww * im.w, h: hh * im.h });
    }
    imported++;
  }

  if (imported) {
    renderImages(); requestDraw(); updateStats(); saveStorage();
    toast(`Anotações YOLO importadas de ${imported} ficheiro(s)`);
  } else {
    toast('Nenhuma imagem correspondente encontrada');
  }
}

// ─── Importar classes (.txt) ──────────────────────────────────────────────────
export async function importClasses(file) {
  const names = (await file.text()).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(n => {
    if (!state.classes.some(c => c.name === n)) { history.push(); addClass(n); added++; }
  });
  if (added) { saveStorage(); updateStats(); toast(`${added} classe(s) carregada(s)`); }
}

export function initImport() {
  document.querySelector('#inputYOLO').addEventListener('change', e => {
    importYOLO(e.target.files); e.target.value = '';
  });
  document.querySelector('#inputClasses').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    await importClasses(f); renderClasses(); syncClassSelector(); e.target.value = '';
  });
  document.querySelector('#btnImportYOLO').addEventListener('click', () => document.querySelector('#inputYOLO').click());
  document.querySelector('#btnOpenClasses').addEventListener('click', () => document.querySelector('#inputClasses').click());
}
