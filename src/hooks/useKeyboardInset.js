import { useEffect, useState } from 'react';
import { isNativeApp } from '../native.js';

/**
 * How many CSS px at the bottom of the window the on-screen keyboard covers.
 *
 * The Android shell runs with windowSoftInputMode="adjustNothing", so the page
 * keeps its full height under the keyboard; MainActivity reports the keyboard
 * inset instead (window.__dgImeInset and a 'dg-ime-inset' event). In a browser
 * the visual viewport shrinks, and the difference is the keyboard. A view
 * that must stay above the keyboard (the full-screen note editor) takes this
 * off its height.
 */
export default function useKeyboardInset() {
  const [inset, setInset] = useState(() => (typeof window !== 'undefined' ? Number(window.__dgImeInset) || 0 : 0));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onNative = (e) => setInset(Math.max(0, Number(e.detail) || 0));
    window.addEventListener('dg-ime-inset', onNative);
    const vv = window.visualViewport;
    const useViewport = vv && !isNativeApp();
    const onViewport = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    if (useViewport) {
      vv.addEventListener('resize', onViewport);
      vv.addEventListener('scroll', onViewport);
      onViewport();
    }
    return () => {
      window.removeEventListener('dg-ime-inset', onNative);
      if (useViewport) {
        vv.removeEventListener('resize', onViewport);
        vv.removeEventListener('scroll', onViewport);
      }
    };
  }, []);
  return inset;
}
