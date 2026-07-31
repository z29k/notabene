// The Shiki themes a consumer may name in config `theme.code` — Shikis BUNDLED set,
// which is what Astro ships. Kept as a STATIC list (same pattern as NB_TOKENS) so
// config.mjs can validate a name under raw Node without importing Shiki; a unit test
// cross-checks it against the installed `shiki` package, so an upgrade that adds or
// drops a theme is caught instead of drifting silently.

/** Bundled Shiki theme names, alphabetical. @type {string[]} */
export const SHIKI_THEMES = [
  "andromeeda",
  "aurora-x",
  "ayu-dark",
  "ayu-light",
  "ayu-mirage",
  "catppuccin-frappe",
  "catppuccin-latte",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "dark-plus",
  "dracula",
  "dracula-soft",
  "everforest-dark",
  "everforest-light",
  "github-dark",
  "github-dark-default",
  "github-dark-dimmed",
  "github-dark-high-contrast",
  "github-light",
  "github-light-default",
  "github-light-high-contrast",
  "gruvbox-dark-hard",
  "gruvbox-dark-medium",
  "gruvbox-dark-soft",
  "gruvbox-light-hard",
  "gruvbox-light-medium",
  "gruvbox-light-soft",
  "horizon",
  "horizon-bright",
  "houston",
  "kanagawa-dragon",
  "kanagawa-lotus",
  "kanagawa-wave",
  "laserwave",
  "light-plus",
  "material-theme",
  "material-theme-darker",
  "material-theme-lighter",
  "material-theme-ocean",
  "material-theme-palenight",
  "min-dark",
  "min-light",
  "monokai",
  "night-owl",
  "night-owl-light",
  "nord",
  "one-dark-pro",
  "one-light",
  "plastic",
  "poimandres",
  "red",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "slack-dark",
  "slack-ochin",
  "snazzy-light",
  "solarized-dark",
  "solarized-light",
  "synthwave-84",
  "tokyo-night",
  "vesper",
  "vitesse-black",
  "vitesse-dark",
  "vitesse-light",
];

/**
 * config `theme.code` → `{ light, dark }` (dual-theme mode) or null (leave Shiki on the
 * renderer's built-in single theme, i.e. today's output byte for byte).
 *   "github-light"                → both schemes use it
 *   { light: "…", dark: "…" }     → one per scheme
 * A typo throws, like every other theme knob — a silently ignored theme name would be
 * indistinguishable from "the feature doesn't work".
 */
export function normalizeCodeTheme(raw) {
  if (raw == null) return null;
  const check = (name, where) => {
    if (typeof name !== "string" || !SHIKI_THEMES.includes(name)) {
      throw new Error(`notabene: unknown ${where} "${name}" — see the bundled Shiki themes (e.g. github-light).`);
    }
    return name;
  };
  if (typeof raw === "string") {
    const one = check(raw, "theme.code");
    return { light: one, dark: one };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("notabene: theme.code must be a theme name or { light, dark }.");
  }
  for (const k of Object.keys(raw)) {
    if (k !== "light" && k !== "dark") {
      throw new Error(`notabene: unknown key "${k}" in theme.code — valid keys: light, dark.`);
    }
  }
  if (raw.light == null || raw.dark == null) {
    throw new Error("notabene: theme.code needs BOTH light and dark (or a single theme name for both).");
  }
  return { light: check(raw.light, "theme.code.light"), dark: check(raw.dark, "theme.code.dark") };
}

/**
 * Inline CSS bridging Shiki's dual-theme output to the scheme toggle. With
 * `defaultColor: false` Shiki bakes NO color — only `--shiki-light`/`--shiki-dark` (per
 * token) and `--shiki-*-bg` (per block) — so `light-dark()` picks the right one and the
 * manual light/dark toggle recolors code with no rebuild. Emitted ONLY in dual mode
 * ("" otherwise → the output of every prior version, to the byte).
 *
 * The background goes through the INTERNAL `--code-bg` rather than a competing
 * `background` rule: a declaration on the element beats the inherited `:root` value, and
 * global.css's `background: var(--code-bg) !important` then renders it — an `!important`
 * of our own would lose anyway, since for important declarations the layer order is
 * REVERSED and this snippet is un-layered. Consequence, and it is the right one: with
 * `theme.code` the code theme owns the block background (forcing `--nb-code-bg` over it
 * would put a light theme's tokens on a dark slab); the token is the default for
 * everyone who sets no code theme. A consumer stylesheet, loaded after this, still wins.
 */
export function codeThemeCss(code) {
  if (!code) return "";
  return (
    ".prose pre.astro-code{--code-bg:light-dark(var(--shiki-light-bg),var(--shiki-dark-bg))}" +
    ".prose pre.astro-code,.prose pre.astro-code span{color:light-dark(var(--shiki-light),var(--shiki-dark))}"
  );
}
