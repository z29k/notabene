import { describe, expect, it } from "vitest";
import { changesForComment } from "../src/lib/client/review-card";

// Minimal Comment shape (only the fields changesForComment reads).
const comment = (id: string, journalEntryId?: string) =>
  ({ id, resolution: journalEntryId ? { note: "", journalEntryId } : null }) as never;

const journal = [
  {
    id: "j1",
    date: "2026-07-02",
    title: "",
    summary: "",
    changes: [
      { page: "docs/a", commentIds: ["c1"], what: "edit a", why: "w" },
      { page: "docs/b", commentIds: ["c1", "c2"], what: "edit b", why: "w" }, // shared + cascade
      { page: "docs/c", commentIds: ["c3"], what: "edit c", why: "w" },
    ],
  },
];

describe("changesForComment", () => {
  it("returns the union of pages the comment touched (cascade)", () => {
    const r = changesForComment(comment("c1", "j1"), journal);
    expect(r.map((x) => x.page)).toEqual(["docs/a", "docs/b"]);
  });
  it("exposes the other comments sharing a change (many-to-many)", () => {
    const r = changesForComment(comment("c1", "j1"), journal);
    const shared = r.find((x) => x.page === "docs/b");
    expect(shared?.otherCommentIds).toEqual(["c2"]);
  });
  it("returns [] when the comment has no journal entry", () => {
    expect(changesForComment(comment("c1"), journal)).toEqual([]);
    expect(changesForComment(comment("c1", "missing"), journal)).toEqual([]);
  });
  it("returns only changes referencing the comment", () => {
    const r = changesForComment(comment("c3", "j1"), journal);
    expect(r.map((x) => x.page)).toEqual(["docs/c"]);
  });
});
