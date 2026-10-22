// XML helpers shared by both renderers.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** Escapes user-provided text for XML text nodes and attribute values. */
export function esc(value) {
  // Drop control characters that are illegal in XML 1.0 (tab, LF and CR are kept).
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

/** Approximate width of monospace text: most mono fonts advance ~0.6em per glyph. */
export function textWidth(text, fontPx) {
  return [...String(text)].length * fontPx * 0.6;
}
