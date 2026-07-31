// Client-side Mermaid: render every `pre.mermaid` block (produced by src/remark/mermaid.mjs)
// to SVG. Mermaid is imported LAZILY — only when a diagram is actually present on the page —
// so diagram-less pages never download it. Diagrams are author content from the repo's docs,
// so we render with securityLevel "strict" (no HTML in labels, no clickable JS).
import { type Palette, PROBE_VARS, mermaidConfig } from "./mermaid-theme";
import { effectiveScheme } from "./scheme";

let lastConfig: string | null = null;
let schemeListener = false;
let idSeq = 0;

/**
 * Resolve the site palette through a hidden probe. A custom property read back with
 * getComputedStyle is its RAW text (`light-dark(#…, #…)`) — useless — while a real
 * property is resolved; so each probe child carries `color: var(--…)` and we read its
 * computed `color`. One container, appended once, read in a single pass.
 * Returns null when the document opts out (config `theme.mermaid: false`).
 */
function readPalette(): Palette | null {
  if (document.documentElement.dataset.nbDiagramTheme === "plain") return null;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none";
  for (const name of PROBE_VARS) {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    host.appendChild(probe);
  }
  document.body.appendChild(host);
  const palette: Palette = {};
  try {
    PROBE_VARS.forEach((name, i) => {
      const color = getComputedStyle(host.children[i] as HTMLElement).color;
      if (color) palette[name] = color;
    });
    // Font family resolves as-is (no light-dark() involved) — read it off the body.
    const font = getComputedStyle(document.body).fontFamily;
    if (font) palette.fontFamily = font;
  } finally {
    host.remove();
  }
  return palette;
}

// `forceLight` pins the light theme regardless of the effective scheme — used on the
// /print route, which forces a white page: a dark-themed diagram (dark nodes, light
// text) would otherwise be unreadable on white paper / in the PDF. In palette mode it
// is moot: print.css forces `color-scheme: light`, so the probe already reads the light
// palette.
export async function renderMermaid(opts?: { forceLight?: boolean }): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-nb-mermaid])"));
  if (!blocks.length) return;

  const { default: mermaid } = await import("mermaid");
  // Diagrams follow the site palette (theme "base" + themeVariables read from the live
  // CSS), and therefore the EFFECTIVE scheme — manual toggle included, since the probe
  // resolves whatever is currently applied. Re-initialize whenever that changed.
  const config = mermaidConfig(readPalette(), { dark: effectiveScheme() === "dark", forceLight: opts?.forceLight });
  const signature = JSON.stringify(config);
  if (signature !== lastConfig) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", ...config });
    lastConfig = signature;
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
