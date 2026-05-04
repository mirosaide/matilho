import { state, seq, imageCache } from './state.js';
import { clearAllBlobs } from './db.js';
import { toast, modal }           from './ui.js';
import { saveStorage }            from './storage.js';
import { history }                from './history.js';
import { renderImages, updateStats } from './images.js';
import { renderClasses, syncClassSelector } from './classes.js';
import { requestDraw, setSelection } from './canvas.js';
import { setImageMeta } from './ui.js';
import { curImage } from './state.js';

export function saveProject() {
  const proj = {
    version: '1.0',
    classes: state.classes,
    seq,
    images:  state.images.map(im => ({ name: im.name, w: im.w, h: im.h, boxes: im.boxes })),
  };
  saveAs(new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' }), 'matilho_project.json');
  toast('Projecto guardado!');
}

export async function loadProject(file) {
  try {
    const proj = JSON.parse(await file.text());
    if (!proj.classes || !proj.images) throw new Error('Formato inválido');
    state.classes = proj.classes;
    state.activeClassId = proj.classes[0]?.id ?? null;
    Object.assign(seq, proj.seq || {});
    state.images = proj.images.map(im => ({ id: seq.image++, url: null, ...im, boxes: im.boxes || [] }));
    state.idx = -1;
    renderClasses(); syncClassSelector(); renderImages();
    requestDraw(); setImageMeta(curImage()); updateStats();
    saveStorage();
    toast('Projecto carregado! Re-abre as imagens para visualizar.', 4000);
  } catch (err) {
    toast('Erro ao carregar: ' + err.message);
  }
}

export async function newProject() {
  if (!await modal('Criar novo projecto?\n\nAs anotações não guardadas serão perdidas.', { okLabel: 'Novo projecto' })) return;
  state.images.forEach(im => { if (im.url) URL.revokeObjectURL(im.url); });
  imageCache.clear();
  clearAllBlobs();
  Object.assign(state, { classes: [], images: [], idx: -1, activeClassId: null, clipboard: null });
  Object.assign(seq, { box: 1, image: 1, class: 1 });
  history.clear();
  setSelection(null);
  renderClasses(); syncClassSelector(); renderImages();
  requestDraw(); setImageMeta(null); updateStats();
  saveStorage();
}

export function initProject() {
  document.querySelector('#btnSaveProj').addEventListener('click', saveProject);
  document.querySelector('#btnLoadProj').addEventListener('click', () => document.querySelector('#inputProject').click());
  document.querySelector('#inputProject').addEventListener('change', e => {
    if (e.target.files[0]) loadProject(e.target.files[0]); e.target.value = '';
  });
  document.querySelector('#btnNewProj').addEventListener('click', newProject);
}
