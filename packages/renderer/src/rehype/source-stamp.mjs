// Rehype plugin — stage 2 of the editor's source map (stage 1: src/remark/source-map.mjs).
//
// Runs AFTER Shiki, so the `<pre>` of a code block has lost its `position` — but the
// top-level mdast→hast correspondence is 1:1 and order-preserving, so the ranges recorded
// in stage 1 can simply be joined BY INDEX. Measured on the 42 real docs pages: 560/576
// blocks stamped, 0 files misaligned; the 16 misses are all `html`, which becomes a hast
// `raw` node that cannot carry properties at all.
//
// That miss is the feature, not a gap: **the absence of a stamp is the editable
// whitelist**. A block the pipeline cannot stamp is a block the editor never opens, so
// any future node type is non-editable by default rather than editable-by-accident.
//
// Fail-closed on misalignment too: if the counts disagree (an unexpected top-level node,
// a future Astro plugin inserting one), NOTHING is stamped and the page is simply not
// editable — never editable-but-wrong.
//
// ATTRIBUTE NAMES ARE LOAD-BEARING. `data-nb-range`, NOT `data-nb-src`: lib/client/mermaid.ts
// already stashes each diagram's SOURCE in `el.dataset.nbSrc`, so stamping `data-nb-src` on a
// ```mermaid fence overwrote it and every diagram failed to render with
// "No diagram type detected ... for text: 120:151". Same reason `data-nb-block` rather than
// `data-nb-kind`. Check `grep -rhoE "data-nb-[a-z-]+" src/` before adding another one.

/** Whitespace-only text nodes are formatting artifacts, not blocks. */
const isFiller = (node) => node.type === "text" && !String(node.value ?? "").trim();

export function rehypeSourceStamp() {
  return (tree, file) => {
    const ranges = file.data?.nbSourceMap;
    if (!Array.isArray(ranges)) return;

    const blocks = (tree.children ?? []).filter((node) => !isFiller(node));
    if (blocks.length !== ranges.length) {
      file.data.nbSourceMapMisaligned = [blocks.length, ranges.length];
      return;
    }

    blocks.forEach((node, i) => {
      const range = ranges[i];
      // `raw` (from an html block) has no properties bag — leave it un-stamped.
      if (!range || node.type !== "element") return;
      node.properties = {
        ...(node.properties ?? {}),
        "data-nb-range": `${range[0]}:${range[1]}`,
        "data-nb-block": range[2],
      };
    });
  };
}
