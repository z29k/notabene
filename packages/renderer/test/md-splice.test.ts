import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { blockRanges, detectEol, locateRange, normalizeEol, spliceBlock } from "../src/lib/md-splice";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const BODY = `Intro paragraph.

Second paragraph here.

- existing one
- existing two

Trailing paragraph.
`;

/** The range of the nth top-level block of `body`. */
const nth = (body: string, n: number) => {
  const b = blockRanges(body)[n];
  return { start: b.start, end: b.end, original: body.slice(b.start, b.end) };
};

describe("blockRanges", () => {
  it("returns every top-level block with exact offsets", () => {
    const blocks = blockRanges(BODY);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph", "list", "paragraph"]);
    expect(BODY.slice(blocks[1].start, blocks[1].end)).toBe("Second paragraph here.");
    expect(BODY.slice(blocks[2].start, blocks[2].end)).toBe("- existing one\n- existing two");
  });

  it("keeps html blocks (they are blocks, they are just never stamped)", () => {
    const blocks = blockRanges('para\n\n<div class="x">raw</div>\n\nafter\n');
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "html", "paragraph"]);
  });
});

describe("detectEol / normalizeEol", () => {
  it("detects the dominant line ending", () => {
    expect(detectEol("a\nb\nc")).toBe("\n");
    expect(detectEol("a\r\nb\r\nc")).toBe("\r\n");
    expect(detectEol("no newline at all")).toBe("\n");
  });

  it("rewrites line endings without doubling \\r", () => {
    expect(normalizeEol("a\r\nb", "\n")).toBe("a\nb");
    expect(normalizeEol("a\nb", "\r\n")).toBe("a\r\nb");
    expect(normalizeEol("a\r\nb", "\r\n")).toBe("a\r\nb");
  });
});

describe("locateRange", () => {
  it("accepts the stamped range when nothing moved", () => {
    const { start, end, original } = nth(BODY, 1);
    const at = locateRange(BODY, blockRanges(BODY), start, end, original);
    expect(at).toMatchObject({ start, end, first: 1, last: 1 });
  });

  it("re-anchors when the offsets have gone stale", () => {
    const { original } = nth(BODY, 1);
    const shifted = `A new heading was inserted above.\n\n${BODY}`;
    const at = locateRange(shifted, blockRanges(shifted), 18, 40, original);
    expect(at).not.toBeNull();
    expect(shifted.slice(at?.start, at?.end)).toBe(original);
  });

  it("refuses an ambiguous re-anchor rather than guessing", () => {
    const twice = "Same text.\n\nfiller\n\nSame text.\n";
    expect(locateRange(twice, blockRanges(twice), 999, 1000, "Same text.")).toBeNull();
  });

  it("never matches inside a code fence — candidates are whole blocks only", () => {
    // "Second paragraph here." also appears verbatim inside a fenced block. A plain
    // string search would find it there; block-bounded candidates cannot.
    const body = "```\nSecond paragraph here.\n```\n\nSecond paragraph here.\n";
    const at = locateRange(body, blockRanges(body), 999, 1000, "Second paragraph here.");
    expect(at).not.toBeNull();
    expect(blockRanges(body)[at?.first ?? -1].type).toBe("paragraph");
  });
});

describe("spliceBlock — benign edits", () => {
  it("rewords a paragraph and touches nothing else", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "Second paragraph, reworded." });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next).toBe(BODY.replace("Second paragraph here.", "Second paragraph, reworded."));
    // One changed line, exactly.
    const before = BODY.split("\n");
    const changed = res.next.split("\n").filter((l, i) => l !== before[i]);
    expect(changed).toHaveLength(1);
  });

  it("accepts a replacement ending with --- (the blank line defeats setext)", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "Second paragraph here.\n\n---" });
    expect(res.ok).toBe(true);
  });

  it("lets one block become several", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "First half.\n\nSecond half." });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(blockRanges(res.next).map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
      "list",
      "paragraph",
    ]);
  });

  it("trims trailing whitespace but preserves a leading indent (indented code block)", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "    indented code\n\n  " });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next).toContain("    indented code\n\n- existing one");
    expect(blockRanges(res.next)[1].type).toBe("code");
  });

  it("reports the range the written block now occupies", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "Short." });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next.slice(res.start, res.end)).toBe("Short.");
  });
});

describe("spliceBlock — the containment invariant", () => {
  it("refuses a list that would merge with the neighbouring list", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "- turned into\n- a list" });
    expect(res).toMatchObject({ ok: false, error: "containment" });
  });

  it("refuses an unterminated fence that would swallow the rest of the file", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "```js\nconst x = 1;" });
    expect(res).toMatchObject({ ok: false, error: "containment" });
  });

  it("refuses a replacement that would be swallowed BY the previous block", () => {
    // An ATX heading interrupts a paragraph, so these two blocks are adjacent with no
    // blank line between them. Turn the heading into plain text and it becomes a lazy
    // continuation of the paragraph above — two blocks collapse into one.
    const body = "text\n# Heading\n\nEnd.\n";
    expect(blockRanges(body).map((b) => b.type)).toEqual(["paragraph", "heading", "paragraph"]);
    const { start, end, original } = nth(body, 1);
    const res = spliceBlock({ body, start, end, original, markdown: "now plain text" });
    expect(res).toMatchObject({ ok: false, error: "containment" });
  });

  it("answers `moved` when the original is nowhere to be found", () => {
    const res = spliceBlock({ body: BODY, start: 0, end: 5, original: "not in this file", markdown: "x" });
    expect(res).toMatchObject({ ok: false, error: "moved" });
  });
});

describe("spliceBlock — multi-block ranges", () => {
  // The server contract the editor's "include the next block" affordance relies on:
  // a range may cover 1..n CONTIGUOUS top-level blocks, so a merge the containment
  // invariant refuses on one block becomes legal once the range owns both.
  it("accepts a range spanning two blocks and replaces them as one", () => {
    const blocks = blockRanges(BODY);
    const start = blocks[1].start;
    const end = blocks[2].end;
    const original = BODY.slice(start, end);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "- merged one\n- merged two" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(blockRanges(res.next).map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
    expect(res.next).toBe("Intro paragraph.\n\n- merged one\n- merged two\n\nTrailing paragraph.\n");
  });

  it("makes the refused paragraph-into-list edit legal once the range includes the list", () => {
    const blocks = blockRanges(BODY);
    // Refused on the paragraph alone (it would merge with the neighbouring list)…
    const alone = spliceBlock({
      body: BODY,
      start: blocks[1].start,
      end: blocks[1].end,
      original: BODY.slice(blocks[1].start, blocks[1].end),
      markdown: "- turned into\n- a list",
    });
    expect(alone).toMatchObject({ ok: false, error: "containment" });
    // …and accepted once the range owns the list too.
    const together = spliceBlock({
      body: BODY,
      start: blocks[1].start,
      end: blocks[2].end,
      original: BODY.slice(blocks[1].start, blocks[2].end),
      markdown: "- turned into\n- a list\n- existing one\n- existing two",
    });
    expect(together.ok).toBe(true);
  });

  it("re-anchors a multi-block range too", () => {
    const blocks = blockRanges(BODY);
    const original = BODY.slice(blocks[1].start, blocks[2].end);
    const shifted = `Inserted above.\n\n${BODY}`;
    const at = locateRange(shifted, blockRanges(shifted), -1, -1, original);
    expect(at).not.toBeNull();
    expect(shifted.slice(at?.start, at?.end)).toBe(original);
    expect(at?.last).toBe((at?.first ?? 0) + 1);
  });
});

describe("spliceBlock — deletion", () => {
  it("removes the block and its separator", () => {
    const { start, end, original } = nth(BODY, 1);
    const res = spliceBlock({ body: BODY, start, end, original, markdown: "   \n  " });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next).toBe("Intro paragraph.\n\n- existing one\n- existing two\n\nTrailing paragraph.\n");
  });

  it("takes the preceding separator when deleting the last block", () => {
    const body = "Intro.\n\nLast paragraph.\n";
    const { start, end, original } = nth(body, 1);
    const res = spliceBlock({ body, start, end, original, markdown: "" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next).toBe("Intro.\n");
  });
});

describe("spliceBlock — CRLF", () => {
  it("keeps a CRLF file consistently CRLF", () => {
    const body = BODY.replace(/\n/g, "\r\n");
    const { start, end, original } = nth(body, 1);
    const res = spliceBlock({ body, start, end, original, markdown: "Line one.\nLine two." });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.next).toContain("Line one.\r\nLine two.");
    expect(res.next.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("matches an original the browser normalized to LF", () => {
    const body = BODY.replace(/\n/g, "\r\n");
    const { start, end, original } = nth(body, 2);
    const at = locateRange(body, blockRanges(body), start, end, original.replace(/\r\n/g, "\n"));
    expect(at).toMatchObject({ start, end });
  });
});

// The corpus test: every real docs page, every block. This is the probe from §11 of
// plans/editeur-wysiwyg.md turned into a regression test.
describe("spliceBlock — over the whole docs/ corpus", () => {
  const files = fs
    .readdirSync(path.join(REPO_ROOT, "docs"), { recursive: true })
    .filter((f): f is string => typeof f === "string" && f.endsWith(".md") && !f.includes(".notabene"))
    .map((f) => path.join("docs", f));

  it("finds pages to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  // Exhaustive by design (§11): ~600 blocks, two full re-parses each. Seconds, not ms.
  it("replacing any block by itself is a byte-identical no-op", { timeout: 60_000 }, () => {
    for (const rel of files) {
      const raw = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
      const fm = /^﻿?(---\n[\s\S]*?\n---)/.exec(raw);
      const body = fm ? raw.slice(fm[1].length) : raw;
      for (const b of blockRanges(body)) {
        const original = body.slice(b.start, b.end);
        const res = spliceBlock({ body, start: b.start, end: b.end, original, markdown: original });
        expect(res.ok, `${rel} @${b.start} (${b.type})`).toBe(true);
        if (res.ok) expect(res.next, `${rel} @${b.start}`).toBe(body);
      }
    }
  });

  it("every block re-anchors to itself unambiguously or is refused, never mislocated", { timeout: 60_000 }, () => {
    for (const rel of files) {
      const raw = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
      const fm = /^﻿?(---\n[\s\S]*?\n---)/.exec(raw);
      const body = fm ? raw.slice(fm[1].length) : raw;
      const blocks = blockRanges(body);
      for (const b of blocks) {
        const original = body.slice(b.start, b.end);
        // Deliberately bogus offsets → forces the re-anchor path.
        const at = locateRange(body, blocks, -1, -1, original);
        if (at) expect(body.slice(at.start, at.end), `${rel} @${b.start}`).toBe(original);
      }
    }
  });
});
