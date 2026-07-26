// Client-side Mermaid: render every `pre.mermaid` block (produced by src/remark/mermaid.mjs)
// to SVG. Mermaid is imported LAZILY — only when a diagram is actually present on the page —
// so diagram-less pages never download it. Diagrams are author content from the repo's docs,
// so we render with securityLevel "strict" (no HTML in labels, no clickable JS).
import { effectiveScheme } from "./scheme";

let lastTheme: string | null = null;
let schemeListener = false;
let idSeq = 0;

// `forceLight` pins the light ("default") theme regardless of the effective scheme —
// used on the /print route, which forces a white page: a dark-themed diagram (dark nodes,
// light text) would otherwise be unreadable on white paper / in the PDF.
export async function renderMermaid(opts?: { forceLight?: boolean }): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-nb-mermaid])"));
  if (!blocks.length) return;

  const { default: mermaid } = await import("mermaid");
  // Theme follows the EFFECTIVE scheme (manual toggle wins over the system — see
  // lib/client/scheme). Re-initialize whenever it changed since the last render.
  const theme = !opts?.forceLight && effectiveScheme() === "dark" ? "dark" : "default";
  if (theme !== lastTheme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme });
    lastTheme = theme;
  }
  // The toggle re-themes rendered diagrams: drop the per-block guard so the pass
  // below re-renders each one from its stashed source. Registered once; inert on
  // /print (no toggle there).
  if (!schemeListener && !opts?.forceLight) {
    schemeListener = true;
    document.addEventListener("nb-scheme-change", () => {
      for (const el of document.querySelectorAll<HTMLElement>("pre.mermaid[data-nb-mermaid]")) {
        el.removeAttribute("data-nb-mermaid");
      }
      renderMermaid();
    });
  }

  for (const el of blocks) {
    el.setAttribute("data-nb-mermaid", ""); // guard against a second pass (e.g. re-render)
    // Prefer the stashed source: after a first render the element holds the SVG. Block
    // comments (Comments.astro) key on the same stash.
    const src = (el.dataset.nbSrc ?? el.textContent ?? "").trim();
    if (!src) continue;
    el.dataset.nbSrc = src;
    try {
      const { svg } = await mermaid.render(`nb-mermaid-${idSeq++}`, src);
      // Safe to inject: securityLevel "strict" makes mermaid sanitize its own SVG output
      // (DOMPurify, HTML labels off, no click/script), and `src` is repo docs content —
      // the same trust boundary as the surrounding prose Astro already renders as HTML.
      el.innerHTML = svg;
      el.classList.add("nb-mermaid-ok");
      el.classList.remove("nb-mermaid-error");
    } catch (err) {
      // Leave the source text visible rather than a blank block; surface the error.
      el.classList.add("nb-mermaid-error");
      console.error("[notabene] mermaid render failed:", err);
    }
  }
}
