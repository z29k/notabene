import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../src/lib/comment-types";
import { verifyExitCode, verifyStore } from "../src/lib/store-verify.mjs";

const comment = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  space: "docs",
  page: "docs/guide/x",
  scope: "selection",
  anchor: null,
  thread: [{ author: "you", body: "b", ts: "2026-01-01T00:00:00Z" }],
  status: "open",
  hold: false,
  resolution: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

const entry = (file: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  file,
  data,
  legacy: false,
  ...extra,
});

const run = (input: Record<string, unknown>) =>
  verifyStore({
    entries: [],
    journal: [],
    meta: { schemaVersion: SCHEMA_VERSION },
    schemaVersion: SCHEMA_VERSION,
    ...input,
  });

const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

describe("verifyStore — a coherent store", () => {
  it("reports nothing when comment ⇄ journal link both ways", () => {
    const findings = run({
      entries: [
        entry("docs/guide/x/c1.json", comment({ status: "resolved", resolution: { note: "n", journalEntryId: "j1" } })),
      ],
      journal: [
        {
          id: "j1",
          date: "2026-01-02",
          title: "t",
          summary: "s",
          changes: [{ page: "docs/guide/x", commentIds: ["c1"], what: "w", why: "y" }],
        },
      ],
    });
    expect(findings).toEqual([]);
    expect(verifyExitCode(findings)).toBe(0);
  });

  it("accepts an open comment with no resolution and an empty journal", () => {
    expect(run({ entries: [entry("docs/guide/x/c1.json", comment())], journal: [] })).toEqual([]);
  });
});

describe("verifyStore — the reciprocity rule (/review inverts the journal)", () => {
  const linked = comment({ status: "addressed", resolution: { note: "n", journalEntryId: "j1" } });

  it("flags a comment the journal entry doesn't list back — the empty-diff bug", () => {
    const findings = run({
      entries: [entry("docs/guide/x/c1.json", linked)],
      journal: [
        {
          id: "j1",
          date: "2026-01-02",
          title: "t",
          summary: "s",
          changes: [{ page: "docs/guide/x", commentIds: [], what: "w", why: "y" }],
        },
      ],
    });
    expect(codes(findings)).toEqual(["comment-not-in-journal-changes"]);
    expect(verifyExitCode(findings)).toBe(1);
  });

  it("flags a resolution pointing at an entry that doesn't exist", () => {
    const findings = run({ entries: [entry("docs/guide/x/c1.json", linked)], journal: [] });
    expect(codes(findings)).toEqual(["comment-unknown-journal-entry"]);
  });

  it("accepts a cascade: one comment, one entry, several pages", () => {
    const findings = run({
      entries: [entry("docs/guide/x/c1.json", linked)],
      journal: [
        {
          id: "j1",
          date: "2026-01-02",
          title: "t",
          summary: "s",
          changes: [
            { page: "docs/guide/x", commentIds: ["c1"], what: "w", why: "y" },
            { page: "docs/guide/other", commentIds: ["c1"], what: "w", why: "y" },
          ],
        },
      ],
    });
    expect(findings).toEqual([]);
  });

  it("flags a handled comment with no journal link at all", () => {
    const findings = run({
      entries: [
        entry("docs/guide/x/c1.json", comment({ status: "resolved", resolution: { note: "n" } })),
        entry("docs/guide/x/c2.json", comment({ id: "c2", status: "addressed", resolution: null })),
      ],
    });
    expect(codes(findings)).toEqual(["comment-no-journal-link", "comment-no-resolution"]);
  });
});

describe("verifyStore — comment shape and layout", () => {
  it("flags a missing required field, a bad status and a bad hold", () => {
    const findings = run({
      entries: [entry("docs/guide/x/c1.json", comment({ page: "", status: "done", hold: "yes" }))],
    });
    expect(codes(findings)).toContain("comment-missing-field");
    expect(codes(findings)).toContain("comment-bad-status");
    expect(codes(findings)).toContain("comment-bad-hold");
  });

  it("flags an empty thread (the original comment is the thread's first entry)", () => {
    expect(codes(run({ entries: [entry("docs/guide/x/c1.json", comment({ thread: [] }))] }))).toEqual([
      "comment-empty-thread",
    ]);
  });

  it("flags a filename or directory that contradicts the comment (v2 layout)", () => {
    const findings = run({ entries: [entry("docs/other/zzz.json", comment())] });
    expect(codes(findings)).toEqual(["comment-file-id-mismatch", "comment-page-dir-mismatch"]);
  });

  it("does not apply the layout rules to legacy v1 array members, but asks for a migration", () => {
    const findings = run({ entries: [entry("docs/guide/x.json", comment(), { legacy: true })] });
    expect(codes(findings)).toEqual(["store-legacy-layout"]);
  });

  it("flags duplicate ids across files", () => {
    const findings = run({
      entries: [
        entry("docs/guide/x/c1.json", comment()),
        entry("docs/guide/y/c1.json", comment({ page: "docs/guide/y" })),
      ],
    });
    expect(codes(findings)).toEqual(["comment-duplicate-id"]);
  });

  it("reports an unreadable file instead of skipping it silently", () => {
    const findings = verifyStore({
      entries: [{ file: "docs/guide/x/c1.json", data: null, error: "Unexpected token }" }],
      journal: [],
      meta: { schemaVersion: SCHEMA_VERSION },
      schemaVersion: SCHEMA_VERSION,
    });
    expect(codes(findings)).toEqual(["comment-unreadable"]);
  });

  it("warns about a stale resolution left on a reopened comment", () => {
    const findings = run({
      entries: [entry("docs/guide/x/c1.json", comment({ resolution: { note: "n", journalEntryId: "j1" } }))],
    });
    expect(findings).toEqual([expect.objectContaining({ level: "warning", code: "comment-open-with-resolution" })]);
    expect(verifyExitCode(findings)).toBe(0); // warnings alone don't fail
  });

  it("warns when a comment's page has no source file left", () => {
    const findings = run({
      entries: [entry("docs/guide/x/c1.json", comment())],
      pageExists: () => false,
    });
    expect(codes(findings)).toEqual(["comment-page-missing"]);
  });
});

describe("verifyStore — journal and store metadata", () => {
  it("flags a journal that isn't an array", () => {
    expect(codes(run({ journal: { unreadable: true } }))).toEqual(["journal-invalid"]);
  });

  it("flags an entry with no changes[] — nothing would show at /review", () => {
    const findings = run({ journal: [{ id: "j1", date: "2026-01-02", title: "t", summary: "s", changes: [] }] });
    expect(codes(findings)).toEqual(["journal-no-changes"]);
  });

  it("flags duplicate entry ids and warns on a malformed date", () => {
    const ok = { title: "t", summary: "s", changes: [{ page: "p", commentIds: [], what: "w", why: "y" }] };
    const findings = run({
      journal: [
        { id: "j1", date: "2026-01-02", ...ok },
        { id: "j1", date: "02/01/2026", ...ok },
      ],
    });
    expect(codes(findings)).toEqual(["journal-duplicate-id", "journal-bad-date"]);
  });

  it("warns about a journal reference to a comment that no longer exists", () => {
    const findings = run({
      journal: [
        {
          id: "j1",
          date: "2026-01-02",
          title: "t",
          summary: "s",
          changes: [{ page: "p", commentIds: ["gone"], what: "w", why: "y" }],
        },
      ],
    });
    expect(codes(findings)).toEqual(["journal-unknown-comment"]);
  });

  it("refuses a store written by a NEWER renderer, and warns when meta is absent", () => {
    expect(codes(run({ meta: { schemaVersion: SCHEMA_VERSION + 1 } }))).toEqual(["store-schema-newer"]);
    expect(verifyExitCode(run({ meta: { schemaVersion: SCHEMA_VERSION + 1 } }))).toBe(1);
    expect(codes(run({ meta: null }))).toEqual(["store-meta-missing"]);
    expect(verifyExitCode(run({ meta: null }))).toBe(0);
  });

  it("accepts an older store (readers stay backward-compatible)", () => {
    expect(run({ meta: { schemaVersion: 1 } })).toEqual([]);
  });
});
