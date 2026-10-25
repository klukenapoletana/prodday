// Photos are scaled down when they are attached (utils/attachments.js): the
// longer edge to MAX_EDGE px, as JPEG. A phone photo of 4–8 MB becomes a few
// hundred KB, plenty for a note or a receipt. An image already that small, an
// animated GIF and an SVG are kept as they are, as is anything the browser
// cannot decode (HEIC on some devices): the original is better than nothing.

export const MAX_EDGE = 2000;
const QUALITY = 0.82;
const KEEP = ['image/gif', 'image/svg+xml'];

const decode = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall back to <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
};

/** The size an image of w×h is drawn at so its longer edge is at most `max`. */
export function fitWithin(w, h, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * The image to store for `file`: { blob, mime, name }. Scaled down when it is
 * larger than MAX_EDGE or than 1 MB, otherwise the file itself.
 */
export async function prepareImage(file) {
  const keep = { blob: file, mime: file.type || 'image/jpeg', name: file.name || 'image' };
  if (KEEP.includes(file.type)) return keep;
  let source;
  try { source = await decode(file); } catch { return keep; }
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  if (!w || !h || (Math.max(w, h) <= MAX_EDGE && file.size <= 1024 * 1024)) return keep;
  const { width, height } = fitWithin(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return keep;
  ctx.fillStyle = '#fff'; // a transparent PNG would turn black as JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob || blob.size >= file.size) return keep;
  const base = (file.name || 'image').replace(/\.[^.]+$/, '');
  return { blob, mime: 'image/jpeg', name: `${base}.jpg` };
}
