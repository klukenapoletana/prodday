import { useEffect, useRef } from 'react';
import {
  isNativeAndroid, nativeAckSharedFiles, nativePeekSharedFiles, nativeReadSharedFileChunk,
} from '../native.js';
import { kindOf } from '../utils/attachments.js';
import { base64ToBlob, blobToBase64, writeAttachmentFile } from '../utils/attachmentStore.js';
import { prepareImage } from '../utils/imageResize.js';
import { queueUpload } from '../sync/attachmentRemote.js';
import { toNote } from '../utils/notes.js';
import {
  SHARE_CHUNK_BYTES, attachableFiles, noteIdForShare, noteTextForShare,
} from '../utils/sharedFilesNote.js';

// As in useQuickAddInbox: the share's copies on the device go only after the
// app's own save, so an app that dies in between reads them again.
const ACK_DELAY_MS = 3000;

/** A shared file's bytes as base64, read through the bridge in whole-group pieces. */
export function readSharedFile(id, read = nativeReadSharedFileChunk) {
  let data = '';
  for (let offset = 0; ; offset += SHARE_CHUNK_BYTES) {
    const chunk = read(id, offset, SHARE_CHUNK_BYTES);
    if (!chunk) break;
    data += chunk;
    if (chunk.length < (SHARE_CHUNK_BYTES / 3) * 4) break;
  }
  return data;
}

/**
 * Files shared to the app from other apps (Android: data/SharedFilesInbox.kt)
 * become notes with attachments (utils/sharedFilesNote.js), once the data has
 * loaded, when the app comes to the front, and at once when the shell reports
 * a share while the app runs (window.__prodCheckSharedFiles). The newest note
 * made opens (`onCreated`); files that could not be taken are reported
 * (`onSkipped`).
 */
export default function useSharedFilesToNotes({
  dataLoaded, unscheduledTasks, setUnscheduledTasks, defaultColor, fallbackTitle, onCreated, onSkipped, disabled = false,
}) {
  const latest = useRef({});
  latest.current = { unscheduledTasks, defaultColor, fallbackTitle, onCreated, onSkipped };

  useEffect(() => {
    if (disabled || !dataLoaded || !isNativeAndroid()) return undefined;
    let busy = false;
    const timers = new Set();

    const ingest = async () => {
      if (busy) return;
      const batches = nativePeekSharedFiles();
      if (!batches.length) return;
      busy = true;
      try {
        const { unscheduledTasks: current, defaultColor: color, fallbackTitle: fallback } = latest.current;
        const known = new Set((current || []).map(t => t.id));
        const notes = [];
        let skipped = 0;
        for (const batch of batches) {
          if (!batch?.batchId) continue;
          const id = noteIdForShare(batch.batchId);
          skipped += Number(batch.skipped) || 0;
          if (known.has(id)) continue;
          const attachments = [];
          for (const file of attachableFiles(batch)) {
            const kind = kindOf(file.mime, file.name);
            let data = readSharedFile(file.id);
            if (!data) { skipped += 1; continue; }
            let mime = file.mime || '';
            let name = file.name || file.id;
            let size = Number(file.size) || Math.floor((data.length * 3) / 4);
            if (kind === 'image') {
              const original = new File([base64ToBlob(data, mime)], name, { type: mime });
              const prepared = await prepareImage(original);
              if (prepared.blob !== original) {
                data = await blobToBase64(prepared.blob);
                mime = prepared.mime;
                name = prepared.name;
                size = prepared.blob.size;
              }
            }
            await writeAttachmentFile(file.id, { mime, data });
            queueUpload(file.id);
            attachments.push({ id: file.id, name, mime, kind, size, addedAt: new Date().toISOString() });
          }
          const { title, notes: text } = noteTextForShare(batch, fallback);
          notes.push(toNote({
            id,
            title,
            notes: text,
            color,
            duration: 30,
            completed: false,
            subtasks: [],
            createdAt: new Date().toISOString(),
            ...(attachments.length ? { attachments } : {}),
          }));
        }
        if (notes.length) {
          setUnscheduledTasks(prev => {
            const have = new Set(prev.map(t => t.id));
            const fresh = notes.filter(n => !have.has(n.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          latest.current.onCreated?.(notes[notes.length - 1].id);
        }
        if (skipped) latest.current.onSkipped?.(skipped);
        const ids = batches.map(b => b?.batchId).filter(Boolean);
        const timer = setTimeout(() => { timers.delete(timer); nativeAckSharedFiles(ids); }, ACK_DELAY_MS);
        timers.add(timer);
      } finally {
        busy = false;
      }
    };

    const run = () => { ingest().catch(() => { busy = false; }); };
    run();
    window.__prodCheckSharedFiles = run;
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (window.__prodCheckSharedFiles === run) delete window.__prodCheckSharedFiles;
      document.removeEventListener('visibilitychange', onVisible);
      timers.forEach(clearTimeout);
    };
  }, [dataLoaded, disabled, setUnscheduledTasks]);
}
