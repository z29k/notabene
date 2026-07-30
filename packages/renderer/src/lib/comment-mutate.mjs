// Comment state transitions — the pure half of `notabene comments done|reopen`.
//
// WHY a CLI primitive at all: the protocol asks an agent to flip a comment's status and
// link it to a journal entry. Hand-editing that JSON is the single riskiest step of the
// loop (clobbered `thread`, dropped fields, and — the classic — `resolved` written in
// `approve` mode, which silently skips the human validation). One obedient command
// removes the whole class: the agent states the intent, the tool picks the status.
//
// Raw-Node importable (bin/ uses it outside Vite): no imports. Types mirror
// src/lib/comment-types.ts (Comment.status / .resolution / .thread).

export const STATUSES = ["open", "addressed", "resolved"];

/** The status a completed edit takes, per config `review`:
 *  "auto" → resolved (agent closes it) · "approve" → addressed (a human validates). */
export function statusForReview(reviewMode) {
  return String(reviewMode) === "approve" ? "addressed" : "resolved";
}

/**
 * Mark a comment as handled. Everything else on the comment is preserved verbatim.
 * @param {any} comment
 * @param {{ status: string, note?: string|null, journalEntryId?: string|null, now: string }} change
 */
export function applyDone(comment, { status, note = null, journalEntryId = null, now }) {
  if (!STATUSES.includes(status)) {
    throw new Error(`unknown status "${status}" (expected: ${STATUSES.join(", ")})`);
  }
  if (status === "open") throw new Error('use `comments reopen` to send a comment back to "open"');
  const resolution = { note: note ?? "" };
  if (journalEntryId) resolution.journalEntryId = journalEntryId;
  return { ...comment, status, resolution, updatedAt: now };
}

/**
 * Send a comment back to the agent (a human rejecting a proposed edit). The reason
 * becomes a normal thread reply — that is where the next pass reads it.
 * @param {any} comment
 * @param {{ reply?: string|null, author?: string, now: string }} change
 */
export function applyReopen(comment, { reply = null, author = "you", now }) {
  const thread = Array.isArray(comment.thread) ? [...comment.thread] : [];
  if (reply) thread.push({ author, body: reply, ts: now });
  return { ...comment, status: "open", resolution: null, thread, updatedAt: now };
}

/** Git-style identity used for a reply author: `Name <email>` (mirrors the browser's
 *  composeAuthor in lib/client/comments-client.ts). */
export function composeAuthor(name, email) {
  const n = String(name ?? "").trim();
  const e = String(email ?? "").trim();
  if (!n) return "you";
  return e ? `${n} <${e}>` : n;
}
