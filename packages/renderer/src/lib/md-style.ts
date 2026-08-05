// Infer a file's own Markdown conventions, so the WYSIWYG editor re-serializes an edited
// block the way the REST of that file is written.
//
// This is what turns the round-trip from "acceptable" into "invisible". Measured over the
// 42 pages of docs/ (576 top-level blocks), re-serializing a block with remark-stringify's
// DEFAULTS rewrites 31.2% of block lines; with the options inferred here, 9.0%. The whole
// difference is one character: `-` vs `*` as the list marker — 87% of list blocks rewritten
// becomes 0%. Tables are the residual, and they are idempotent (paid once, never twice).
//
// Pure: a string in, remark-stringify options out. No fs, no config, no Astro.
import { stripCode } from "./lint-links.mjs";

/**
 * How a file writes the delimiter row of a table. remark-gfm can be told whether to pad the
 * pipes, but NOT how wide to draw the dashes: un-aligned it always emits the minimum `-`,
 * where nearly every hand-written table uses `---`. That one line was the entire remaining
 * difference — measured over docs/, 15 of 16 tables came back rewritten, and every single
 * one of them differed ONLY in that row.
 */
export interface TableStyle {
  /** Pad every cell out to the column width (remark-gfm's `tablePipeAlign`). */
  pipeAlign: boolean;
  /** Dash run in the delimiter row: `---` is 3. */
  dashes: number;
  /** Spaces around the dashes: `| --- |` vs `|---|`. */
  pad: boolean;
}

export interface MdStyle {
  /** NOT a remark-stringify option — see applyTableStyle. Absent when the file has no table. */
  nbTable?: TableStyle | null;
  bullet: "-" | "*" | "+";
  bulletOrdered: "." | ")";
  emphasis: "*" | "_";
  strong: "*" | "_";
  fence: "`" | "~";
  rule: "-" | "*" | "_";
  listItemIndent: "one" | "tab" | "mixed";
  incrementListMarker: boolean;
  fences: true;
  resourceLink: false;
  tightDefinitions: true;
}

/** Most frequent key, or `fallback` on a tie/absence — a tie must not flip a whole file. */
function dominant<T extends string>(counts: Map<T, number>, fallback: T): T {
  let best = fallback;
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      best = key;
      bestN = n;
    }
  }
  return bestN > 0 ? best : fallback;
}

const tally = <T extends string>(source: string, re: RegExp, pick: (m: RegExpExecArray) => T): Map<T, number> => {
  const counts = new Map<T, number>();
  for (const m of source.matchAll(re)) {
    const key = pick(m as RegExpExecArray);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

/**
 * Read a file's conventions off its own source. Code is blanked first (`stripCode` keeps
 * offsets and line count), so a shell snippet full of `*` never votes on prose style.
 */
export function inferMdStyle(source: string): MdStyle {
  const text = stripCode(String(source ?? ""));

  const bullet = dominant(
    tally(text, /^[ \t]*([-*+])[ \t]+\S/gm, (m) => m[1] as "-" | "*" | "+"),
    "-",
  );
  const bulletOrdered = dominant(
    tally(text, /^[ \t]*\d+([.)])[ \t]+\S/gm, (m) => m[1] as "." | ")"),
    ".",
  );
  const strong = dominant(
    tally(text, /(\*\*|__)(?=\S)[\s\S]*?\S\1/g, (m) => (m[1] === "**" ? "*" : "_") as "*" | "_"),
    "*",
  );
  // Single-marker emphasis only: skip the `**`/`__` runs already counted above.
  const emphasis = dominant(
    tally(text, /(?<![*_])([*_])(?![*_])(?=\S)[^\n*_]*?\S\1(?![*_])/g, (m) => m[1] as "*" | "_"),
    "*",
  );
  const fence = dominant(
    tally(String(source ?? ""), /^[ \t]*(`{3,}|~{3,})/gm, (m) => (m[1][0] === "`" ? "`" : "~") as "`" | "~"),
    "`",
  );
  const rule = dominant(
    tally(text, /^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, (m) => m[1] as "-" | "*" | "_"),
    "-",
  );

  // `listItemIndent: "one"` = marker + a single space ("- item"); "tab" pads continuation
  // lines to a tab stop. Look at what continuation lines actually do.
  const oneSpace = (text.match(/^[ \t]*[-*+] \S/gm) ?? []).length;
  const wideIndent = (text.match(/^[ \t]*[-*+] {3,}\S/gm) ?? []).length;

  // Ordered lists written 1./1./1. must not be renumbered into 1./2./3.
  const flatOrdered = /^[ \t]*1[.)][ \t]+\S[\s\S]*?^[ \t]*1[.)][ \t]+\S/m.test(text);

  return {
    nbTable: inferTableStyle(String(source ?? "")),
    bullet,
    bulletOrdered,
    emphasis,
    strong,
    fence,
    rule,
    listItemIndent: wideIndent > oneSpace ? "tab" : "one",
    incrementListMarker: !flatOrdered,
    // Always fenced (never indented) code, never a reference-style link, tight
    // definitions: these are not "style" so much as the only sane round trip.
    fences: true,
    resourceLink: false,
    tightDefinitions: true,
  };
}

/** A table's delimiter row: `| --- | :--: |`. Never matches inside a fence — see stripCode. */
const DELIMITER_ROW = /^\|[ :\-|]+\|$/;

/**
 * Read the file's table convention off its delimiter rows. `null` when the file has no
 * table at all, so a file that never had one is never given an opinion about them.
 */
export function inferTableStyle(source: string): TableStyle | null {
  const stripped: string = stripCode(String(source ?? ""));
  const rows: string[][] = (stripped.match(new RegExp(DELIMITER_ROW.source, "gm")) ?? []).map((r: string) =>
    r.split("|").slice(1, -1),
  );
  if (!rows.length) return null;

  const cells: string[] = rows.flat();
  // "Aligned" means the dashes were stretched to the column width, which only a formatter
  // does; a hand-written table keeps them short. 3 is the longest anyone types by hand.
  const runs: number[] = cells.map((c) => c.trim().replace(/^:|:$/g, "").length);
  const short = runs.filter((n) => n <= 3).length;
  const dashCounts = tally(runs.filter((n) => n <= 3).join(",") || "3", /(\d+)/g, (m) => m[1]);
  const padded = cells.filter((c) => /^ .* $/.test(c)).length;

  return {
    pipeAlign: short * 2 < runs.length,
    dashes: Number(dominant(dashCounts, "3")) || 3,
    pad: padded * 2 >= cells.length,
  };
}

/**
 * Redraw a serialized TABLE block's delimiter row in the file's own convention. Applied to
 * the editor's output, never to the file: the block being serialized is a single table, so
 * the first delimiter-looking line IS its delimiter row — there is no fence for the pattern
 * to wander into. A no-op for aligned tables (remark already draws those to width) and for
 * any block that is not a table.
 */
export function applyTableStyle(markdown: string, style: TableStyle | null | undefined): string {
  if (!style || style.pipeAlign) return markdown;
  const lines = String(markdown ?? "").split("\n");
  const i = lines.findIndex((l) => DELIMITER_ROW.test(l));
  if (i < 1) return markdown; // a delimiter row is never the first line of a table
  const space = style.pad ? " " : "";
  lines[i] = `|${lines[i]
    .split("|")
    .slice(1, -1)
    .map((cell) => {
      const m = /^ *(:?)-+(:?) *$/.exec(cell);
      return m ? `${space}${m[1]}${"-".repeat(style.dashes)}${m[2]}${space}` : cell;
    })
    .join("|")}|`;
  return lines.join("\n");
}
