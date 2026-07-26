// The public theming contract — the `--nb-*` custom properties a theme may override
// (see the contract comment atop styles/global.css; the two lists must stay in sync).
// `.mjs` so config.mjs (dynamically imported by the CLI's doctor under raw Node) can
// validate `theme.tokens` keys without a TypeScript loader.

/** Token names WITHOUT the `--nb-` prefix, as accepted by config `theme.tokens`. */
export const NB_TOKENS = [
  "bg",
  "bg-soft",
  "bg-elev",
  "border",
  "text",
  "text-soft",
  "text-faint",
  "accent",
  "accent-soft",
  "ref",
  "work",
  "code-bg",
  "topbar-h",
  "sidebar-w",
  "toc-w",
  "content-max",
  "radius",
  "mono",
  "sans",
];

/** Inline CSS overriding the given tokens (`{ accent: "#7c3aed" }` → ":root{--nb-accent:#7c3aed}").
 *  Callers validate keys first (validateTokens); values are emitted verbatim. */
export function tokensToCss(tokens) {
  const decls = Object.entries(tokens)
    .map(([k, v]) => `--nb-${k}:${v}`)
    .join(";");
  return decls ? `:root{${decls}}` : "";
}

/** Throws on any key outside the contract — a typo'd token must never silently no-op. */
export function validateTokens(tokens) {
  for (const k of Object.keys(tokens)) {
    if (!NB_TOKENS.includes(k)) {
      throw new Error(`notabene: unknown theme token "${k}" — valid tokens: ${NB_TOKENS.join(", ")}.`);
    }
  }
}
