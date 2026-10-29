// Files and text shared to the app from another app (Android:
// data/SharedFilesInbox.kt) become one note per share, the files its
// attachments (utils/attachments.js).
// Pure: the hook (hooks/useSharedFilesToNotes.js) reads the files and stores
// them; this decides what the note says.
//
// The note's id comes from the share, so reading the same share twice (the
// app died before acknowledging it) makes no second note.

import { kindOf } from './attachments.js';

export const noteIdForShare = (batchId) => `share-${batchId}`;

const withoutExtension = (name) => String(name || '').replace(/\.[^./]+$/, '');

const TITLE_MAX = 120;

/**
 * The note for a share: { title, notes }. The title is the shared subject, or
 * the first file's name (without extension); the shared text becomes the
 * note's text. Text shared alone with no subject (a note from a notes app)
 * gives its first line as the title and the rest as the text, unless that
 * line is too long to be a title, when the whole text stays the text.
 * `fallbackTitle` when there is nothing else.
 */
export function noteTextForShare(batch, fallbackTitle) {
  const subject = String(batch?.subject || '').trim();
  const text = String(batch?.text || '').trim();
  const firstFile = (batch?.files || []).find((f) => f?.name);
  const fileTitle = withoutExtension(firstFile?.name).trim();
  if (!subject && !fileTitle && text) {
    const newline = text.indexOf('\n');
    const first = (newline === -1 ? text : text.slice(0, newline)).replace(/^(#{1,6}\s+|[-*]\s+(\[[ xX]\]\s+)?)/, '').trim();
    if (first && first.length <= TITLE_MAX) {
      return { title: first, notes: newline === -1 ? '' : text.slice(newline + 1).trim() };
    }
    return { title: fallbackTitle, notes: text };
  }
  const title = (subject || fileTitle || fallbackTitle).slice(0, TITLE_MAX);
  return { title, notes: text && text !== subject ? text : '' };
}

/** The shared files the app can attach (images, PDFs, audio), in order. */
export const attachableFiles = (batch) =>
  (batch?.files || []).filter((f) => f && typeof f.id === 'string' && f.id && kindOf(f.mime, f.name));

/** Chunk size for reading a file through the bridge: a multiple of 3, so the base64 pieces join. */
export const SHARE_CHUNK_BYTES = 3 * 256 * 1024;
