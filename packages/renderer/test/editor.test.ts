import { describe, expect, it } from "vitest";
import {
  anchorsBrokenBy,
  approxRendered,
  displayName,
  draftKey,
  editorMessage,
  parseStamp,
} from "../src/lib/client/editor";
import { appendEntry, newEntryId, normalizeEntry, readEntries } from "../src/lib/journal-write.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("parseStamp", () => {
  it("parses a well-formed range", () => {
    expect(parseStamp("12:40", "paragraph")).toEqual({ start: 12, end: 40, kind: "paragraph" });
  });

  it("rejects anything malformed rather than guessing", () => {
    for (const bad of [null, undefined, "", "12", "a:b", "12:", "-1:4", "40:12"]) {
      expect(parseStamp(bad as string | null)).toBeNull();
    }
  });
});

describe("draftKey", () => {
  it("is unique per page and per range", () => {
    const a = draftKey("docs/x", { start: 1, end: 2, kind: "" });
    expect(a).not.toBe(draftKey("docs/y", { start: 1, end: 2, kind: "" }));
    expect(a).not.toBe(draftKey("docs/x", { start: 1, end: 3, kind: "" }));
  });
});

describe("editorMessage", () => {
  const m = {
    editErrorGeneric: "Could not save.",
    editErrorMoved: "Moved.",
    editErrorContainment: "Refused.",
    editErrorUntracked: "Untracked.",
    editErrorStale: "Stale.",
  };

  it("maps each server refusal to its sentence", () => {
    expect(editorMessage(409, { error: "moved" }, m)).toBe("Moved.");
    expect(editorMessage(409, { error: "stale" }, m)).toBe("Stale.");
    expect(editorMessage(422, { error: "containment" }, m)).toBe("Refused.");
  });

  it("appends the server's detail, which carries the actual explanation", () => {
    expect(editorMessage(422, { error: "containment", detail: "would merge lists" }, m)).toBe(
      "Refused. would merge lists",
    );
  });

  it("prefers the untracked remedy verbatim — the sentence alone is not actionable", () => {
    expect(editorMessage(403, { error: "untracked", detail: "run git add x.md" }, m)).toBe("run git add x.md");
  });

  it("falls back with the status for an unexpected failure", () => {
    expect(editorMessage(500, {}, m)).toBe("Could not save. (HTTP 500)");
  });
});

describe("approxRendered", () => {
  it("approximates what the DOM shows, which is what anchors quote", () => {
    expect(approxRendered("A `code` and a [link](./x.md).")).toBe("A code and a link.");
    expect(approxRendered("**bold** and _em_")).toBe("bold and em");
    expect(approxRendered("# Heading")).toBe("Heading");
    expect(approxRendered("> quoted")).toBe("quoted");
  });
});

describe("anchorsBrokenBy", () => {
  const original = "The quick brown fox jumps over the lazy dog.";

  it("flags a quote the edit removed", () => {
    expect(anchorsBrokenBy([{ id: "c1", quote: "quick brown fox" }], original, "The dog sleeps.")).toEqual(["c1"]);
  });

  it("stays quiet when the quote survives", () => {
    expect(anchorsBrokenBy([{ id: "c1", quote: "quick brown fox" }], original, "The quick brown fox naps.")).toEqual(
      [],
    );
  });

  it("stays quiet when the quote was never locatable — no crying wolf", () => {
    expect(anchorsBrokenBy([{ id: "c1", quote: "not in this block at all" }], original, "anything")).toEqual([]);
  });

  it("sees through inline markup, since anchors quote rendered text", () => {
    expect(anchorsBrokenBy([{ id: "c1", quote: "inline code" }], "A `inline code` here.", "A here.")).toEqual(["c1"]);
  });
});

describe("displayName", () => {
  it("drops the email of a git-style author", () => {
    expect(displayName("Alex Doe <alex@example.com>")).toBe("Alex Doe");
    expect(displayName("Alex Doe")).toBe("Alex Doe");
  });
});

describe("journal-write", () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "nb-journal-"));

  it("mints a date-prefixed id", () => {
    expect(newEntryId("2026-08-03T10:00:00.000Z", 0.5)).toMatch(/^j-2026-08-03-[a-z0-9]+$/);
  });

  it("normalizes a partial entry and preserves unknown fields", () => {
    const e = normalizeEntry({ title: "T", extra: 1 }, { id: "j-1", date: "2026-08-03" });
    expect(e).toMatchObject({ id: "j-1", date: "2026-08-03", title: "T", summary: "", changes: [], extra: 1 });
  });

  it("normalizes changes into the store's shape", () => {
    const e = normalizeEntry(
      { title: "T", changes: [{ page: "docs/x", commentIds: ["c1"], what: "w", why: "y", ref: "abc" }] },
      { id: "j-1", date: "2026-08-03" },
    );
    expect(e.changes).toEqual([{ page: "docs/x", commentIds: ["c1"], what: "w", why: "y", ref: "abc" }]);
  });

  it("appends to a missing, empty or corrupt journal alike", () => {
    for (const seed of [null, "", "[]", "{}", "not json"]) {
      const dir = tmp();
      if (seed !== null) fs.writeFileSync(path.join(dir, "journal.json"), seed);
      appendEntry(dir, normalizeEntry({ title: "T" }, { id: "j-1", date: "2026-08-03" }));
      expect(readEntries(dir).map((e) => e.id)).toEqual(["j-1"]);
    }
  });

  it("keeps existing entries and appends in order", () => {
    const dir = tmp();
    appendEntry(dir, normalizeEntry({ title: "one" }, { id: "j-1", date: "2026-08-03" }));
    appendEntry(dir, normalizeEntry({ title: "two" }, { id: "j-2", date: "2026-08-03" }));
    expect(readEntries(dir).map((e) => e.id)).toEqual(["j-1", "j-2"]);
  });

  it("writes valid JSON with a trailing newline, like every other store file", () => {
    const dir = tmp();
    appendEntry(dir, normalizeEntry({ title: "T" }, { id: "j-1", date: "2026-08-03" }));
    const raw = fs.readFileSync(path.join(dir, "journal.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
