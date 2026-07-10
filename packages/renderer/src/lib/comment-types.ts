// Shared client ⇄ server types for comments (no I/O here).
//
// ⚠️ DATA CONTRACT (`.notabene` = public API). The store is committed to git and
// read by the agent → its shape can't be broken silently. Versioned by a sidecar
// `<store>/meta.json` (`{ "schemaVersion": <n> }`, cf. SCHEMA_VERSION). Any shape
// change bumps `schemaVersion` + a migrator, never a silent mutation.

/** Store schema version (sidecar `<store>/meta.json`).
 *  v1: one JSON array per page, `<store>/<page>.json`.
 *  v2: one file per comment, `<store>/<page>/<id>.json` (conflict-free git merges).
 *  v3: block-scoped comments on diagrams/images — the anchor is a BlockAnchor.
 *  Readers are backward-compatible (v1 arrays + v2 files still read); writers emit v3. */
export const SCHEMA_VERSION = 3;

export interface CommentAnchor {
  /** Exact selected text (W3C TextQuoteSelector). */
  quote: string;
  /** ~32-40 chars of context before/after (disambiguates repeated quotes and
   *  anchors the rendered→source re-anchoring — load-bearing, don't remove). */
  prefix: string;
  suffix: string;
  /** Nearest heading above the selection (readable landmark). */
  section: string | null;
}

/** Anchor for a whole-block comment on a rendered diagram or image (no text to quote,
 *  v3). Identity is by CONTENT (`key`) so it survives reordering; `index` disambiguates
 *  duplicate keys on the same page. `label` is the human/agent-readable target. */
export interface BlockAnchor {
  kind: "mermaid" | "image";
  /** Content identity: mermaid → hash of the diagram source; image → its `src`. */
  key: string;
  /** Readable target: mermaid → "<type>: <first line>"; image → alt || filename. */
  label: string;
  /** Nearest heading above the block. */
  section: string | null;
  /** Ordinal among commentable blocks on the page (tiebreaker for duplicate keys). */
  index: number;
}

export interface CommentReply {
  author: string;
  body: string;
  ts: string;
}

export type CommentStatus = "open" | "addressed" | "resolved";
/** A space key (notabene.config root) — free string, no fixed duo. */
export type CommentSpace = string;
export type CommentScope = "selection" | "page" | "block";

export interface Comment {
  id: string;
  /** Space = the `key` of a notabene.config root (e.g. reference, workbench). */
  space: CommentSpace;
  /** Logical repo-relative page path (= data-page), e.g. docs/architecture/billing. */
  page: string;
  scope: CommentScope;
  /** TextQuoteSelector for `selection`, BlockAnchor for `block`, null for `page`. */
  anchor: CommentAnchor | BlockAnchor | null;
  thread: CommentReply[];
  status: CommentStatus;
  /** "On hold": work in progress on the user's side — the agent IGNORES these
   *  comments during an "address the comments" pass (until reactivated). */
  hold: boolean;
  /** Filled by the agent when it processes the comment. `journalEntryId` links the
   *  resolution to the `journal.json` entry describing it (cf. JournalEntry.id). */
  resolution: { note: string; journalEntryId?: string } | null;
  createdAt: string;
  updatedAt: string;
}
