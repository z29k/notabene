// Shared client ⇄ server types for comments (no I/O here).
//
// ⚠️ DATA CONTRACT (`.notabene` = public API). The store is committed to git and
// read by the agent → its shape can't be broken silently. Versioned by a sidecar
// `<store>/meta.json` (`{ "schemaVersion": <n> }`, cf. SCHEMA_VERSION). Any shape
// change bumps `schemaVersion` + a migrator, never a silent mutation.

/** Store schema version (sidecar `<store>/meta.json`). */
export const SCHEMA_VERSION = 1;

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

export interface CommentReply {
  author: string;
  body: string;
  ts: string;
}

export type CommentStatus = "open" | "addressed" | "resolved";
/** A space key (notabene.config root) — free string, no fixed duo. */
export type CommentSpace = string;
export type CommentScope = "selection" | "page";

export interface Comment {
  id: string;
  /** Space = the `key` of a notabene.config root (e.g. reference, workbench). */
  space: CommentSpace;
  /** Logical repo-relative page path (= data-page), e.g. docs/architecture/billing. */
  page: string;
  scope: CommentScope;
  /** null for a page-wide comment. */
  anchor: CommentAnchor | null;
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
