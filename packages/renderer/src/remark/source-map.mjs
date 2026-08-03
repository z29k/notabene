// Remark plugin — stage 1 of the editor's source map (see src/rehype/source-stamp.mjs
// for stage 2, and §3 of plans/editeur-wysiwyg.md for why it takes two).
//
// Every mdast node carries a position, so this is where the source ranges are still
// complete: record them, in document order, on the vfile. Nothing is written to the tree
// — stamping the ranges as `hProperties` here would LOSE every code block, because Astro
// runs Shiki (which rebuilds the `<pre>` from scratch) before any user rehype plugin.
//
// Offsets are relative to the BODY Astro hands to remark, i.e. the file with its
// frontmatter already stripped (@astrojs/markdown-remark's parseFrontmatter, "remove"
// mode). The server re-derives the same base with the same function — see lib/page-file.

/** @typedef {[start: number, end: number, kind: string]} BlockRange */

/**
 * `.mdx` is deliberately NOT mapped. Two reasons, both load-bearing:
 *
 *  1. Its offsets are not in the same coordinate system. `@astrojs/mdx` does not hand
 *     remark a frontmatter-stripped body the way the markdown content entry type does, so
 *     a heading at body offset 0 comes out stamped at 26 — every range would miss.
 *  2. The server re-parses with remark + gfm, WITHOUT remark-mdx, to check the containment
 *     invariant. On an `.mdx` file it would be reasoning about different blocks than the
 *     renderer produced.
 *
 * The write path already refuses those ranges (they align with no block, so `GET` answers
 * `stale`), but refusing late means the UI lights up a block that can never be saved.
 * Not mapping at all is the same fail-closed outcome, honestly signalled: no stamp, no
 * affordance, no editor. Lifting this needs a real MDX-aware parse on both sides.
 */
const isMdx = (file) => /\.mdx$/i.test(String(file?.path ?? file?.history?.[0] ?? ""));

export function remarkSourceMap() {
  return (tree, file) => {
    if (isMdx(file)) return;
    const ranges = [];
    for (const node of tree.children ?? []) {
      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      ranges.push(typeof start === "number" && typeof end === "number" ? [start, end, node.type] : null);
    }
    file.data.nbSourceMap = ranges;
  };
}
