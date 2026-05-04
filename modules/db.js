// Persistência de ficheiros de imagem via IndexedDB.
// Guarda Blobs entre sessões, contornando a limitação dos Blob URLs temporários.

const DB_NAME    = 'matilho_v1';
const STORE      = 'images';
const DB_VERSION = 1;

let _db = null;

async function _open() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'name' });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

export async function saveBlob(name, blob) {
  const db = await _open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ name, blob });
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
}

export async function loadBlob(name) {
  const db = await _open();
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(name);
    req.onsuccess = () => res(req.result?.blob ?? null);
    req.onerror   = () => rej(req.error);
  });
}

export async function deleteBlob(name) {
  const db = await _open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(name);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
}

export async function clearAllBlobs() {
  const db = await _open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
}

// Restaura todas as imagens sem URL a partir do IndexedDB.
// Chamada no arranque após loadStorage().
export async function restoreImages(state, imageCache) {
  const unloaded = state.images.filter(im => !im.url);
  if (!unloaded.length) return 0;

  let restored = 0;
  for (const im of unloaded) {
    try {
      const blob = await loadBlob(im.name);
      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise(res => { img.onload = res; img.onerror = res; img.src = url; });

      if (img.naturalWidth === 0) { URL.revokeObjectURL(url); continue; }

      imageCache.set(url, img);
      im.url = url;
      im.w   = img.naturalWidth;
      im.h   = img.naturalHeight;
      restored++;
    } catch (_) { /* falha silenciosa por imagem */ }
  }
  return restored;
}
