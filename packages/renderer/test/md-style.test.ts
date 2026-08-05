import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { blockRanges } from "../src/lib/md-splice";
import { applyTableStyle, inferMdStyle, type inferTableStyle } from "../src/lib/md-style";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const parse = unified().use(remarkParse).use(remarkGfm);

/**
 * Re-serialize one top-level block in isolation, exactly as the WYSIWYG editor does:
 * remark-gfm carries the table alignment, remark-stringify the prose conventions, and
 * `applyTableStyle` redraws the delimiter row remark-gfm cannot size. Mirror of
 * lib/client/wysiwyg.ts — if the two drift apart this suite stops measuring the product.
 */
const roundTrip = (body: string, start: number, end: number, opts: object) => {
  const { nbTable = null, ...stringifyOptions } = opts as { nbTable?: ReturnType<typeof inferTableStyle> };
  const node = parse.parse(body.slice(start, end)).children[0];
  const out = unified()
    .use(remarkGfm, nbTable ? { tablePipeAlign: nbTable.pipeAlign } : {})
    .use(remarkStringify, stringifyOptions)
    .stringify({ type: "root", children: [node] } as never)
    .replace(/\n+$/, "");
  return applyTableStyle(out, nbTable);
};

describe("inferMdStyle", () => {
  it("reads the dominant list marker", () => {
    expect(inferMdStyle("- a\n- b\n").bullet).toBe("-");
    expect(inferMdStyle("* a\n* b\n").bullet).toBe("*");
    expect(inferMdStyle("+ a\n+ b\n").bullet).toBe("+");
  });

  it("defaults rather than flipping a file on a tie", () => {
    expect(inferMdStyle("- a\n\n* b\n").bullet).toBe("-");
    expect(inferMdStyle("no lists here").bullet).toBe("-");
  });

  it("ignores markers that only occur inside code", () => {
    const src = "- real list\n\n```sh\n* not a list\n* nor this\n* nor this\n```\n";
    expect(inferMdStyle(src).bullet).toBe("-");
  });

  it("distinguishes emphasis from strong", () => {
    expect(inferMdStyle("__bold__ and __more__").strong).toBe("_");
    expect(inferMdStyle("**bold** and **more**").strong).toBe("*");
    expect(inferMdStyle("_em_ and _more_").emphasis).toBe("_");
    expect(inferMdStyle("*em* and *more*").emphasis).toBe("*");
  });

  it("reads the fence and thematic-break characters", () => {
    expect(inferMdStyle("~~~js\nx\n~~~\n").fence).toBe("~");
    expect(inferMdStyle("```js\nx\n```\n").fence).toBe("`");
    expect(inferMdStyle("text\n\n***\n\nmore").rule).toBe("*");
    expect(inferMdStyle("text\n\n---\n\nmore").rule).toBe("-");
  });

  it("preserves a 1./1./1. ordered list instead of renumbering it", () => {
    expect(inferMdStyle("1. a\n1. b\n1. c\n").incrementListMarker).toBe(false);
    expect(inferMdStyle("1. a\n2. b\n3. c\n").incrementListMarker).toBe(true);
  });
});

// The claim md-style exists to make good, measured over the real corpus.
describe("inferred style over the docs/ corpus", () => {
  const files = fs
    .readdirSync(path.join(REPO_ROOT, "docs"), { recursive: true })
    .filter((f): f is string => typeof f === "string" && f.endsWith(".md") && !f.includes(".notabene"))
    .map((f) => path.join("docs", f));

  const bodies = files.map((rel) => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
    const fm = /^﻿?(---\n[\s\S]*?\n---)/.exec(raw);
    return { rel, body: fm ? raw.slice(fm[1].length) : raw };
  });

  it("leaves every list block byte-identical, where the defaults rewrite most of them", () => {
    let defaultsRewrote = 0;
    let inferredRewrote = 0;
    let lists = 0;
    for (const { rel, body } of bodies) {
      const style = inferMdStyle(body);
      for (const b of blockRanges(body)) {
        if (b.type !== "list") continue;
        lists++;
        const original = body.slice(b.start, b.end);
        if (roundTrip(body, b.start, b.end, {}) !== original) defaultsRewrote++;
        if (roundTrip(body, b.start, b.end, style) !== original) {
          inferredRewrote++;
          console.error(`list rewritten despite inferred style: ${rel} @${b.start}`);
        }
      }
    }
    expect(lists).toBeGreaterThan(20);
    expect(defaultsRewrote).toBeGreaterThan(0); // the problem is real…
    expect(inferredRewrote).toBe(0); // …and this fixes it
  });

  it("leaves tables byte-identical — merely OPENING one used to rewrite it", () => {
    // Not a formatting nicety: every exit from the editor commits when the serialization
    // differs from the file, so a table that cannot round-trip gets rewritten in full by
    // someone who only looked at it. Before the delimiter-row fix: 15 of 16 rewritten.
    let rewrote = 0;
    let tables = 0;
    for (const { rel, body } of bodies) {
      const style = inferMdStyle(body);
      for (const b of blockRanges(body)) {
        if (b.type !== "table") continue;
        tables++;
        if (roundTrip(body, b.start, b.end, style) !== body.slice(b.start, b.end)) {
          rewrote++;
          console.error(`table rewritten despite inferred style: ${rel} @${b.start}`);
        }
      }
    }
    expect(tables).toBeGreaterThan(10);
    expect(rewrote).toBe(0);
  });

  it("keeps headings, code, blockquotes and html byte-identical too", () => {
    for (const { rel, body } of bodies) {
      const style = inferMdStyle(body);
      for (const b of blockRanges(body)) {
        if (!["heading", "code", "blockquote", "html"].includes(b.type)) continue;
        const original = body.slice(b.start, b.end);
        expect(roundTrip(body, b.start, b.end, style), `${rel} @${b.start} (${b.type})`).toBe(original);
      }
    }
  });

  it("is idempotent everywhere — a normalized block never drifts again", () => {
    for (const { rel, body } of bodies) {
      const style = inferMdStyle(body);
      for (const b of blockRanges(body)) {
        const once = roundTrip(body, b.start, b.end, style);
        const twice = roundTrip(once, 0, once.length, style);
        expect(twice, `${rel} @${b.start} (${b.type})`).toBe(once);
      }
    }
  });
});
