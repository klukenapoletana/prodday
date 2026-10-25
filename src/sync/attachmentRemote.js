// The attachment files on the sync server (utils/attachments.js): one file per
// attachment in an `anhaenge` folder beside the sync file, holding its bytes
// as base64 (utils/attachmentStore.js keeps the same text on the device).
// Kept out of the sync JSON on purpose: that file is read and written whole
// on every cycle, and photos would make each cycle carry megabytes.
//
// The same server, account and folder as the file-tier sync, reached through
// the same provider code (@glance-apps/sync), so the Android bridge, the
// desktop proxy and the web proxy all work as they do for the sync file. No
// encryption yet: attachments are stored as they are, even when the sync file
// is encrypted (a known limit, see the settings note).
//
// Uploads and deletions go through a queue in localStorage, so an attachment
// added offline is sent when the server is next reachable, and a failed
// request is tried again rather than lost. A file another device attached is
// fetched when it is opened, then kept on this device.

import { createProviders, webdavFetch } from '@glance-apps/sync';
import { DAYGLANCE_CONFIG } from './adapter.js';
import { resolveSyncTarget } from './syncTarget.js';
import { normalizeSyncFolder } from '../utils/syncFolder.js';
import { readAttachmentFile, writeAttachmentFile } from '../utils/attachmentStore.js';

export const ATTACHMENT_FOLDER = 'anhaenge';
export const PENDING_KEY = 'prodday-attachments-pending';
const CONFIG_KEY = 'day-planner-cloud-sync-config';
export const QUEUE_EVENT = 'prodday-attachments-queued';

const fileName = (id) => `${encodeURIComponent(id)}.b64`;

/** The saved sync config, or null. */
export function readCloudConfig(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * put / get / del for attachment files on the configured server, or null when
 * sync is off or not set up (attachments then stay on this device).
 * `deps.fetcher` replaces the WebDAV transport in tests.
 */
export function attachmentRemote(config, deps = {}) {
  if (!config?.enabled) return null;
  const folder = normalizeSyncFolder(config.syncFolder);
  if (!resolveSyncTarget(config, folder)) return null;
  const engineConfig = { ...DAYGLANCE_CONFIG, appFolderName: folder };
  const provider = createProviders(engineConfig)[config.provider];
  if (!provider) return null;
  const wf = deps.fetcher || webdavFetch(engineConfig);
  const base = provider.getDirUrl(config);
  const dir = `${base}${ATTACHMENT_FOLDER}/`;
  const auth = provider.getAuthHeaders(config);
  const url = (id) => `${dir}${fileName(id)}`;

  const ensureFolder = async () => {
    // The sync folder normally exists; create it too if this device is first.
    for (const target of [base, dir]) {
      const res = await wf('MKCOL', target, auth);
      if (!res.ok && ![405, 409].includes(res.status)) throw new Error(`MKCOL ${res.status}`);
    }
  };

  return {
    async put(id, data) {
      const send = () => wf('PUT', url(id), auth, data, { 'Content-Type': 'text/plain' });
      let res = await send();
      if (res.status === 404 || res.status === 409) {
        await ensureFolder();
        res = await send();
      }
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return true;
    },
    async get(id) {
      const res = await wf('GET', url(id), auth);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      return res.text();
    },
    async del(id) {
      const res = await wf('DELETE', url(id), auth);
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
      return true;
    },
  };
}

// ── The queue ────────────────────────────────────────────────────────────────

export function readQueue(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(PENDING_KEY) || '[]');
    return Array.isArray(list) ? list.filter((e) => e && (e.op === 'put' || e.op === 'del') && typeof e.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeQueue(list, storage = globalThis.localStorage) {
  try { storage?.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* full: retried next time */ }
}

const announce = () => {
  try { globalThis.window?.dispatchEvent(new CustomEvent(QUEUE_EVENT)); } catch { /* not in a browser */ }
};

/** Send this file to the server when it is next reachable. */
export function queueUpload(id, storage) {
  writeQueue([...readQueue(storage).filter((e) => e.id !== id), { op: 'put', id }], storage);
  announce();
}

/** Remove this file from the server when it is next reachable. */
export function queueDelete(id, storage) {
  writeQueue([...readQueue(storage).filter((e) => e.id !== id), { op: 'del', id }], storage);
  announce();
}

let flushing = null;

/**
 * Work through the queue, oldest first. A request that fails stops the run
 * and stays queued (the server or the network is down; the next run tries
 * again). A file this device no longer has is dropped from the queue.
 * Returns how many entries were done.
 */
export function flushAttachmentQueue({ remote = attachmentRemote(readCloudConfig()), storage, read = readAttachmentFile } = {}) {
  if (!remote) return Promise.resolve(0);
  if (flushing) return flushing;
  flushing = (async () => {
    let done = 0;
    for (const entry of readQueue(storage)) {
      try {
        if (entry.op === 'put') {
          const file = await read(entry.id);
          if (file) await remote.put(entry.id, file.data);
        } else {
          await remote.del(entry.id);
        }
      } catch {
        break;
      }
      writeQueue(readQueue(storage).filter((e) => !(e.id === entry.id && e.op === entry.op)), storage);
      done += 1;
    }
    return done;
  })().finally(() => { flushing = null; });
  return flushing;
}

/**
 * The file for an attachment: from this device, or fetched from the server
 * and kept here. Null when neither has it (not uploaded yet, or offline).
 */
export async function loadAttachment(attachment, {
  remote = attachmentRemote(readCloudConfig()), read = readAttachmentFile, write = writeAttachmentFile,
} = {}) {
  const local = await read(attachment.id);
  if (local) return local;
  if (!remote) return null;
  let data = null;
  try { data = await remote.get(attachment.id); } catch { return null; }
  if (!data) return null;
  const file = { mime: attachment.mime, data: data.trim() };
  await write(attachment.id, file);
  return file;
}
