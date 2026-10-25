// Attachments on a task (the editor's Attachments field,
// components/AttachmentsField.jsx): images, PDFs and audio.
//
// The task holds only a short list, `attachments`, of what is attached:
//   { id, name, mime, kind: 'image' | 'pdf' | 'audio', size, addedAt }
// It travels with the task through both sync tiers like its title. The files
// themselves are kept apart: on this device in IndexedDB
// (utils/attachmentStore.js), and on the sync server as one file each beside
// the sync file (sync/attachmentRemote.js), so the sync JSON stays small. A
// series keeps its attachments on the template; every occurrence shows them.

export const ATTACHMENT_KINDS = ['image', 'pdf', 'audio'];
/** What the file picker offers. */
export const ATTACHMENT_ACCEPT = 'image/*,application/pdf,audio/*';
/** The largest file taken, after an image is scaled down. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const NAME_MAX = 200;

/** 'image' | 'pdf' | 'audio' for a MIME type (or a file name), or null when it is none of them. */
export function kindOf(mime, name = '') {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('audio/')) return 'audio';
  // Some pickers report no type: the extension decides.
  const ext = String(name).toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'amr', '3gp', 'webm'].includes(ext)) return 'audio';
  return null;
}

/** A stored attachment entry, or null when it is not one. */
export function normalizeAttachment(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id) return null;
  const kind = ATTACHMENT_KINDS.includes(a.kind) ? a.kind : kindOf(a.mime, a.name);
  if (!kind) return null;
  const size = Number(a.size);
  return {
    id: a.id,
    name: String(a.name || a.id).slice(0, NAME_MAX),
    mime: typeof a.mime === 'string' && a.mime ? a.mime : (kind === 'pdf' ? 'application/pdf' : `${kind}/*`),
    kind,
    size: Number.isFinite(size) && size >= 0 ? Math.round(size) : 0,
    ...(typeof a.addedAt === 'string' ? { addedAt: a.addedAt } : {}),
  };
}

/** The task's valid attachments (an absent or broken field is none). */
export const attachmentsOf = (task) =>
  (Array.isArray(task?.attachments) ? task.attachments.map(normalizeAttachment).filter(Boolean) : []);

/**
 * The task with `attachments` set to `list`, the key gone when the list is
 * empty. `undefined` means the caller never loaded them: the task keeps its own.
 */
export function withAttachments(task, list) {
  if (list === undefined) return task;
  const clean = (list || []).map(normalizeAttachment).filter(Boolean);
  const { attachments: _old, ...rest } = task;
  return clean.length ? { ...rest, attachments: clean } : rest;
}

/** "820 KB", "1.4 MB" in the user's language. */
export function formatSize(bytes, locale = 'en') {
  const n = Number(bytes) || 0;
  const fmt = (v, digits) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);
  if (n < 1024) return `${fmt(n, 0)} B`;
  if (n < 1024 * 1024) return `${fmt(n / 1024, 0)} KB`;
  return `${fmt(n / (1024 * 1024), 1)} MB`;
}

/** Every attachment id a list of tasks refers to (to tell which files are still needed). */
export function referencedAttachmentIds(...lists) {
  const ids = new Set();
  for (const list of lists) {
    for (const task of list || []) for (const a of attachmentsOf(task)) ids.add(a.id);
  }
  return ids;
}
