import { useEffect, useRef } from 'react';
import { isNativeAndroid, nativeAckQuickAddEntries, nativePeekQuickAddEntries } from '../native.js';
import { quickAddToInboxTasks } from '../utils/quickAddInbox.js';
import { markPendingLocalAdds, presentIds } from '../sync/pendingLocalAdds.js';

// How long after adding entries their queue on the device is cleared: past the
// app's own save of the Inbox, so an app that dies in between reads them again
// (and adds nothing twice, the entries keep their ids). Only entries seen in
// the app's state are cleared (sync/pendingLocalAdds.js).
const ACK_DELAY_MS = 3000;

/**
 * Takes the Quick add widget's entries into the Inbox (utils/quickAddInbox.js)
 * once the data has loaded, and again whenever the app comes to the front.
 * Before the data loads nothing is read: an Inbox that has not loaded is not
 * an empty one, and the load would replace whatever was added to it. The
 * entries are registered with sync/pendingLocalAdds.js, so a sync cycle in
 * flight, whose apply replaces the Inbox with what it started from, keeps them.
 */
export default function useQuickAddInbox({ dataLoaded, unscheduledTasks, recycleBin, setUnscheduledTasks, defaultColor, disabled = false }) {
  const latest = useRef({});
  latest.current = { unscheduledTasks, recycleBin, defaultColor };
  useEffect(() => {
    if (disabled || !dataLoaded || !isNativeAndroid()) return undefined;
    const timers = new Set();
    const ingest = () => {
      const entries = nativePeekQuickAddEntries();
      if (!entries.length) return;
      // An entry with nothing to add (no title) is taken as it is.
      const wanted = quickAddToInboxTasks(entries, [], { color: '' }).map(t => t.id);
      markPendingLocalAdds(wanted);
      setUnscheduledTasks(prev => {
        const added = quickAddToInboxTasks(entries, prev.map(t => t.id), { color: latest.current.defaultColor });
        return added.length ? [...prev, ...added] : prev;
      });
      const ids = entries.map(e => e?.id).filter(Boolean);
      const timer = setTimeout(() => {
        timers.delete(timer);
        const { unscheduledTasks: now, recycleBin: bin } = latest.current;
        const present = new Set(presentIds([...(now || []), ...(bin || [])], wanted));
        const done = ids.filter(id => !wanted.includes(id) || present.has(id));
        if (done.length) nativeAckQuickAddEntries(done);
        if (done.length < ids.length) ingest();
      }, ACK_DELAY_MS);
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
