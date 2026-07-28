import { describe, expect, it } from "vitest";
import { applyDone, applyReopen, composeAuthor, statusForReview } from "../src/lib/comment-mutate.mjs";

const NOW = "2026-07-28T10:00:00.000Z";
const comment = {
  id: "c1",
  space: "docs",
  page: "docs/guide/x",
  scope: "selection",
  anchor: { quote: "q", prefix: "p", suffix: "s", section: "S" },
  thread: [{ author: "Alex <a@x.io>", body: "please clarify", ts: "2026-07-01T00:00:00.000Z" }],
  status: "open",
  hold: false,
  resolution: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("statusForReview", () => {
  it("maps the config's review mode to the status an agent may write", () => {
    expect(statusForReview("auto")).toBe("resolved");
    expect(statusForReview("approve")).toBe("addressed"); // a human validates at /review
    expect(statusForReview(undefined)).toBe("resolved"); // the documented default
  });
});

describe("applyDone", () => {
  it("sets the status, the resolution and the timestamp", () => {
    const out = applyDone(comment, { status: "addressed", note: "reworded", journalEntryId: "j1", now: NOW });
    expect(out.status).toBe("addressed");
    expect(out.resolution).toEqual({ note: "reworded", journalEntryId: "j1" });
    expect(out.updatedAt).toBe(NOW);
  });

  it("preserves every other field verbatim (hand-editing JSON is what loses them)", () => {
    const out = applyDone(comment, { status: "resolved", note: "x", journalEntryId: "j1", now: NOW });
    expect(out.thread).toEqual(comment.thread);
    expect(out.anchor).toEqual(comment.anchor);
    expect(out.createdAt).toBe(comment.createdAt);
    expect(out.hold).toBe(false);
    expect(out.space).toBe("docs");
    expect(comment.status).toBe("open"); // input untouched
  });

  it("omits journalEntryId when there is none, and defaults the note", () => {
    const out = applyDone(comment, { status: "resolved", now: NOW });
    expect(out.resolution).toEqual({ note: "" });
    expect("journalEntryId" in out.resolution).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(() => applyDone(comment, { status: "done", now: NOW })).toThrow(/unknown status/);
  });

  it('refuses "open" — that is reopen\'s job (and it would strip the resolution silently)', () => {
    expect(() => applyDone(comment, { status: "open", now: NOW })).toThrow(/reopen/);
  });
});

describe("applyReopen", () => {
  const addressed = { ...comment, status: "addressed", resolution: { note: "n", journalEntryId: "j1" } };

  it("reopens, drops the resolution and appends the reason as a thread reply", () => {
    const out = applyReopen(addressed, { reply: "not what I meant", author: "Sam <s@x.io>", now: NOW });
    expect(out.status).toBe("open");
    expect(out.resolution).toBeNull();
    expect(out.thread).toHaveLength(2);
    expect(out.thread[1]).toEqual({ author: "Sam <s@x.io>", body: "not what I meant", ts: NOW });
    expect(out.thread[0]).toEqual(comment.thread[0]);
    expect(addressed.thread).toHaveLength(1); // input untouched
  });

  it("reopens without a reply (no empty thread entry)", () => {
    const out = applyReopen(addressed, { now: NOW });
    expect(out.status).toBe("open");
    expect(out.thread).toHaveLength(1);
  });

  it("tolerates a malformed thread", () => {
    expect(applyReopen({ ...addressed, thread: undefined }, { reply: "r", now: NOW }).thread).toHaveLength(1);
  });
});

describe("composeAuthor", () => {
  it("builds the git-style identity the browser also writes", () => {
    expect(composeAuthor("Alex", "a@x.io")).toBe("Alex <a@x.io>");
    expect(composeAuthor("Alex", "")).toBe("Alex");
    expect(composeAuthor("  Alex  ", "  a@x.io ")).toBe("Alex <a@x.io>");
    expect(composeAuthor(null, "a@x.io")).toBe("you");
  });
});
