// Mermaid diagrams on the site's own palette. Mermaid's built-in "default"/"dark"
// themes ignore the theming contract, so a purple-accented site still gets Mermaid's
// blue-grey boxes. With `theme: "base"` + `themeVariables`, Mermaid derives everything
// from the colors we hand it — so diagrams follow `--nb-*`, and a consumer theme
// restyles them for free.
//
// THE NON-OBVIOUS PART (why a probe, see readPalette in mermaid.ts): reading a custom
// property with getComputedStyle returns its RAW text — `light-dark(#…, #…)` — because a
// custom property is substituted, not resolved. Only a real property resolves: an
// element with `color: var(--accent)` computes to `rgb(…)`. Hence a hidden probe.
//
// It reads the INTERNAL aliases (`--accent`, `--text`, …) rather than `--nb-*` on
// purpose: they are the palette the page actually renders with — a consumer's `--nb-*`
// override flows into them, and print.css overrides exactly those to force a light
// palette, so /print and the PDF get light diagrams without a special case.

/** Internal palette variables the probe resolves, in the order the probe emits them. */
export const PROBE_VARS = [
  "--accent",
  "--accent-soft",
  "--text",
  "--text-soft",
  "--text-faint",
  "--bg",
  "--bg-soft",
  "--bg-elev",
  "--border",
] as const;

export type Palette = Partial<Record<(typeof PROBE_VARS)[number], string>> & { fontFamily?: string };

/**
 * Pure: resolved palette → Mermaid `themeVariables` (for `theme: "base"`). Missing
 * entries are dropped rather than defaulted, so Mermaid keeps computing its own value
 * for anything we couldn't read — a partial probe degrades, it never breaks.
 */
export function mermaidThemeVariables(p: Palette): Record<string, string> {
  const accent = p["--accent"];
  const accentSoft = p["--accent-soft"];
  const text = p["--text"];
  const textSoft = p["--text-soft"];
  const bg = p["--bg"];
  const bgSoft = p["--bg-soft"];
  const bgElev = p["--bg-elev"];
  const border = p["--border"];
  const vars: Record<string, string | undefined> = {
    // Nodes: accent-tinted fill, accent border, normal prose color for the label.
    primaryColor: accentSoft,
    mainBkg: accentSoft,
    primaryBorderColor: accent,
    nodeBorder: accent,
    primaryTextColor: text,
    textColor: text,
    titleColor: text,
    // Surfaces behind the diagram (clusters, notes, edge labels).
    background: bg,
    secondaryColor: bgSoft,
    tertiaryColor: bgElev,
    clusterBkg: bgSoft,
    clusterBorder: border,
    noteBkgColor: bgSoft,
    noteTextColor: text,
    noteBorderColor: border,
    edgeLabelBackground: bg,
    // Edges must stay legible without competing with the nodes.
    lineColor: textSoft,
    fontFamily: p.fontFamily,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v) out[k] = v;
  }
  return out;
}

/**
 * Mermaid init config for a render pass. Token mode → the palette-derived "base" theme;
 * opted out (config `theme.mermaid: false`) or an empty probe → the built-in themes,
 * exactly as before. `forceLight` is the /print case for that fallback.
 */
export function mermaidConfig(palette: Palette | null, opts: { dark: boolean; forceLight?: boolean }) {
  const vars = palette ? mermaidThemeVariables(palette) : {};
  if (Object.keys(vars).length > 0) return { theme: "base" as const, themeVariables: vars };
  return { theme: !opts.forceLight && opts.dark ? ("dark" as const) : ("default" as const) };
}
