// The attachment files on this device (utils/attachments.js): one IndexedDB
// row per file, { mime, data } with the bytes as base64. Base64 because the
// same text goes to the sync server unchanged (sync/attachmentRemote.js), and
// the Android HTTP bridge carries text only. A file missing here is fetched
// from the server when it is opened.

import { createIdbKeyValue } from './idbKeyValue.js';

export const ATTACHMENT_DB = 'prodday-attachments';
let backend = null;
const kv = () => (backend ??= createIdbKeyValue(ATTACHMENT_DB));
const keyOf = (id) => `file:${id}`;

/** Tests swap the database for an in-memory store. */
export function setAttachmentBackend(next) { backend = next; }

/** { mime, data } for an attachment, or null when this device does not have it. */
export async function readAttachmentFile(id) {
  const row = await kv().get(keyOf(id));
  return row && typeof row.data === 'string' ? row : null;
}

export async function writeAttachmentFile(id, { mime, data }) {
  return kv().set(keyOf(id), { mime, data });
}

export async function deleteAttachmentFile(id) {
  return kv().del(keyOf(id));
}

/** A Blob or File as base64 (no "data:" prefix). */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Base64 back to a Blob of type `mime`. */
export function base64ToBlob(data, mime) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}
