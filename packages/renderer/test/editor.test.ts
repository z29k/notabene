import { describe, expect, it } from "vitest";
import {
  anchorsBrokenBy,
  anchorRect,
  appendedBlock,
  approxRendered,
  toolbarButtons,
  cancelAction,
  filterSlash,
  scrollToItem,
  SLASH_ITEMS,
  TURN_INTO,
  slashQueryOf,
  displayName,
  draftKey,
  editorMessage,
  parseStamp,
} from "../src/lib/client/editor";
import { t } from "../src/i18n.mjs";
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

describe("appendedBlock", () => {
  it("writes the original then the new block under it", () => {
    expect(appendedBlock("First.", "Second.")).toBe("First.\n\nSecond.");
  });

  it("writes NOTHING new when the added block is empty — clicking + and changing your mind", () => {
    expect(appendedBlock("First.", "")).toBe("First.");
    expect(appendedBlock("First.", "   \n  ")).toBe("First.");
  });

  it("keeps the original byte-identical, whitespace and all", () => {
    expect(appendedBlock("- a\n- b", "x")).toBe("- a\n- b\n\nx");
  });
});

describe("cancelAction", () => {
  it("closes straight away when there is nothing to lose", () => {
    expect(cancelAction(false, false)).toBe("discard");
  });

  it("asks first when the block is dirty — this is the only path that destroys work", () => {
    expect(cancelAction(true, false)).toBe("arm");
  });

  it("discards on the second ask", () => {
    expect(cancelAction(true, true)).toBe("discard");
  });

  it("never asks twice on a clean block, however it got armed", () => {
    expect(cancelAction(false, true)).toBe("discard");
  });
});

describe("toolbarButtons", () => {
  const none = { inTable: false, inList: false };

  it("shows NOTHING at a bare caret — the caret-following bar sat on the text it edited", () => {
    expect(toolbarButtons(false, none)).toBeNull();
    expect(toolbarButtons(false, { inTable: true, inList: false })).toBeNull();
    expect(toolbarButtons(false, null)).toBeNull();
  });

  it("leads with Turn into on a plain selection, like Notion's bar", () => {
    const buttons = toolbarButtons(true, none);
    expect(buttons?.[0]).toBe("turnInto");
    expect(buttons).toContain("strong");
    expect(buttons).toContain("link");
    expect(buttons?.at(-1)).toBe("clearFormat");
  });

  it("adds list operations only inside a list", () => {
    expect(toolbarButtons(true, none)).not.toContain("indent");
    expect(toolbarButtons(true, { inTable: false, inList: true })).toContain("indent");
    expect(toolbarButtons(true, { inTable: false, inList: true })).toContain("outdent");
  });

  it("adds the header toggles inside a table, and drops Turn into there — the top-level block IS the table", () => {
    const inTable = toolbarButtons(true, { inTable: true, inList: false });
    expect(inTable).toContain("headerRow");
    expect(inTable).toContain("headerCol");
    expect(inTable).not.toContain("turnInto");
  });
});

describe("slashQueryOf", () => {
  it("derives the query from the text before the caret", () => {
    expect(slashQueryOf("/")).toBe("");
    expect(slashQueryOf("/tab")).toBe("tab");
    expect(slashQueryOf("Some prose /tab")).toBe("tab");
  });

  it("requires the slash to OPEN a word — `and/or` in prose must not summon a menu", () => {
    expect(slashQueryOf("and/or")).toBeNull();
    expect(slashQueryOf("https://example.com/path")).toBeNull();
  });

  it("closes on whitespace after the slash, and on a bare text", () => {
    expect(slashQueryOf("/two words")).toBeNull();
    expect(slashQueryOf("no slash here")).toBeNull();
    expect(slashQueryOf("")).toBeNull();
  });
});

describe("menu catalogs", () => {
  it("every slash item resolves its label, description and icon", () => {
    const en = t("en");
    for (const item of SLASH_ITEMS) {
      expect(en[item.key], item.key).toBeTruthy();
      expect(en[item.descKey], item.descKey).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(["blocks", "media"]).toContain(item.section);
    }
  });

  it("every turn-into entry resolves its label", () => {
    const en = t("en");
    for (const item of TURN_INTO) {
      expect(en[item.key], item.key).toBeTruthy();
    }
  });

  it("turn-into transforms and never inserts: no image, no divider, no table", () => {
    const kinds = TURN_INTO.map((i) => i.kind);
    expect(kinds).not.toContain("image");
    expect(kinds).not.toContain("divider");
    expect(kinds).not.toContain("table");
  });
});

describe("filterSlash", () => {
  const label = (k: string) => ({ blockH1: "Heading 1", blockQuote: "Quote", blockImage: "Image…" })[k] ?? k;
  const items = SLASH_ITEMS.filter((i) => ["blockH1", "blockQuote", "blockImage"].includes(i.key));

  it("shows everything until something is typed", () => {
    expect(filterSlash(items, "", label)).toHaveLength(3);
  });

  it("matches the visible label", () => {
    expect(filterSlash(items, "quo", label).map((i) => i.cmd)).toEqual(["quote"]);
  });

  it("matches the hints too, so the English name finds a translated label", () => {
    expect(filterSlash(items, "citation", label).map((i) => i.cmd)).toEqual(["quote"]);
    expect(filterSlash(items, "h1", label).map((i) => i.cmd)).toEqual(["heading1"]);
  });

  it("ignores case and accents — /separateur must find Séparateur", () => {
    const sep = SLASH_ITEMS.filter((i) => i.cmd === "divider");
    expect(filterSlash(sep, "SÉPARA", (k) => (k === "blockDivider" ? "Séparateur" : k))).toHaveLength(1);
  });

  it("returns nothing for a query that matches none — the menu closes on that", () => {
    expect(filterSlash(items, "zzz", label)).toEqual([]);
  });
});

describe("anchorRect", () => {
  const rect = (width: number, height: number) => ({ top: 0, bottom: height, left: 0, right: width, width, height });

  it("uses the caret when it has been laid out", () => {
    expect(anchorRect(rect(2, 18), rect(200, 40))).toEqual(rect(2, 18));
  });

  it("falls back to the container for a 0×0 caret — an empty table cell has no text node", () => {
    expect(anchorRect(rect(0, 0), rect(200, 40))).toEqual(rect(200, 40));
  });

  it("accepts a caret with height but no width, which is the normal collapsed case", () => {
    expect(anchorRect(rect(0, 18), rect(200, 40))).toEqual(rect(0, 18));
  });

  it("gives up when neither has extent, rather than anchoring at the origin", () => {
    expect(anchorRect(rect(0, 0), rect(0, 0))).toBeNull();
    expect(anchorRect(null, null)).toBeNull();
  });
});

describe("scrollToItem", () => {
  // A 100px-tall list of 20px rows.
  it("leaves the offset alone when the item is already visible", () => {
    expect(scrollToItem(0, 100, 40, 20)).toBe(0);
    expect(scrollToItem(60, 100, 100, 20)).toBe(60);
  });

  it("scrolls up to reveal an item above the fold", () => {
    expect(scrollToItem(60, 100, 20, 20)).toBe(20);
  });

  it("scrolls down just far enough to reveal one below it", () => {
    // The item ends at 140; the viewport is 100 tall, so the top must be 40 — not 120,
    // which would jump the whole list to put one row at the top.
    expect(scrollToItem(0, 100, 120, 20)).toBe(40);
  });

  it("handles an item taller than the viewport by showing its top", () => {
    expect(scrollToItem(50, 100, 40, 200)).toBe(40);
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

  it("names the untracked file IN the catalog sentence, so the remedy stays localized", () => {
    const cat = { ...m, editErrorUntracked: "git ne suit pas {file}." };
    expect(editorMessage(403, { error: "untracked", file: "docs/new.md", detail: "run git add" }, cat)).toBe(
      "git ne suit pas docs/new.md.",
    );
  });

  it("falls back to the server's detail when no path came with the refusal", () => {
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
