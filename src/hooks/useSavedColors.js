import { useCallback, useSyncExternalStore } from 'react';
import {
  SAVED_COLORS_KEY, SAVED_COLORS_UPDATED_KEY, readSavedColors, withSavedColor, withoutSavedColor,
} from '../utils/customColors.js';

// The colours saved from the wheel (utils/customColors.js), shared by every
// picker and by CustomColorStyles: one module-level list, so a colour saved in
// one editor shows in the next without a reload. Another tab's change arrives
// through the storage event, another device's through sync
// (applyRemoteSavedColors, from the apply in hooks/useSyncEngineData.js).
//
// Every edit here stamps SAVED_COLORS_UPDATED_KEY: the list syncs whole, and
// the newer stamp wins. Only a user's edit stamps; the apply writes the
// winner's own stamp, so taking a remote list never looks like a new edit.

const listeners = new Set();
let current = null;

const nowIso = () => new Date().toISOString();

const read = () => {
  if (current === null) {
    current = readSavedColors();
    // Colours saved before the list synced carry no stamp. Give them one the
    // first time they are read, so a device with an empty, equally unstamped
    // list cannot win the tie and wipe them.
    try {
      if (current.length > 0 && !localStorage.getItem(SAVED_COLORS_UPDATED_KEY)) {
        localStorage.setItem(SAVED_COLORS_UPDATED_KEY, nowIso());
      }
    } catch { /* unstamped; the tie goes to the remote */ }
  }
  return current;
};
const emit = () => { for (const fn of listeners) fn(); };
const store = (list, updatedAt) => {
  current = list;
  try {
    localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(list));
    if (updatedAt) localStorage.setItem(SAVED_COLORS_UPDATED_KEY, updatedAt);
  } catch { /* not remembered */ }
  emit();
};

const subscribe = (fn) => {
  listeners.add(fn);
  const onStorage = (e) => { if (e.key === SAVED_COLORS_KEY) { current = null; emit(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
};

/** The saved list as the sync payload sends it, with its stamp. */
export function savedColorsForSync() {
  const colors = read();
  let updatedAt = null;
  try { updatedAt = localStorage.getItem(SAVED_COLORS_UPDATED_KEY) || null; } catch { /* unstamped */ }
  return { colors, updatedAt };
}

/**
 * Take the list a sync merge settled on. Writes the winner's own stamp (never
 * a new one) and leaves storage alone when nothing changed, so applying is
 * idempotent and a pull never turns into a push.
 */
export function applyRemoteSavedColors(colors, updatedAt) {
  if (!Array.isArray(colors)) return;
  const next = readSavedColors({ getItem: () => JSON.stringify(colors) });
  const prev = read();
  let prevStamp = null;
  try { prevStamp = localStorage.getItem(SAVED_COLORS_UPDATED_KEY); } catch { /* unstamped */ }
  if (JSON.stringify(next) === JSON.stringify(prev) && (updatedAt || null) === (prevStamp || null)) return;
  store(next, updatedAt || prevStamp);
}

/** @returns {{ saved: string[], save: (hex: string) => void, remove: (hex: string) => void }} */
export default function useSavedColors() {
  const saved = useSyncExternalStore(subscribe, read, () => []);
  const save = useCallback((hex) => store(withSavedColor(read(), hex), nowIso()), []);
  const remove = useCallback((hex) => store(withoutSavedColor(read(), hex), nowIso()), []);
  return { saved, save, remove };
}

/** Test seam: forget the cached list so the next read goes to storage. */
export const resetSavedColorsCache = () => { current = null; };
