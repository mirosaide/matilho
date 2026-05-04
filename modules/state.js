// ─── Constantes ───────────────────────────────────────────────────────────────
export const HANDLE_HIT  = 10;
export const HANDLE_DRAW =  5;
export const GRID_SIZE   = 40;
export const MIN_BOX     =  5;
export const MAX_HISTORY = 60;
export const STORAGE_KEY = 'matilho_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const $     = s  => document.querySelector(s);
export const $$    = s  => Array.from(document.querySelectorAll(s));
export const rnd   = n  => Math.round(n * 10000) / 10000;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Estado central ───────────────────────────────────────────────────────────
export const state = {
  classes:       [],
  images:        [],
  idx:           -1,
  tool:          'select',
  zoom:          1,
  panX:          0,
  panY:          0,
  activeClassId: null,
  clipboard:     null,
  showGrid:      true,
  showLabels:    true,
};

// Sequências de IDs — usar sempre Object.assign para não perder a referência
export const seq = { box: 1, image: 1, class: 1 };

// Cache de HTMLImageElement por Blob URL
export const imageCache = new Map();

// Imagem actualmente visível
export function curImage() { return state.images[state.idx] || null; }
