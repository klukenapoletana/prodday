import { useEffect, useRef } from 'react';
import { flushAttachmentQueue, queueDelete, QUEUE_EVENT } from '../sync/attachmentRemote.js';
import { deleteAttachmentFile } from '../utils/attachmentStore.js';
import { referencedAttachmentIds } from '../utils/attachments.js';
import { sweepOrphans } from '../utils/attachmentOrphans.js';

const FLUSH_EVERY_MS = 60 * 1000;
const SWEEP_EVERY_MS = 5 * 60 * 1000;

/**
 * The attachment files in the background (utils/attachments.js): send what
 * is queued for the server (sync/attachmentRemote.js) at start, when a file
 * is queued, when the device comes back online and every minute; and delete
 * the files nothing refers to any more (utils/attachmentOrphans.js), only once
 * the data has loaded.
 */
export default function useAttachmentSync({ tasks, unscheduledTasks, recurringTasks, recycleBin, dataLoaded, disabled = false }) {
  const listsRef = useRef({ tasks, unscheduledTasks, recurringTasks, recycleBin });
  listsRef.current = { tasks, unscheduledTasks, recurringTasks, recycleBin };

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return undefined;
    let timer = null;
    const flush = () => { flushAttachmentQueue().catch(() => {}); };
    const soon = () => { clearTimeout(timer); timer = setTimeout(flush, 800); };
    flush();
    const interval = setInterval(flush, FLUSH_EVERY_MS);
    window.addEventListener(QUEUE_EVENT, soon);
    window.addEventListener('online', flush);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener(QUEUE_EVENT, soon);
      window.removeEventListener('online', flush);
    };
  }, [disabled]);

  useEffect(() => {
    if (disabled || !dataLoaded) return undefined;
    const sweep = () => {
      const l = listsRef.current;
      const referenced = referencedAttachmentIds(l.tasks, l.unscheduledTasks, l.recurringTasks, l.recycleBin);
      sweepOrphans({
        referenced,
        remove: async (id) => { await deleteAttachmentFile(id); queueDelete(id); },
      }).catch(() => {});
    };
    sweep();
    const interval = setInterval(sweep, SWEEP_EVERY_MS);
    return () => clearInterval(interval);
  }, [disabled, dataLoaded]);
}
