/* Matilho v1.0 — por Miro Saide
   Open Source · MIT License · https://github.com/mirosaide/matilho
*/
import { setRefreshAll }              from './modules/refresh.js';
import { initModal, setImageMeta }    from './modules/ui.js';
import { initClasses, renderClasses, syncClassSelector } from './modules/classes.js';
import { initImageFilters, renderImages, updateStats, addImages } from './modules/images.js';
import { initInteraction }            from './modules/interaction.js';
import { initExport }                 from './modules/export.js';
import { initImport }                 from './modules/import.js';
import { initProject }                from './modules/project.js';
import { initAugmentation }           from './modules/augmentation.js';
import { initQC }                     from './modules/qualitycheck.js';
import { requestDraw }                from './modules/canvas.js';
import { loadStorage }                from './modules/storage.js';
import { curImage, state, imageCache } from './modules/state.js';
import { restoreImages }               from './modules/db.js';
import { toast }                       from './modules/ui.js';

// ─── Função central de refresh (sem deps circulares) ─────────────────────────
function refreshAll() {
  renderClasses();
  syncClassSelector();
  renderImages();
  requestDraw();
  setImageMeta(curImage());
  updateStats();
}

// ─── Registar e inicializar ───────────────────────────────────────────────────
setRefreshAll(refreshAll);

initModal();
initClasses();
initImageFilters();
initInteraction();
initExport();
initImport();
initProject();
initAugmentation();
initQC();

// Abrir imagens via botão principal
document.querySelector('#btnOpenImages').addEventListener('click', () => document.querySelector('#inputImages').click());
document.querySelector('#inputImages').addEventListener('change', e => { addImages(e.target.files); e.target.value = ''; });

// ─── Restaurar sessão anterior (inclui imagens do IndexedDB) ─────────────────
loadStorage(async () => {
  refreshAll(); // mostra lista de imagens com placeholder enquanto restaura
  const restored = await restoreImages(state, imageCache);
  if (restored > 0) {
    refreshAll(); // redesenha com as imagens reais
    toast(`${restored} imagem(ns) restaurada(s) automaticamente`, 3000);
  } else if (state.images.length > 0) {
    toast('Anotações restauradas. Reabre as imagens para visualizar.', 4000);
  }
});

refreshAll();
