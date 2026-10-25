// Where the caret of a textarea sits, in px from the textarea's top edge, and
// scrolling a container so it shows. A textarea that grows with its text (the
// full-screen note editor) leaves the scrolling to its container, which the
// browser does not move to the caret on its own when the keyboard opens.
// Measured with a mirror: a div styled like the textarea, holding the text up
// to the caret, wraps exactly as the textarea does.

const MIRRORED = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
  'textTransform', 'wordSpacing', 'textIndent', 'tabSize',
];

/** { top, height } of the caret line, relative to the textarea's top edge. */
export function caretPosition(textarea) {
  const doc = textarea.ownerDocument;
  const style = doc.defaultView.getComputedStyle(textarea);
  const mirror = doc.createElement('div');
  for (const prop of MIRRORED) mirror.style[prop] = style[prop];
  Object.assign(mirror.style, {
    position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px',
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: style.wordBreak,
  });
  mirror.textContent = textarea.value.slice(0, textarea.selectionEnd);
  const marker = doc.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  doc.body.appendChild(mirror);
  const top = marker.offsetTop;
  const lineHeight = parseFloat(style.lineHeight) || marker.offsetHeight || 20;
  doc.body.removeChild(mirror);
  return { top, height: lineHeight };
}

/** Scroll `container` so the caret of `textarea` (inside it) is in view, with a margin. */
export function revealCaret(textarea, container, margin = 24) {
  if (!textarea || !container) return;
  const { top, height } = caretPosition(textarea);
  const offset = textarea.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const caretTop = offset + top - textarea.scrollTop;
  const caretBottom = caretTop + height;
  if (caretBottom + margin > container.scrollTop + container.clientHeight) {
    container.scrollTop = caretBottom + margin - container.clientHeight;
  } else if (caretTop - margin < container.scrollTop) {
    container.scrollTop = Math.max(0, caretTop - margin);
  }
}
