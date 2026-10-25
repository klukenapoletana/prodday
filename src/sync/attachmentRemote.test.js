import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  attachmentRemote, queueUpload, queueDelete, readQueue, flushAttachmentQueue, loadAttachment,
} from './attachmentRemote.js';

const CONFIG = {
  enabled: true, provider: 'nextcloud', nextcloudUrl: 'https://cloud.example.org/', username: 'dave',
  appPassword: 'secret', syncFolder: 'GLANCE/dayglance',
};
const DIR = 'https://cloud.example.org/remote.php/dav/files/dave/GLANCE/dayglance/anhaenge/';

// A WebDAV server in memory: files by URL, folders that exist.
function fakeServer({ folders = ['https://cloud.example.org/remote.php/dav/files/dave/GLANCE/dayglance/'] } = {}) {
  const files = new Map();
  const dirs = new Set(folders);
  const calls = [];
  const res = (status, body = '') => ({ status, ok: status >= 200 && status < 300, text: async () => body });
  const parent = (url) => url.replace(/[^/]+\/?$/, '');
  const fetcher = vi.fn(async (method, url, auth, body) => {
    calls.push(`${method} ${url.replace(DIR, '…/anhaenge/')}`);
    expect(auth['X-WebDAV-Auth']).toMatch(/^Basic /);
    if (method === 'MKCOL') { if (dirs.has(url)) return res(405); dirs.add(url); return res(201); }
    if (method === 'PUT') { if (!dirs.has(parent(url))) return res(409); files.set(url, body); return res(201); }
    if (method === 'GET') return files.has(url) ? res(200, files.get(url)) : res(404);
    if (method === 'DELETE') return files.delete(url) ? res(204) : res(404);
    return res(500);
  });
  return { files, dirs, calls, fetcher };
}

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};

let storage;
beforeEach(() => { storage = memoryStorage(); });

describe('attachmentRemote', () => {
  it('is off without an enabled, complete sync config', () => {
    expect(attachmentRemote(null)).toBeNull();
    expect(attachmentRemote({ ...CONFIG, enabled: false })).toBeNull();
    expect(attachmentRemote({ ...CONFIG, nextcloudUrl: '' })).toBeNull();
  });

  it('puts a file into the anhaenge folder, creating it on first use, and reads it back', async () => {
    const server = fakeServer();
    const remote = attachmentRemote(CONFIG, { fetcher: server.fetcher });
    await remote.put('a1', 'SGFsbG8=');
    expect(server.calls).toEqual(['PUT …/anhaenge/a1.b64', expect.stringMatching(/^MKCOL /), 'MKCOL …/anhaenge/', 'PUT …/anhaenge/a1.b64']);
    expect(await remote.get('a1')).toBe('SGFsbG8=');
    expect(await remote.get('missing')).toBeNull();
    await remote.del('a1');
    expect(await remote.get('a1')).toBeNull();
    await remote.del('a1'); // already gone is fine
  });
});

describe('the queue', () => {
  it('keeps one pending operation per file, the latest', () => {
    queueUpload('a1', storage);
    queueUpload('a2', storage);
    queueDelete('a1', storage);
    expect(readQueue(storage)).toEqual([{ op: 'put', id: 'a2' }, { op: 'del', id: 'a1' }]);
  });

  it('flushes uploads and deletions, and keeps what failed for the next run', async () => {
    const server = fakeServer();
    const remote = attachmentRemote(CONFIG, { fetcher: server.fetcher });
    const read = async (id) => (id === 'gone' ? null : { mime: 'image/jpeg', data: `data-${id}` });
    queueUpload('a1', storage);
    queueUpload('gone', storage);
    expect(await flushAttachmentQueue({ remote, storage, read })).toBe(2);
    expect(readQueue(storage)).toEqual([]);
    expect(server.files.get(`${DIR}a1.b64`)).toBe('data-a1');

    // The server is down: nothing is lost.
    const down = { put: vi.fn(async () => { throw new Error('offline'); }), del: vi.fn() };
    queueUpload('a2', storage);
    queueDelete('a1', storage);
    expect(await flushAttachmentQueue({ remote: down, storage, read })).toBe(0);
    expect(readQueue(storage)).toEqual([{ op: 'put', id: 'a2' }, { op: 'del', id: 'a1' }]);
    expect(await flushAttachmentQueue({ remote, storage, read })).toBe(2);
    expect(server.files.has(`${DIR}a1.b64`)).toBe(false);
    expect(server.files.get(`${DIR}a2.b64`)).toBe('data-a2');
  });

  it('does nothing without a server', async () => {
    queueUpload('a1', storage);
    expect(await flushAttachmentQueue({ remote: null, storage })).toBe(0);
    expect(readQueue(storage)).toHaveLength(1);
  });
});

describe('loadAttachment', () => {
  it('reads this device first, else fetches from the server and keeps it', async () => {
    const server = fakeServer();
    const remote = attachmentRemote(CONFIG, { fetcher: server.fetcher });
    await remote.put('a1', 'U2VydmVy\n');
    const kept = new Map();
    const read = async (id) => kept.get(id) || null;
    const write = async (id, file) => { kept.set(id, file); };
    const att = { id: 'a1', mime: 'application/pdf' };
    expect(await loadAttachment(att, { remote, read, write })).toEqual({ mime: 'application/pdf', data: 'U2VydmVy' });
    expect(kept.get('a1')).toEqual({ mime: 'application/pdf', data: 'U2VydmVy' });
    server.calls.length = 0;
    await loadAttachment(att, { remote, read, write });
    expect(server.calls).toEqual([]); // from this device now
  });

  it('is null when neither has it, or the server cannot be reached', async () => {
    const read = async () => null;
    expect(await loadAttachment({ id: 'x' }, { remote: null, read })).toBeNull();
    const broken = { get: async () => { throw new Error('offline'); } };
    expect(await loadAttachment({ id: 'x' }, { remote: broken, read })).toBeNull();
  });
});
