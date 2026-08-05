// Pure splice logic for the in-page editor — the safety core of `PUT /api/page`.
//
// The editor never re-serializes a file: it replaces the SOURCE RANGE of the block(s)
// the user opened and leaves every other byte untouched. Two things make that safe, and
// both live here (no fs, no config, no Astro → unit-testable in isolation):
//
//  1. RE-ANCHORING, BOUNDED TO BLOCK FRONTIERS. The `[start,end)` the client sends comes
//     from a `data-nb-src` stamp baked into the HTML at render time; between that render
//     and the save the file may have moved under us (the agent writes, HMR hasn't run).
//     So the range is a HINT and `original` is the contract: we re-locate it among the
//     CURRENT top-level block ranges. Because candidates are only ever whole runs of
//     blocks, a match can never land inside a code fence — a plain string search could,
//     and the invariant below would not notice (the contaminated block would look like
//     "the edited block").
//
//  2. THE CONTAINMENT INVARIANT. A perfectly well-formed replacement can still change how
//     NEIGHBOURING bytes parse: a paragraph turned into a list next to an existing list
//     merges with it; an unterminated fence swallows the rest of the file. So we splice,
//     RE-PARSE, and refuse the write unless every untouched top-level block comes back
//     byte-identical (shifted) and of the same type. Cheap, and it is the only check that
//     covers hazards we haven't thought of.
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const parser = unified().use(remarkParse).use(remarkGfm);

export interface BlockRange {
  /** Offset of the block's first character in the body (frontmatter already stripped). */
  start: number;
  /** Offset just past the block's last character. */
  end: number;
  /** mdast node type ("paragraph", "heading", "code", "html"…). */
  type: string;
}

/** Top-level block ranges of a markdown body, in document order. */
export function blockRanges(body: string): BlockRange[] {
  const tree = parser.parse(body) as unknown as {
    children: { type: string; position?: { start?: { offset?: number }; end?: { offset?: number } } }[];
  };
  const out: BlockRange[] = [];
  for (const node of tree.children ?? []) {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (typeof start === "number" && typeof end === "number") out.push({ start, end, type: node.type });
  }
  return out;
}

/** Dominant line ending of a source. A CRLF file must never come back mixed. */
export function detectEol(source: string): "\n" | "\r\n" {
  const crlf = (source.match(/\r\n/g) ?? []).length;
  const lf = (source.match(/\n/g) ?? []).length - crlf;
  return crlf > lf ? "\r\n" : "\n";
}

/** Rewrite every line ending of `text` to `eol`. */
export function normalizeEol(text: string, eol: string): string {
  const lf = text.replace(/\r\n/g, "\n");
  return eol === "\r\n" ? lf.replace(/\n/g, "\r\n") : lf;
}

export interface LocatedRange {
  start: number;
  end: number;
  /** Index of the first covered block in `blocks`. */
  first: number;
  /** Index of the last covered block in `blocks`. */
  last: number;
}

/**
 * Find where `original` lives in `body` NOW, considering only whole runs of contiguous
 * top-level blocks. `[start,end)` is tried first (the common case: nothing moved); the
 * fallback accepts a run only when it is the UNIQUE match — an ambiguous or absent
 * `original` is a 409, never a guess.
 */
export function locateRange(
  body: string,
  blocks: BlockRange[],
  start: number,
  end: number,
  original: string,
): LocatedRange | null {
  // Line endings are compared LF-normalized (a browser hands back LF even from a CRLF
  // file), but offsets index the RAW body — so only normalize when there is a \r to fold.
  const hasCr = body.includes("\r");
  const want = original.includes("\r") ? original.replace(/\r\n/g, "\n") : original;
  const sliceOf = (a: number, b: number) => {
    const raw = body.slice(blocks[a].start, blocks[b].end);
    return hasCr ? raw.replace(/\r\n/g, "\n") : raw;
  };

  const first = blocks.findIndex((b) => b.start === start);
  const last = blocks.findIndex((b) => b.end === end);
  if (first !== -1 && last >= first && sliceOf(first, last) === want) {
    return { start, end, first, last };
  }

  // Re-anchor over contiguous runs of blocks. A run's raw length is monotonic in `b`, and
  // folding CRLF can only ever shorten it — so once a run is too long to fold down to
  // `want`, no longer run can match either: break out instead of slicing the rest.
  const maxRaw = hasCr ? want.length * 2 : want.length;
  let found: LocatedRange | null = null;
  for (let a = 0; a < blocks.length; a++) {
    for (let b = a; b < blocks.length; b++) {
      const rawLength = blocks[b].end - blocks[a].start;
      if (rawLength > maxRaw) break;
      if (rawLength < want.length) continue;
      if (sliceOf(a, b) !== want) continue;
      if (found) return null; // ambiguous → the caller answers 409 "moved"
      found = { start: blocks[a].start, end: blocks[b].end, first: a, last: b };
    }
  }
  return found;
}

export type SpliceResult =
  | { ok: true; next: string; start: number; end: number }
  | { ok: false; error: "moved" | "containment"; detail?: string };

export interface SpliceInput {
  /** Markdown body, frontmatter already stripped (offsets are relative to it). */
  body: string;
  /** Stamped range of the edited block(s) — a hint; `original` is the contract. */
  start: number;
  end: number;
  /** The block source the client was editing, as it was served. */
  original: string;
  /** Its replacement. Empty (after trimming) deletes the block. */
  markdown: string;
}

/**
 * Replace the located range with `markdown` and refuse anything that would disturb a
 * neighbouring block. Returns the new body plus the range the written block now occupies.
 */
export function spliceBlock({ body, start, end, original, markdown }: SpliceInput): SpliceResult {
  const eol = detectEol(body);
  const blocks = blockRanges(body);
  const at = locateRange(body, blocks, start, end, original);
  if (!at) return { ok: false, error: "moved" };

  // Only TRAILING whitespace is trimmed: a block slice never ends with any, but it may
  // legitimately BEGIN with some (four spaces = an indented code block).
  const md = normalizeEol(markdown, eol).replace(/[ \t\r\n]+$/, "");

  let s = at.start;
  let e = at.end;
  if (md === "") {
    // Deleting a block must take one blank-line separator with it, or the file is left
    // with a widening hole. Prefer the following one; at the end of the file, the previous.
    const following = blocks.some((b) => b.start >= e);
    if (following) e += (/^(?:\r?\n)+/.exec(body.slice(e)) ?? [""])[0].length;
    else s -= (/(?:\r?\n)+$/.exec(body.slice(0, s)) ?? [""])[0].length;
  }

  const next = body.slice(0, s) + md + body.slice(e);
  const detail = checkContainment({ body, next, blocks, first: at.first, last: at.last, s, e, mdLength: md.length });
  if (detail) return { ok: false, error: "containment", detail };
  return { ok: true, next, start: s, end: s + md.length };
}

interface ContainmentInput {
  body: string;
  next: string;
  blocks: BlockRange[];
  first: number;
  last: number;
  s: number;
  e: number;
  mdLength: number;
}

/** null = the splice is contained; a string = the human-readable reason it is not. */
function checkContainment({ body, next, blocks, first, last, s, e, mdLength }: ContainmentInput): string | null {
  const after = blockRanges(next);
  const byStart = new Map(after.map((b) => [b.start, b]));
  const delta = mdLength - (e - s);

  const replaced = after.filter((b) => b.start >= s && b.end <= s + mdLength).length;
  const expected = blocks.length - (last - first + 1) + replaced;
  if (expected !== after.length) {
    return `the replacement changes how neighbouring blocks parse (${blocks.length} block(s) before, ${after.length} after)`;
  }

  for (let k = 0; k < blocks.length; k++) {
    if (k >= first && k <= last) continue;
    const b = blocks[k];
    const moved = byStart.get(k < first ? b.start : b.start + delta);
    if (!moved || moved.type !== b.type || next.slice(moved.start, moved.end) !== body.slice(b.start, b.end)) {
      return `the replacement would alter the neighbouring ${b.type} block`;
    }
  }
  return null;
}
