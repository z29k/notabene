// Store ⇄ journal coherence checks — the pure half of `notabene comments verify`.
//
// The store is a public contract that THIRD-PARTY agents now write to. This is the
// read-only audit of what one of them left behind (and a CI gate for consumers): every
// invariant the review UI and the protocol depend on, checked in one pass.
//
// The load-bearing one is RECIPROCITY: `/review` builds a comment's diff by INVERTING
// the journal, so a comment pointing at an entry that doesn't list it back shows the
// human an empty diff — the failure is silent in the UI and invisible in the store.
//
// Raw-Node importable (bin/ uses it outside Vite): no imports, no I/O — the caller
// passes what it read.

/** Findings are `{ level, code, message, file?, id? }`; `error` ⇒ exit 1. */
const err = (code, message, extra = {}) => ({ level: "error", code, message, ...extra });
const warn = (code, message, extra = {}) => ({ level: "warning", code, message, ...extra });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED = ["id", "space", "page", "scope", "status"];

/**
 * @param {{
 *   entries: { file: string, data: any, legacy?: boolean, error?: string }[],
 *   journal: any,
 *   meta: { schemaVersion?: number } | null,
 *   schemaVersion: number,
 *   pageExists?: (page: string) => boolean,
 * }} input — `entries` is one record per comment READ from the store (`file` is
 *   store-relative; `legacy` marks a v1 array member; `error` a parse failure).
 * @returns {{ level: string, code: string, message: string, file?: string, id?: string }[]}
 */
export function verifyStore({ entries, journal, meta, schemaVersion, pageExists }) {
  const findings = [];

  // --- store metadata -------------------------------------------------------
  if (!meta) {
    findings.push(warn("store-meta-missing", "no meta.json — run `notabene init` to stamp the schema version."));
  } else if (typeof meta.schemaVersion !== "number") {
    findings.push(warn("store-meta-invalid", "meta.json has no numeric schemaVersion."));
  } else if (meta.schemaVersion > schemaVersion) {
    findings.push(
      err(
        "store-schema-newer",
        `store schemaVersion ${meta.schemaVersion} is newer than this renderer (${schemaVersion}) — upgrade @z29k/notabene.`,
      ),
    );
  }

  // --- journal --------------------------------------------------------------
  const entryIds = new Set();
  const journalMembers = new Map(); // commentId → Set(journal entry id)
  if (journal !== null && !Array.isArray(journal)) {
    findings.push(err("journal-invalid", "journal.json must be a JSON array of entries.", { file: "journal.json" }));
  }
  for (const entry of Array.isArray(journal) ? journal : []) {
    const id = entry?.id;
    if (!id) {
      findings.push(err("journal-entry-no-id", "a journal entry has no id.", { file: "journal.json" }));
      continue;
    }
    if (entryIds.has(id)) {
      findings.push(err("journal-duplicate-id", `duplicate journal entry id "${id}".`, { file: "journal.json", id }));
    }
    entryIds.add(id);
    if (!DATE_RE.test(String(entry.date ?? ""))) {
      findings.push(
        warn("journal-bad-date", `journal entry "${id}": date should be YYYY-MM-DD.`, { file: "journal.json", id }),
      );
    }
    if (!entry.title) {
      findings.push(warn("journal-no-title", `journal entry "${id}" has no title.`, { file: "journal.json", id }));
    }
    if (!Array.isArray(entry.changes) || entry.changes.length === 0) {
      findings.push(
        err("journal-no-changes", `journal entry "${id}" records no changes[] — nothing to show at /review.`, {
          file: "journal.json",
          id,
        }),
      );
      continue;
    }
    for (const change of entry.changes) {
      if (!change?.page) {
        findings.push(
          err("journal-change-no-page", `journal entry "${id}" has a change without a page.`, {
            file: "journal.json",
            id,
          }),
        );
      }
      for (const cid of Array.isArray(change?.commentIds) ? change.commentIds : []) {
        if (!journalMembers.has(cid)) journalMembers.set(cid, new Set());
        journalMembers.get(cid).add(id);
      }
    }
  }

  // --- comments -------------------------------------------------------------
  const seen = new Map(); // id → file
  let legacy = 0;
  for (const { file, data, legacy: isLegacy, error } of entries) {
    if (error) {
      findings.push(err("comment-unreadable", `unreadable JSON: ${error}`, { file }));
      continue;
    }
    if (isLegacy) legacy++;
    const id = data?.id;
    if (!id) {
      findings.push(err("comment-no-id", "comment has no id.", { file }));
      continue;
    }
    const at = { file, id };
    if (seen.has(id)) {
      findings.push(err("comment-duplicate-id", `duplicate comment id "${id}" (also in ${seen.get(id)}).`, at));
    }
    seen.set(id, file);

    for (const key of REQUIRED) {
      if (data[key] === undefined || data[key] === null || data[key] === "") {
        findings.push(err("comment-missing-field", `missing "${key}".`, at));
      }
    }
    if (data.status !== undefined && !["open", "addressed", "resolved"].includes(data.status)) {
      findings.push(err("comment-bad-status", `unknown status "${data.status}".`, at));
    }
    if (data.hold !== undefined && typeof data.hold !== "boolean") {
      findings.push(err("comment-bad-hold", '"hold" must be a boolean.', at));
    }
    if (!Array.isArray(data.thread) || data.thread.length === 0) {
      findings.push(err("comment-empty-thread", "thread must hold at least the original comment.", at));
    }

    // v2 layout: the filename IS the id and the directory IS the page — the write
    // path (and `--page` filtering) resolves by convention, not by scanning.
    if (!isLegacy) {
      const base = file
        .split("/")
        .pop()
        ?.replace(/\.json$/, "");
      if (base && base !== id) {
        findings.push(err("comment-file-id-mismatch", `filename doesn't match id "${id}".`, at));
      }
      const dir = file.split("/").slice(0, -1).join("/");
      if (data.page && dir && dir !== data.page) {
        findings.push(err("comment-page-dir-mismatch", `lives outside its page dir "${data.page}".`, at));
      }
    }

    const handled = data.status === "resolved" || data.status === "addressed";
    if (handled) {
      const link = data.resolution?.journalEntryId;
      if (!data.resolution) {
        findings.push(err("comment-no-resolution", `"${data.status}" without a resolution.`, at));
      } else if (!link) {
        findings.push(err("comment-no-journal-link", `"${data.status}" without resolution.journalEntryId.`, at));
      } else if (Array.isArray(journal) && !entryIds.has(link)) {
        findings.push(err("comment-unknown-journal-entry", `journal entry "${link}" does not exist.`, at));
      } else if (Array.isArray(journal) && !journalMembers.get(id)?.has(link)) {
        // The /review diff is the journal inverted: no back-link → empty diff.
        findings.push(
          err(
            "comment-not-in-journal-changes",
            `journal entry "${link}" doesn't list this comment in any changes[] — /review would show an empty diff.`,
            at,
          ),
        );
      }
    } else if (data.status === "open" && data.resolution) {
      findings.push(warn("comment-open-with-resolution", "reopened but keeps a stale resolution.", at));
    }

    if (pageExists && data.page && !pageExists(data.page)) {
      findings.push(warn("comment-page-missing", `page "${data.page}" has no source file.`, at));
    }
  }

  // Journal → comments (dangling references, e.g. a comment deleted by hand).
  for (const [cid, ids] of journalMembers) {
    if (!seen.has(cid)) {
      findings.push(
        warn("journal-unknown-comment", `journal entry ${[...ids].join(", ")} references unknown comment "${cid}".`, {
          file: "journal.json",
          id: cid,
        }),
      );
    }
  }

  if (legacy > 0) {
    findings.push(
      warn("store-legacy-layout", `${legacy} comment(s) still in the v1 array layout — run \`notabene migrate\`.`),
    );
  }

  return findings;
}

/** Errors ⇒ exit 1; warnings alone ⇒ exit 0 (the store still works). */
export function verifyExitCode(findings) {
  return findings.some((f) => f.level === "error") ? 1 : 0;
}
