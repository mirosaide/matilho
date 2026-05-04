import { state, rnd } from './state.js';
import { toast }       from './ui.js';
import { normalizeBox } from './canvas.js';

// ─── YOLO ─────────────────────────────────────────────────────────────────────
function _toYOLOText(im) {
  const idxMap = new Map(state.classes.map((c, i) => [c.id, i]));
  return im.boxes.map(b => {
    const nb = normalizeBox(b);
    return `${idxMap.get(b.clsId) ?? 0} ${rnd((nb.x + nb.w/2)/im.w)} ${rnd((nb.y + nb.h/2)/im.h)} ${rnd(nb.w/im.w)} ${rnd(nb.h/im.h)}`;
  }).join('\n');
}

export async function saveYOLO() {
  if (!state.images.length) { toast('Adiciona imagens primeiro'); return; }
  const zip    = new JSZip();
  const images = zip.folder('images');
  const labels = zip.folder('labels');

  for (const im of state.images) {
    labels.file(im.name.replace(/\.[^.]+$/, '.txt'), _toYOLOText(im));
    if (im.url) {
      try { images.file(im.name, await fetch(im.url).then(r => r.blob())); } catch (_) {}
    }
  }
  zip.file('classes.txt', state.classes.map(c => c.name).join('\n'));
  zip.file('data.yaml', [
    'path: .', 'train: images/train', 'val:   images/val', '',
    `nc: ${state.classes.length}`,
    `names: [${state.classes.map(c => `'${c.name}'`).join(', ')}]`,
  ].join('\n'));

  saveAs(await zip.generateAsync({ type: 'blob' }), 'matilho_yolo_dataset.zip');
  toast('Exportação YOLO concluída!');
}

// ─── COCO ─────────────────────────────────────────────────────────────────────
export async function saveCOCO() {
  if (!state.images.length) { toast('Adiciona imagens primeiro'); return; }
  const catMap = new Map(state.classes.map((c, i) => [c.id, i + 1]));
  let annId = 1;
  const coco = {
    info:        { description: 'Matilho', version: '1.0', year: new Date().getFullYear() },
    images:      state.images.map((im, i) => ({ id: i+1, file_name: im.name, width: im.w, height: im.h })),
    annotations: state.images.flatMap((im, i) =>
      im.boxes.map(b => {
        const nb = normalizeBox(b);
        return { id: annId++, image_id: i+1, category_id: catMap.get(b.clsId) ?? 1,
                 bbox: [rnd(nb.x), rnd(nb.y), rnd(nb.w), rnd(nb.h)], area: rnd(nb.w*nb.h), iscrowd: 0 };
      })
    ),
    categories: state.classes.map((c, i) => ({ id: i+1, name: c.name, supercategory: 'object' })),
  };
  saveAs(new Blob([JSON.stringify(coco, null, 2)], { type: 'application/json' }), 'matilho_coco_annotations.json');
  toast('Exportação COCO concluída!');
}

// ─── Pascal VOC ───────────────────────────────────────────────────────────────
export async function saveVOC() {
  if (!state.images.length) { toast('Adiciona imagens primeiro'); return; }
  const zip = new JSZip();
  const ann = zip.folder('Annotations');
  state.images.forEach(im => {
    const objs = im.boxes.map(b => {
      const nb = normalizeBox(b); const cls = state.classes.find(c => c.id === b.clsId);
      return `\n  <object>\n    <name>${cls?.name ?? 'unknown'}</name>\n    <pose>Unspecified</pose>\n    <truncated>0</truncated>\n    <difficult>0</difficult>\n    <bndbox>\n      <xmin>${Math.round(nb.x)}</xmin>\n      <ymin>${Math.round(nb.y)}</ymin>\n      <xmax>${Math.round(nb.x+nb.w)}</xmax>\n      <ymax>${Math.round(nb.y+nb.h)}</ymax>\n    </bndbox>\n  </object>`;
    }).join('');
    ann.file(im.name.replace(/\.[^.]+$/, '.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<annotation>\n  <folder>images</folder>\n  <filename>${im.name}</filename>\n  <size>\n    <width>${im.w}</width>\n    <height>${im.h}</height>\n    <depth>3</depth>\n  </size>\n  <segmented>0</segmented>${objs}\n</annotation>`);
  });
  saveAs(await zip.generateAsync({ type: 'blob' }), 'matilho_voc_annotations.zip');
  toast('Exportação Pascal VOC concluída!');
}

export function initExport() {
  document.querySelector('#btnSaveYOLO').addEventListener('click', saveYOLO);
  document.querySelector('#btnSaveCOCO').addEventListener('click', saveCOCO);
  document.querySelector('#btnSaveVOC').addEventListener('click',  saveVOC);
}
