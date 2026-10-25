import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CloudOff, FileText, Loader, Music, Paperclip, X } from 'lucide-react';
import {
  ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, attachmentsOf, formatSize, kindOf,
} from '../utils/attachments.js';
import { base64ToBlob, blobToBase64, writeAttachmentFile } from '../utils/attachmentStore.js';
import { prepareImage } from '../utils/imageResize.js';
import { loadAttachment, queueUpload } from '../sync/attachmentRemote.js';
import { nativeOpenFile } from '../native.js';

// Object URLs for files already shown, by attachment id, so a thumbnail is
// decoded once per session rather than on every render.
const urls = new Map();

/** The file of an attachment as an object URL: { url, state: 'loading' | 'ready' | 'missing' }. */
function useAttachmentUrl(att, retry) {
  const [state, setState] = useState(() => (urls.has(att.id) ? { url: urls.get(att.id), state: 'ready' } : { url: null, state: 'loading' }));
  useEffect(() => {
    if (urls.has(att.id)) { setState({ url: urls.get(att.id), state: 'ready' }); return undefined; }
    let alive = true;
    setState({ url: null, state: 'loading' });
    loadAttachment(att).then((file) => {
      if (!alive) return;
      if (!file) { setState({ url: null, state: 'missing' }); return; }
      const url = URL.createObjectURL(base64ToBlob(file.data, file.mime || att.mime));
      urls.set(att.id, url);
      setState({ url, state: 'ready' });
    }).catch(() => alive && setState({ url: null, state: 'missing' }));
    return () => { alive = false; };
  }, [att.id, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** An attachment over the whole screen: the image, a player for audio. */
function AttachmentViewer({ att, url, onClose }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[95] bg-black/95 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      onClick={onClose}
      data-attachment-viewer
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
        <span className="truncate text-sm">{att.name}</span>
        <button type="button" onClick={onClose} className="p-2 rounded-lg" aria-label={t('common.close')}>
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
        {att.kind === 'image' && <img src={url} alt={att.name} className="max-w-full max-h-full object-contain" />}
        {att.kind === 'audio' && (
          <div className="w-full max-w-md flex flex-col items-center gap-4 text-white">
            <Music size={48} className="opacity-70" />
            <audio src={url} controls autoPlay className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentTile({ att, onRemove, onOpen, darkMode }) {
  const { t, i18n } = useTranslation();
  const [retry, setRetry] = useState(0);
  const { url, state } = useAttachmentUrl(att, retry);
  const Icon = att.kind === 'pdf' ? FileText : Music;
  const open = () => {
    if (state === 'missing') { setRetry((n) => n + 1); return; }
    if (state === 'ready') onOpen(att, url);
  };
  return (
    <div className="relative" data-attachment={att.kind}>
      <button
        type="button"
        onClick={open}
        className={`w-full aspect-square rounded-lg overflow-hidden flex flex-col items-center justify-center gap-1 border ${
          darkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-stone-200 bg-stone-100 text-stone-700'
        }`}
        aria-label={att.name}
        title={att.name}
      >
        {state === 'loading' && <Loader size={20} className="animate-spin opacity-60" />}
        {state === 'missing' && (
          <>
            <CloudOff size={20} className="opacity-60" />
            <span className="text-[10px] px-1 text-center leading-tight opacity-80">{t('attachments.unavailable')}</span>
          </>
        )}
        {state === 'ready' && att.kind === 'image' && <img src={url} alt="" className="w-full h-full object-cover" />}
        {state === 'ready' && att.kind !== 'image' && (
          <>
            <Icon size={26} className={att.kind === 'pdf' ? 'text-red-500' : 'text-blue-500'} />
            <span className="text-[11px] px-1.5 w-full truncate text-center">{att.name}</span>
            <span className="text-[10px] opacity-70">{formatSize(att.size, i18n.resolvedLanguage || 'en')}</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => onRemove(att)}
        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
        aria-label={t('attachments.remove', { name: att.name })}
        data-attachment-remove
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * The Attachments field (utils/attachments.js): images, PDFs and audio as
 * tiles, a photo from the camera or a file from the device. `attachments` is
 * the current list and `onChange` writes a new one; the files themselves are
 * stored on this device and queued for the sync server as they are added.
 * An image opens over the screen, audio in a player; a PDF opens in the app
 * the device has for it.
 */
const AttachmentsField = ({ attachments, onChange, darkMode, textSecondary, borderClass }) => {
  const { t } = useTranslation();
  const list = attachmentsOf({ attachments });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [viewing, setViewing] = useState(null);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(list);
  listRef.current = list;

  const addFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const added = [];
    let refused = 0;
    let tooLarge = 0;
    for (const file of files) {
      const kind = kindOf(file.type, file.name);
      if (!kind) { refused += 1; continue; }
      try {
        const prepared = kind === 'image' ? await prepareImage(file) : { blob: file, mime: file.type, name: file.name };
        if (prepared.blob.size > MAX_ATTACHMENT_BYTES) { tooLarge += 1; continue; }
        const data = await blobToBase64(prepared.blob);
        const id = crypto.randomUUID();
        const mime = prepared.mime || file.type || (kind === 'pdf' ? 'application/pdf' : '');
        await writeAttachmentFile(id, { mime, data });
        urls.set(id, URL.createObjectURL(prepared.blob));
        queueUpload(id);
        added.push({ id, name: prepared.name || file.name || id, mime, kind, size: prepared.blob.size, addedAt: new Date().toISOString() });
      } catch {
        refused += 1;
      }
    }
    if (added.length) onChange([...listRef.current, ...added]);
    if (tooLarge) setMessage(t('attachments.tooLarge', { size: formatSize(MAX_ATTACHMENT_BYTES) }));
    else if (refused) setMessage(t('attachments.unsupported'));
    setBusy(false);
  };

  const open = (att, url) => {
    if (att.kind !== 'pdf') { setViewing({ att, url }); return; }
    // A PDF opens in the device's own viewer; a browser shows it in a tab.
    loadAttachment(att).then((file) => {
      if (!file) return;
      const native = nativeOpenFile(att.name, file.data, file.mime || att.mime);
      if (!native) window.open(url, '_blank', 'noopener');
      else if (!native.success) setMessage(t('attachments.openFailed'));
    });
  };

  const pick = (ref) => { if (!busy) ref.current?.click(); };
  const chip = `inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-full border border-dashed ${borderClass} ${textSecondary}`;

  return (
    <div data-attachments-field>
      <label className={`flex items-center gap-1.5 text-sm ${textSecondary} mb-1`}>
        <Paperclip size={14} />
        {t('attachments.title')}
        {busy && <Loader size={13} className="animate-spin" />}
      </label>
      {list.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
          {list.map((att) => (
            <AttachmentTile
              key={att.id}
              att={att}
              darkMode={darkMode}
              onOpen={open}
              onRemove={(a) => onChange(listRef.current.filter((x) => x.id !== a.id))}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip} onClick={() => pick(cameraRef)} disabled={busy} data-attachment-camera>
          <Camera size={14} />{t('attachments.photo')}
        </button>
        <button type="button" className={chip} onClick={() => pick(fileRef)} disabled={busy} data-attachment-file>
          <Paperclip size={14} />{t('attachments.file')}
        </button>
      </div>
      {message && <p className={`text-xs mt-1 ${darkMode ? 'text-amber-300' : 'text-amber-700'}`} data-attachment-message>{message}</p>}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; addFiles(f); }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        data-attachment-input
        onChange={(e) => { const f = [...(e.target.files || [])]; e.target.value = ''; addFiles(f); }}
      />
      {viewing && <AttachmentViewer att={viewing.att} url={viewing.url} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default AttachmentsField;
