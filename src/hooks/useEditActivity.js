import { useEffect } from 'react';
import { markInteraction } from '../sync/editQuiet.js';

const INTERACTIONS = ['pointerdown', 'pointerup', 'keydown', 'input', 'drop'];

/**
 * Notes each touch, click and key in the app, which is what tells an edit of
 * the synced data from a change nobody made by hand (sync/editQuiet.js).
 * Capture phase, so a handler that stops propagation still counts.
 */
export default function useEditActivity(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onInteraction = () => markInteraction();
    for (const type of INTERACTIONS) document.addEventListener(type, onInteraction, true);
    return () => { for (const type of INTERACTIONS) document.removeEventListener(type, onInteraction, true); };
  }, [enabled]);
}
