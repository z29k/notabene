// Client-side Mermaid: render every `pre.mermaid` block (produced by src/remark/mermaid.mjs)
// to SVG. Mermaid is imported LAZILY — only when a diagram is actually present on the page —
// so diagram-less pages never download it. Diagrams are author content from the repo's docs,
// so we render with securityLevel "strict" (no HTML in labels, no clickable JS).

let initialized = false;
let idSeq = 0;

export async function renderMermaid(): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-nb-mermaid])"));
  if (!blocks.length) return;

  const { default: mermaid } = await import("mermaid");
  if (!initialized) {
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
    initialized = true;
  }

  for (const el of blocks) {
    el.setAttribute("data-nb-mermaid", ""); // guard against a second pass (e.g. re-render)
    const src = (el.textContent ?? "").trim();
    if (!src) continue;
    // Preserve the source: after render the element holds the SVG, but block comments
    // (Comments.astro) key on the diagram source, so stash it before we replace it.
    el.dataset.nbSrc = src;
    try {
      const { svg } = await mermaid.render(`nb-mermaid-${idSeq++}`, src);
      // Safe to inject: securityLevel "strict" makes mermaid sanitize its own SVG output
      // (DOMPurify, HTML labels off, no click/script), and `src` is repo docs content —
      // the same trust boundary as the surrounding prose Astro already renders as HTML.
      el.innerHTML = svg;
      el.classList.add("nb-mermaid-ok");
    } catch (err) {
      // Leave the source text visible rather than a blank block; surface the error.
      el.classList.add("nb-mermaid-error");
      console.error("[notabene] mermaid render failed:", err);
    }
  }
}
