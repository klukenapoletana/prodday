import { useEffect, useRef } from 'react';
import { isNativeAndroid, nativeAckQuickAddEntries, nativePeekQuickAddEntries } from '../native.js';
import { quickAddToInboxTasks } from '../utils/quickAddInbox.js';

// How long after adding entries their queue on the device is cleared: past the
// app's own save of the Inbox, so an app that dies in between reads them again
// (and adds nothing twice, the entries keep their ids).
const ACK_DELAY_MS = 3000;

/**
 * Takes the Quick add widget's entries into the Inbox (utils/quickAddInbox.js)
 * once the data has loaded, and again whenever the app comes to the front.
 * Before the data loads nothing is read: an Inbox that has not loaded is not
 * an empty one, and the load would replace whatever was added to it.
 */
export default function useQuickAddInbox({ dataLoaded, setUnscheduledTasks, defaultColor, disabled = false }) {
  const colorRef = useRef(defaultColor);
  colorRef.current = defaultColor;
  useEffect(() => {
    if (disabled || !dataLoaded || !isNativeAndroid()) return undefined;
    const timers = new Set();
    const ingest = () => {
      const entries = nativePeekQuickAddEntries();
      if (!entries.length) return;
      setUnscheduledTasks(prev => {
        const added = quickAddToInboxTasks(entries, prev.map(t => t.id), { color: colorRef.current });
        return added.length ? [...prev, ...added] : prev;
      });
      const ids = entries.map(e => e?.id).filter(Boolean);
      const timer = setTimeout(() => { timers.delete(timer); nativeAckQuickAddEntries(ids); }, ACK_DELAY_MS);
      timers.add(timer);
    };
    ingest();
    const onVisible = () => { if (document.visibilityState === 'visible') ingest(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      timers.forEach(clearTimeout);
    };
  }, [dataLoaded, disabled, setUnscheduledTasks]);
}
