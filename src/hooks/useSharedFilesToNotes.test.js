import { beforeEach, describe, it, expect, vi } from 'vitest';

const react = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [] }));
vi.mock('react', () => ({
  useRef: (initial) => { const i = react.cursor++; return react.slots[i] ??= { current: initial }; },
  useEffect: (effect, deps) => {
    const i = react.cursor++;
    const slot = react.slots[i] ??= {};
    if (!slot.deps || deps.some((d, n) => d !== slot.deps[n])) {
      react.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      slot.deps = deps;
    }
  },
}));
const native = vi.hoisted(() => ({ batches: [], acked: [] }));
vi.mock('../native.js', () => ({
  isNativeAndroid: () => true,
  nativePeekSharedFiles: () => native.batches.slice(),
  nativeReadSharedFileChunk: (id, offset) => (offset === 0 ? 'YWJj' : ''),
  nativeAckSharedFiles: (ids) => { native.acked.push(...ids); native.batches = native.batches.filter(b => !ids.includes(b.batchId)); },
}));
vi.mock('../utils/attachmentStore.js', () => ({
  base64ToBlob: vi.fn(), blobToBase64: vi.fn(), writeAttachmentFile: vi.fn(async () => {}),
}));
vi.mock('../sync/attachmentRemote.js', () => ({ queueUpload: vi.fn() }));
import useSharedFilesToNotes, { readSharedFile } from './useSharedFilesToNotes.js';
import { SHARE_CHUNK_BYTES } from '../utils/sharedFilesNote.js';

describe('readSharedFile', () => {
  it('joins the pieces into the whole file', () => {
    const bytes = new Uint8Array(SHARE_CHUNK_BYTES * 2 + 10).map((_, i) => i % 251);
    const b64 = (u8) => Buffer.from(u8).toString('base64');
    const read = (id, offset, length) => (offset >= bytes.length ? '' : b64(bytes.subarray(offset, offset + length)));
    expect(readSharedFile('x', read)).toBe(b64(bytes));
  });

  it('a file of exactly one piece needs no second read past it', () => {
    const bytes = new Uint8Array(SHARE_CHUNK_BYTES).fill(7);
    let calls = 0;
    const read = (id, offset, length) => { calls += 1; return offset >= bytes.length ? '' : Buffer.from(bytes.subarray(offset, offset + length)).toString('base64'); };
    expect(readSharedFile('x', read)).toBe(Buffer.from(bytes).toString('base64'));
    expect(calls).toBe(2);
  });

  it('an unreadable file is empty', () => {
    expect(readSharedFile('gone', () => '')).toBe('');
  });
});

describe('useSharedFilesToNotes', () => {
  let notes;
  let props;
  let syncing;
  const created = [];
  const setUnscheduledTasks = (fn) => { notes = fn(notes); render(); };
  const render = (next) => {
    if (next) props = next;
    react.cursor = 0;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSharedFilesToNotes({
      setUnscheduledTasks, unscheduledTasks: notes, recycleBin: [], defaultColor: 'bg-blue-500',
      fallbackTitle: 'Geteilt', onCreated: (id) => created.push(id), onSkipped: () => {},
      isSyncBusy: () => syncing, ...props,
    });
    react.effects.splice(0).forEach((run) => run());
  };
  const flush = () => vi.advanceTimersByTimeAsync(0);

  beforeEach(() => {
    vi.useFakeTimers();
    react.slots = []; react.effects = [];
    native.batches = [{ batchId: 'b1', subject: 'Rechnung', files: [{ id: 'f1', name: 'r.pdf', mime: 'application/pdf', size: 3 }] }];
    native.acked = [];
    notes = [{ id: 'old', title: 'Einkauf', isNote: true }];
    syncing = false;
    props = {};
    created.length = 0;
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('window', {});
  });

  it('makes the note and opens it, and takes the share only once the note is in the state', async () => {
    render({ dataLoaded: true });
    await flush();
    expect(notes.map(n => n.id)).toEqual(['old', 'share-b1']);
    expect(created).toEqual(['share-b1']);
    expect(native.acked).toEqual([]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual(['b1']);
  });

  it('adds the note only after a sync cycle in flight, whose apply would replace the notes', async () => {
    syncing = true;
    render({ dataLoaded: true });
    await vi.advanceTimersByTimeAsync(2000);
    expect(notes.map(n => n.id)).toEqual(['old']);
    syncing = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(notes.map(n => n.id)).toEqual(['old', 'share-b1']);
  });

  it('a note the state lost after all keeps its share, and is made again', async () => {
    render({ dataLoaded: true });
    await flush();
    notes = [{ id: 'old', title: 'Einkauf', isNote: true }]; // an apply replaced the notes
    render();
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual([]);
    expect(notes.map(n => n.id)).toEqual(['old', 'share-b1']);
    await vi.advanceTimersByTimeAsync(3000);
    expect(native.acked).toEqual(['b1']);
  });
});
