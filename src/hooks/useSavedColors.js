import { useCallback, useSyncExternalStore } from 'react';
import { SAVED_COLORS_KEY, readSavedColors, withSavedColor, withoutSavedColor } from '../utils/customColors.js';

// The colours saved from the wheel (utils/customColors.js), shared by every
// picker and by CustomColorStyles: one module-level list, so a colour saved in
// one editor shows in the next without a reload. Device-local, like the other
// display preferences; another tab's change arrives through the storage event.

const listeners = new Set();
let current = null;

const read = () => {
  if (current === null) current = readSavedColors();
  return current;
};
const emit = () => { for (const fn of listeners) fn(); };
const write = (next) => {
  current = next;
  try { localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
  emit();
};

const subscribe = (fn) => {
  listeners.add(fn);
  const onStorage = (e) => { if (e.key === SAVED_COLORS_KEY) { current = null; emit(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
};

/** @returns {{ saved: string[], save: (hex: string) => void, remove: (hex: string) => void }} */
export default function useSavedColors() {
  const saved = useSyncExternalStore(subscribe, read, () => []);
  const save = useCallback((hex) => write(withSavedColor(read(), hex)), []);
  const remove = useCallback((hex) => write(withoutSavedColor(read(), hex)), []);
  return { saved, save, remove };
}

/** Test seam: forget the cached list so the next read goes to storage. */
export const resetSavedColorsCache = () => { current = null; };
