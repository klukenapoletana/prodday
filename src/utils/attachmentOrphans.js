// Deleting attachment files (utils/attachments.js), late and only for sure.
//
// A file is not deleted the moment its attachment goes, by its × or with an
// emptied recycle bin: both can be undone, and an undo would bring back the
// entry without its file. The id is marked instead, and a sweep deletes the
// file (here and on the server) once it has been marked for ORPHAN_GRACE_MS
// and no task anywhere refers to it: not the lists, not the recycle bin.
// A sync that brings the attachment back, or an undo, simply makes it
// referenced again, and the mark is dropped.
//
// The sweep only runs with the data loaded (useAttachmentSync): a list that
// has not loaded yet is "no information", never "nothing refers to it".

export const ORPHANS_KEY = 'prodday-attachments-orphans';
export const ORPHAN_GRACE_MS = 10 * 60 * 1000;

export function readOrphans(storage = globalThis.localStorage) {
  try {
    const map = JSON.parse(storage?.getItem(ORPHANS_KEY) || '{}');
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  } catch {
    return {};
  }
}

const writeOrphans = (map, storage = globalThis.localStorage) => {
  try { storage?.setItem(ORPHANS_KEY, JSON.stringify(map)); } catch { /* retried next time */ }
};

/** Mark attachment ids whose files may go once nothing refers to them. */
export function markOrphans(ids, { storage, now = Date.now() } = {}) {
  const list = [...(ids || [])].filter((id) => typeof id === 'string' && id);
  if (!list.length) return;
  const map = readOrphans(storage);
  for (const id of list) if (!map[id]) map[id] = now;
  writeOrphans(map, storage);
}

/**
 * Delete the marked files nothing refers to any more, once their grace has
 * passed. `referenced` is the set of ids every task still holds (lists and
 * recycle bin, utils/attachments.js referencedAttachmentIds); `remove(id)`
 * deletes one file here and queues its deletion on the server. Returns the
 * ids removed.
 */
export async function sweepOrphans({ referenced, remove, storage, now = Date.now() }) {
  const map = readOrphans(storage);
  const removed = [];
  for (const [id, markedAt] of Object.entries(map)) {
    if (referenced.has(id)) { delete map[id]; continue; }
    if (now - Number(markedAt) < ORPHAN_GRACE_MS) continue;
    try {
      await remove(id);
      delete map[id];
      removed.push(id);
    } catch { /* kept for the next sweep */ }
  }
  writeOrphans(map, storage);
  return removed;
}
