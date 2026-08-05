// Journal append — shared by `notabene journal add` (bin/) and POST /api/journal (the
// in-page editor's "describe this change?" prompt). One implementation, because two
// copies of an append that must stay atomic is exactly how a store contract rots.
//
// Raw-Node importable (bin/ runs outside Vite): no imports beyond node:*, mirroring
// lib/comment-mutate.mjs.
import fs from "node:fs";
import path from "node:path";

/** Journal entry id: date-prefixed so `journal.json` reads chronologically by eye. */
export function newEntryId(now, rand) {
  return `j-${String(now).slice(0, 10)}-${rand.toString(36).slice(2, 8)}`;
}

/**
 * Normalize whatever a caller supplies into a well-formed entry. PURE.
 * Unknown fields are preserved: the journal is a public data contract, and a future
 * field must survive a round trip through an older renderer.
 */
export function normalizeEntry(raw, { id, date }) {
  const entry = { ...(raw && typeof raw === "object" ? raw : {}) };
  entry.id = String(entry.id || id);
  entry.date = String(entry.date || date);
  entry.title = String(entry.title ?? "");
  entry.summary = String(entry.summary ?? "");
  entry.changes = Array.isArray(entry.changes)
    ? entry.changes.map((c) => ({
        page: String(c?.page ?? ""),
        commentIds: Array.isArray(c?.commentIds) ? c.commentIds.map(String) : [],
        what: String(c?.what ?? ""),
        why: String(c?.why ?? ""),
        ...(c?.ref ? { ref: String(c.ref) } : {}),
      }))
    : [];
  return entry;
}

/** Read `journal.json`, tolerating absence and a non-array payload. PURE-ish (fs read). */
export function readEntries(storeAbs) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(storeAbs, "journal.json"), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Append an entry atomically (temp + rename), then RE-READ to confirm it survived.
 *
 * Why the re-read: `journal.json` is a single array, so appending is read-modify-write.
 * The dev server and the agent's CLI can both do it at once, and the rename that makes
 * each write atomic does nothing to stop the second from clobbering the first. The window
 * is tiny and the loss is bounded to one entry — but it is silent, and a lost entry means
 * a comment resolution pointing at nothing (which `comments verify` then reports as an
 * error). One retry closes it cheaply.
 */
export function appendEntry(storeAbs, entry, { retries = 2 } = {}) {
  const file = path.join(storeAbs, "journal.json");
  for (let attempt = 0; ; attempt++) {
    const journal = readEntries(storeAbs);
    journal.push(entry);
    const tmp = `${file}.${process.pid}.${attempt}.tmp`;
    try {
      fs.writeFileSync(tmp, `${JSON.stringify(journal, null, 2)}\n`);
      fs.renameSync(tmp, file);
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      throw err;
    }
    if (readEntries(storeAbs).some((e) => e?.id === entry.id)) return entry;
    if (attempt >= retries) {
      throw new Error(`notabene: journal entry ${entry.id} was lost to a concurrent write`);
    }
  }
}
