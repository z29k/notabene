// Pure helpers for block (diagram/image) comment anchoring. Kept DOM-free so they're
// unit-tested; the DOM wiring lives in components/Comments.astro.
export type BlockKind = "mermaid" | "image";

/** Small, stable, non-crypto hash (djb2 → base36) for content identity. */
export function hashSource(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Content-based identity for a block: mermaid → hash of source; image → its src. */
export function blockKey(kind: BlockKind, content: string): string {
  return kind === "mermaid" ? `mermaid:${hashSource(content.trim())}` : `image:${content}`;
}

/** Human/agent-readable label for a Mermaid diagram: "<type>: <first content line>". */
export function mermaidLabel(source: string): string {
  const lines = source
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const type = (lines[0] || "diagram").split(/\s+/)[0];
  const body = lines.slice(1).find(Boolean);
  return (body ? `${type}: ${body}` : type).slice(0, 80);
}

/** Label for an image: its alt text, else the filename from the src. */
export function imageLabel(src: string, alt: string): string {
  if (alt.trim()) return alt.trim().slice(0, 80);
  const base = (src.split(/[?#]/)[0].split("/").pop() || src).trim();
  return (base || src).slice(0, 80);
}

/**
 * Match a stored block anchor to a position in the page's ordered blocks: prefer the
 * SAME key at the SAME index; else the first block with the same key (survives
 * reordering); else the same index if in range; else -1 (orphaned). Content wins over
 * position, position disambiguates duplicate content.
 */
export function matchBlockIndex(anchor: { key: string; index: number }, blocks: { key: string }[]): number {
  const sameKey = blocks.map((b, i) => (b.key === anchor.key ? i : -1)).filter((i) => i >= 0);
  if (sameKey.includes(anchor.index)) return anchor.index;
  if (sameKey.length) return sameKey[0];
  if (anchor.index >= 0 && anchor.index < blocks.length) return anchor.index;
  return -1;
}
