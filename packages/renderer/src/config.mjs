// Config resolver — the SINGLE place that knows the file layout. Imported by
// astro.config.mjs, content.config.ts, the remark plugin and the runtime libs
// (server-only: uses node:path/url; NEVER from a client script — the client gets
// `clientRoots` serialized as JSON).
//
// Run-from-package model: the renderer lives in the consumer's node_modules and is
// pointed at the consumer's repo at runtime. Only the DATA (docs, notabene.config,
// .notabene store) lives in the consumer repo.
//   NOTABENE_ROOT   — consumer repo root (defaults to process.cwd()).
//   NOTABENE_CONFIG — path to notabene.config.mjs (defaults to <root>/notabene.config.mjs).
// The CLI (bin/notabene.mjs) sets these before invoking astro.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { contains } from "./lib/asset-dir.mjs";
import { decode as decodeLocale, routeFor as i18nRouteFor, localizeField } from "./lib/i18n-content.mjs";
import { filterPublicNav, hasFooter, navClientLabels, normalizeNav } from "./lib/nav-links.mjs";
import { codeThemeCss, normalizeCodeTheme } from "./lib/shiki-themes.mjs";
import { tokensToCss, validateTokens } from "./lib/theme-tokens.mjs";

export const REPO_ROOT = process.env.NOTABENE_ROOT ? path.resolve(process.env.NOTABENE_ROOT) : process.cwd();

const CONFIG_PATH = process.env.NOTABENE_CONFIG
  ? path.resolve(process.env.NOTABENE_CONFIG)
  : path.resolve(REPO_ROOT, "notabene.config.mjs");

// Zero-config is opt-in via NOTABENE_ALLOW_DEFAULTS=1 (set by the plugin forwarder). A
// MISSING config then falls back to the defaults below (drop-in on any repo); a config
// that EXISTS but fails to load ALWAYS throws — never silently defaulted. Bare CLI use
// (no gate) keeps its explicit "run init first" error, so ergonomics don't change.
const ALLOW_DEFAULTS = process.env.NOTABENE_ALLOW_DEFAULTS === "1";
const CONFIG_EXISTS = fs.existsSync(CONFIG_PATH);

// Top-level await: load the consumer's config by absolute path. Astro loads this
// module (via astro.config.mjs / content.config.ts) as ESM, which supports TLA.
let userConfig;
if (!CONFIG_EXISTS) {
  if (!ALLOW_DEFAULTS) {
    throw new Error(
      `notabene: could not load config at ${CONFIG_PATH}. Run \`notabene init\` first, or set NOTABENE_CONFIG.`,
    );
  }
  userConfig = {};
} else {
  try {
    userConfig = (await import(/* @vite-ignore */ pathToFileURL(CONFIG_PATH).href)).default ?? {};
  } catch (err) {
    throw new Error(
      `notabene: could not load config at ${CONFIG_PATH}. Run \`notabene init\` first, ` +
        `or set NOTABENE_CONFIG. (${err instanceof Error ? err.message : err})`,
    );
  }
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Input format (§10.bis) — the renderer supports MDX AND CommonMark/GFM:
//   "mdx"        (default): globs .md + .mdx, MDX integration loaded. .mdx parsed
//                STRICT (JSX/expressions), .md as CommonMark/GFM LENIENT. A repo can
//                mix both, by extension.
//   "commonmark" (alias "gfm"/"md"): globs .md + .markdown, MDX NOT loaded. Everything
//                CommonMark/GFM lenient — zero MDX dependency/strictness.
// Zero-config picks the safer commonmark (no MDX-safety traps); an explicit config keeps
// the code default of "mdx". No behavior change for any existing config (it has a file).
const FORMAT = String(userConfig.format ?? (CONFIG_EXISTS ? "mdx" : "commonmark")).toLowerCase();
export const format = FORMAT === "gfm" || FORMAT === "md" ? "commonmark" : FORMAT;
export const mdxEnabled = format === "mdx";
export const extensions = mdxEnabled ? ["md", "mdx"] : ["md", "markdown"];
const extGlob = extensions.length === 1 ? extensions[0] : `{${extensions.join(",")}}`;

// `label`/`description` are per-locale-aware: each is a plain string OR a `{ <locale>: string }`
// map (see localizeField). `label`/`description` below are the DEFAULT-locale resolution — a
// stable string for locale-agnostic consumers (CLI doctor, the `key` fallback). Locale-aware
// surfaces (sidebar, space index, breadcrumbs, print, and the client re-localizers) resolve the
// raw `labelI18n`/`descriptionI18n` against the rendered locale instead.
function normalizeRoot(root, defaultLocale, storePath) {
  const rel = String(root.path).replace(/\\/g, "/").replace(/\/+$/, "");
  const abs = path.resolve(REPO_ROOT, rel);
  const declaredExclude = Array.isArray(root.exclude) ? root.exclude : [];
  // The store is DATA, never content. `roots[].exclude: [".notabene/**"]` says so in the
  // generated configs, but a hand-written config needn't — and since `init` now drops a
  // `<store>/protocol.md`, a store path that isn't dot-hidden would otherwise render as
  // a doc page (and ship in public builds). Exclude it from the glob unconditionally.
  const storeInside = storePath.startsWith(`${rel}/`) ? storePath.slice(rel.length + 1) : null;
  const excludeGlobs = storeInside ? [...declaredExclude, `${storeInside}/**`] : declaredExclude;
  const rawLabel = root.label ?? rel;
  const rawDescription = root.description ?? "";
  return {
    // The `key` is a URL segment → derive it from a stable value, never a per-locale map.
    key: root.key ?? slugify(typeof root.label === "string" ? root.label : rel),
    label: localizeField(rawLabel, defaultLocale, defaultLocale) ?? rel,
    description: localizeField(rawDescription, defaultLocale, defaultLocale) ?? "",
    // Raw (possibly per-locale) values for locale-aware rendering.
    labelI18n: rawLabel,
    descriptionI18n: rawDescription,
    // Logical repo-relative path (= prefix of a comment's `page` field).
    path: rel,
    // Sidebar sub-title (e.g. "docs/").
    subLabel: `${rel}/`,
    exclude: declaredExclude,
    // Public-build scoping: `publish: false` keeps this WHOLE space out of a
    // `build --public` artifact (routes, nav, search, llms, twins, sitemap).
    // Dev/normal builds always include everything.
    publish: root.publish !== false,
    abs,
    baseUrl: pathToFileURL(abs),
    // Content-loader glob: format extensions minus the exclusions.
    pattern: [`**/*.${extGlob}`, ...excludeGlobs.map((e) => `!${e}`)],
  };
}

export const siteName = userConfig.siteName ?? "Docs";
export const tagline = userConfig.tagline ?? "docs";
export const locale = userConfig.locale ?? "en";
export const port = userConfig.port ?? 3009;
export const host = process.env.NOTABENE_HOST ? true : (userConfig.host ?? false);
export const verify = Array.isArray(userConfig.verify) ? userConfig.verify : [];

// Review loop mode (§ two-phase review):
//   "auto"    (default): the agent resolves comments directly (open → resolved).
//   "approve"          : the agent proposes (open → addressed); a human validates
//                        (addressed → resolved) or rejects (→ open) after seeing the diff.
export const reviewMode = String(userConfig.review ?? "auto").toLowerCase() === "approve" ? "approve" : "auto";

// Default comment author. Config `author` wins; otherwise the CLI passes the repo's
// `git config user.name` via NOTABENE_AUTHOR; else "you". The browser overrides this
// per-device via localStorage (see the identity chip) — this is only the fallback.
export const author = userConfig.author ?? process.env.NOTABENE_AUTHOR ?? "you";
// Optional default author email — config `authorEmail` wins, else the CLI passes the repo's
// `git config user.email` via NOTABENE_AUTHOR_EMAIL. Only a fallback; each browser sets its
// own via the identity dialog. Embedded git-style ("Name <email>") into comment authors.
export const authorEmail = userConfig.authorEmail ?? process.env.NOTABENE_AUTHOR_EMAIL ?? "";

// "Edit this page" link (optional). A URL pattern whose `{path}` placeholder is
// replaced by the page's repo-relative source path, e.g.
//   editPattern: "https://github.com/you/repo/edit/main/{path}"
// Rendered under every doc page (dev AND public builds). The placeholder is
// REQUIRED — without it every link would silently be the same URL (nimbus lesson:
// validate at load, never ship broken links).
const editPatternCfg = userConfig.editPattern ?? null;
if (editPatternCfg != null && !String(editPatternCfg).includes("{path}")) {
  throw new Error('notabene: editPattern must contain the "{path}" placeholder.');
}
export const editPattern = editPatternCfg == null ? null : String(editPatternCfg);

// PDF export (§ /print routes). Optional, backward-compatible (zero-config → defaults).
//   enabled  — show the Export menu + serve /print (default true).
//   pageSize — @page size keyword or dimensions ("A4", "Letter", "210mm 297mm").
//   margin   — @page margin (a single CSS length applied to all sides).
// Consumed by the print route + PrintLayout (injected as an inline @page rule).
const pdfCfg = userConfig.pdf ?? {};
export const pdf = {
  enabled: pdfCfg.enabled ?? true,
  pageSize: pdfCfg.pageSize ?? "A4",
  margin: pdfCfg.margin ?? "18mm",
};

// Public publish mode (§ public exposure). `notabene build --public` produces a
// read-only STATIC site — no comments/review/journal UI, no write API, no store
// data — with an agent-readable surface (llms.txt, per-page .md twins, sitemap).
// Opt-in PER BUILD via NOTABENE_PUBLIC=1 (set by the CLI flag), never a repo
// state: a normal dev/build run stays byte-identical to pre-publish behavior.
//   publish.site — absolute ORIGIN of the deployed site (e.g.
//                  "https://user.github.io"). OPTIONAL: with it, absolute URLs are
//                  baked (canonical, og:url, JSON-LD, hreflang, llms.txt, sitemap,
//                  robots' Sitemap line). WITHOUT it the artifact is
//                  ORIGIN-AGNOSTIC — same output behind any domain (server-side
//                  vhost/proxy): those surfaces fall back to root-relative paths
//                  and the origin-only ones (sitemap, canonical, og:url, JSON-LD)
//                  are simply not emitted. Must not carry a path — a sub-path
//                  belongs in `base`.
//   publish.base — optional sub-path when the site is served under a prefix
//                  (GitHub Pages project site → "/<repo>"). Default "/". Applied
//                  to Astro's `base` ONLY in public mode. Unlike the domain, a
//                  sub-path always affects rendering — it cannot be server-side.
// CLI flags --site/--base override the config (via NOTABENE_SITE/NOTABENE_BASE).
export const publicMode = process.env.NOTABENE_PUBLIC === "1";
const publishCfg = userConfig.publish ?? {};
function normalizeBase(raw) {
  if (raw == null || raw === "" || raw === "/") return "/";
  const b = String(raw);
  if (!b.startsWith("/")) {
    throw new Error(`notabene: publish.base must start with "/" (got "${raw}").`);
  }
  const trimmed = b.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}
function normalizeSite(raw) {
  if (raw == null || raw === "") return undefined;
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error(`notabene: publish.site must be an absolute URL (got "${raw}").`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`notabene: publish.site must be http(s) (got "${raw}").`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      `notabene: publish.site must be an origin only (got "${raw}") — put the sub-path in publish.base instead.`,
    );
  }
  return url.origin;
}
// publish.exclude — glob patterns (`*` segment, `**` deep) matched against a page's
// LOCALE-INDEPENDENT public identity `<space key>/<canonical id>` (i.e. its URL path
// without locale prefix), so one pattern hides every translation. Complements the
// per-space `roots[].publish: false` and per-page frontmatter `publish: false`.
const publishExclude = publishCfg.exclude ?? [];
if (!Array.isArray(publishExclude) || publishExclude.some((g) => typeof g !== "string")) {
  throw new Error("notabene: publish.exclude must be an array of glob strings.");
}
export const publish = {
  site: normalizeSite(process.env.NOTABENE_SITE ?? publishCfg.site),
  base: normalizeBase(process.env.NOTABENE_BASE ?? publishCfg.base),
  exclude: publishExclude,
};

// Content i18n (multi-language docs). Optional, backward-compatible: no `i18n` block →
// one locale (the global `locale`), `enabled:false` → identical to a mono-language site.
//   locales       — content languages, e.g. ["en","fr"]; order = switcher order.
//   defaultLocale — the UNPREFIXED language (route /docs/…); others get /<locale>/….
//   strategy      — "directory" (docs/<loc>/…) | "suffix" (guide.md + guide.fr.md).
// The pure resolver lives in lib/i18n-content.mjs. The global `locale` is the DEFAULT UI
// language; per-doc pages (and the per-locale site home, /<locale>) follow their own locale,
// while the cross-locale aggregate pages (/comments, /journal, /review, 404) re-localize to the
// visitor's chosen language client-side (DocLayout `i18nClientChrome`). Computed BEFORE roots:
// normalizeRoot resolves each root's default-locale label/description against `defaultLocale`.
const i18nCfg = userConfig.i18n ?? {};
const i18nLocales = Array.isArray(i18nCfg.locales) && i18nCfg.locales.length ? i18nCfg.locales.map(String) : [locale];
const i18nDefault =
  i18nCfg.defaultLocale && i18nLocales.includes(i18nCfg.defaultLocale)
    ? i18nCfg.defaultLocale
    : i18nLocales.includes(locale)
      ? locale
      : i18nLocales[0];
export const i18n = {
  locales: i18nLocales,
  defaultLocale: i18nDefault,
  strategy: i18nCfg.strategy === "suffix" ? "suffix" : "directory",
  enabled: i18nLocales.length > 1,
};

/**
 * @typedef {Object} Root
 * @property {string} key
 * @property {string} label default-locale label (stable, locale-agnostic)
 * @property {string} description default-locale description
 * @property {string|Record<string,string>} labelI18n raw label — string or per-locale map
 * @property {string|Record<string,string>} descriptionI18n raw description — string or per-locale map
 * @property {string} path
 * @property {string} subLabel
 * @property {string[]} exclude
 * @property {boolean} publish false = this space stays out of `build --public` artifacts
 * @property {string} abs
 * @property {URL} baseUrl
 * @property {string[]} pattern
 */

// Store (comments + journal), resolved to absolute. Default: docs/.notabene. Declared
// BEFORE roots: normalizeRoot keeps the store out of a space's content glob.
export const storeRel = (userConfig.store ?? "docs/.notabene").replace(/\\/g, "/").replace(/\/+$/, "");
export const storeAbs = path.resolve(REPO_ROOT, storeRel);

/** @type {Root[]} — `userConfig` is untyped (loaded dynamically), so annotate the
 *  resolved shape here; importers (nav, pages, remark) rely on this being typed. */
export const roots = (userConfig.roots ?? [{ label: "Docs", path: "docs" }]).map((r) =>
  normalizeRoot(r, i18n.defaultLocale, storeRel),
);

// A locale key must never collide with a space key (both occupy the URL's first segment).
if (i18n.enabled) {
  const keys = new Set(roots.map((r) => r.key));
  const clash = i18n.locales.find((l) => keys.has(l));
  if (clash) throw new Error(`notabene: i18n locale "${clash}" collides with a roots[] key — rename one.`);
}
// Serializable subset for client scripts (language switcher, search filter).
export const clientI18n = {
  locales: i18n.locales,
  defaultLocale: i18n.defaultLocale,
  strategy: i18n.strategy,
  enabled: i18n.enabled,
};

// Serializable roots for client scripts (no absolute paths / node:* leak). The raw per-locale
// label/description maps ride along ONLY when i18n is enabled, so a mono-language site's
// serialized `#notabene-roots` stays byte-identical (client resolves via localizeField).
// Public builds drop private spaces here too — their key/label/path must not reach the
// public `<head>` (same scoping as the routes; see lib/public-filter.ts).
export const clientRoots = (publicMode ? roots.filter((r) => r.publish) : roots).map((r) => ({
  key: r.key,
  label: r.label,
  path: r.path,
  ...(i18n.enabled ? { labelI18n: r.labelI18n, descriptionI18n: r.descriptionI18n } : {}),
}));

// Custom site home (§ SiteHome). Optional: a repo-relative Markdown file rendered as
// the landing-page content, above the space cards — the classic use is a README-like
// welcome written FOR the site (relative links to doc pages get rewritten to routes).
// A plain string applies to every locale; a per-locale map resolves like
// roots[].label (localizeField). The file may live OUTSIDE any space (recommended: a
// dedicated doc); inside a space it ALSO renders as a normal page of that space.
// Loaded through a dedicated content collection ("nb-home", see content.config.ts) so
// it gets the full pipeline (Shiki, Mermaid, link rewriting). Omitted → the default
// landing (site name + space cards) is byte-identical to before.
function normalizeRepoFile(raw, what) {
  const rel = String(raw).replace(/\\/g, "/").replace(/^\.\//, "");
  const abs = path.resolve(REPO_ROOT, rel);
  if (!abs.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`notabene: ${what} file "${raw}" escapes the repo root.`);
  }
  if (!fs.existsSync(abs)) {
    throw new Error(`notabene: ${what} file "${raw}" not found (the path is repo-relative).`);
  }
  return rel;
}
const homeCfg = userConfig.home ?? null;
export const home =
  homeCfg == null
    ? null
    : typeof homeCfg === "string"
      ? normalizeRepoFile(homeCfg, "home")
      : Object.fromEntries(Object.entries(homeCfg).map(([loc, p]) => [loc, normalizeRepoFile(p, "home")]));
export const homeFiles = home == null ? [] : [...new Set(typeof home === "string" ? [home] : Object.values(home))];
if (homeFiles.length > 0 && roots.some((r) => r.key === "nb-home")) {
  throw new Error('notabene: the space key "nb-home" is reserved for the custom home collection — rename that root.');
}

// Branding (§ identity). All optional, all repo-relative files served through the
// prerendered /_nb/<name>.<ext> asset route (src/pages/_nb/) — the run-from-package
// answer to "my assets live in MY repo": nothing is scaffolded, the config points.
//   logo / logoDark — topbar image next to the site name (dark variant swapped in CSS).
//   favicon         — <link rel="icon"> (svg/ico/png). Unset → a built-in default
//                     (inline data-URI) so tabs are never blank.
//   socialImage     — og:image / twitter:image of PUBLIC builds (needs publish.site
//                     for the absolute URL the crawlers require).
const brandingCfg = userConfig.branding ?? {};
const brandFile = (key) => (brandingCfg[key] == null ? null : normalizeRepoFile(brandingCfg[key], `branding.${key}`));
export const branding = {
  logo: brandFile("logo"),
  logoDark: brandFile("logoDark"),
  favicon: brandFile("favicon"),
  socialImage: brandFile("socialImage"),
};

// Outbound navigation (§ nav links). Optional, three mount points, ONE item shape
// (`{ label, href, icon?, iconOnly?, publish? }` — see lib/nav-links.mjs, where all the
// validation lives):
//   nav.header  — topbar links (mirrored into the mobile drawer, like every util).
//   nav.sidebar — a titled block under the space tree (drawer gets it for free).
//   nav.footer  — the site footer: links + a localizable line + an opt-in "powered by".
// A FIRST-LEVEL key, deliberately not `theme.nav`: links are repo DATA (they depend on
// the repo, not on the appearance), so a theme package can style them but never declare
// one. Public builds drop `publish: false` links HERE — a single filter, so no component
// has to know about publish scoping. Unset → nothing is emitted anywhere (byte-identical).
const navAll = normalizeNav(userConfig.nav ?? null);
export const nav = publicMode ? filterPublicNav(navAll) : navAll;
export const navFooter = hasFooter(nav);
// Per-locale nav strings for the cross-locale aggregate pages (see clientRoots).
export const clientNavLabels = i18n.enabled ? navClientLabels(nav) : {};

// Theme (§ theming contract). Two knobs, combinable; both target ONLY the `--nb-*`
// tokens documented in lib/theme-tokens.mjs + styles/global.css:
//   theme.css    — a repo-relative stylesheet loaded AFTER the renderer's styles
//                  (served at /_nb/theme.css like the branding assets).
//   theme.tokens — quick inline overrides without a CSS file: { accent: "#7c3aed" }.
//                  Keys are validated against the contract (a typo throws, never
//                  silently no-ops); values are emitted verbatim.
//   theme.code   — syntax-highlighting theme: a bundled Shiki name, or { light, dark }.
//                  Set → Shiki emits BOTH palettes as CSS variables (defaultColor:false)
//                  and the scheme toggle recolors code with no rebuild; the code theme
//                  then owns the block background too (see codeThemeCss). Unset → the
//                  renderer's single github-dark, byte-identical to before.
//   theme.mermaid— false opts diagrams OUT of the palette (Mermaid's own themes instead);
//                  default true, i.e. diagrams follow --nb-* like everything else.
//   theme.assets — a repo-relative FOLDER served at the fixed /_nb/assets/<path>, so a
//                  stylesheet can ship its own fonts/images and the artifact stays
//                  self-contained (no CDN). Everything in it is emitted, referenced or
//                  not → declare a dedicated folder, never `docs/`. Guarded by
//                  lib/asset-dir.mjs (extension allow-list + containment).
// print.css overrides the INTERNAL variables, so themes can never break the PDF.
function normalizeRepoDir(raw, what) {
  const rel = String(raw).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  const abs = path.resolve(REPO_ROOT, rel);
  if (!contains(REPO_ROOT, abs) || abs === path.resolve(REPO_ROOT)) {
    throw new Error(`notabene: ${what} folder "${raw}" must be a folder INSIDE the repo.`);
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`notabene: ${what} folder "${raw}" not found (the path is repo-relative).`);
  }
  // The folder itself may be a symlink — resolve it before trusting the path check
  // above (containment is compared REAL path to REAL path: on macOS the repo may sit
  // under /tmp, itself a symlink to /private/tmp).
  if (!contains(fs.realpathSync(REPO_ROOT), fs.realpathSync(abs))) {
    throw new Error(`notabene: ${what} folder "${raw}" is a symlink escaping the repo.`);
  }
  return rel;
}
const themeCfg = userConfig.theme ?? {};
const themeTokens = themeCfg.tokens ?? {};
validateTokens(themeTokens);
const themeCode = normalizeCodeTheme(themeCfg.code ?? null);
export const theme = {
  css: themeCfg.css == null ? null : normalizeRepoFile(themeCfg.css, "theme.css"),
  assets: themeCfg.assets == null ? null : normalizeRepoDir(themeCfg.assets, "theme.assets"),
  tokens: themeTokens,
  /** null = single built-in theme (unchanged); { light, dark } = dual-theme Shiki. */
  code: themeCode,
  /** false → Mermaid keeps its built-in themes (see lib/client/mermaid-theme.ts). */
  mermaid: themeCfg.mermaid !== false,
  /** Inline `<style>` body for the token overrides ("" when none). */
  tokensCss: tokensToCss(themeTokens),
  /** Inline `<style>` body wiring Shiki's dual output to light-dark() ("" when none). */
  codeCss: codeThemeCss(themeCode),
};

/**
 * Logical `page` path (e.g. "docs/plans/services/x") → site route. Most specific root
 * (longest path) first — a nested space (docs/plans) must win over its parent (docs).
 * Locale-aware: the raw id (which encodes the locale, e.g. "docs/en/x" or "docs/x.fr") is
 * decoded and re-emitted as a clean prefixed URL. With i18n disabled this is unchanged.
 */
export function routeForPage(page) {
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);
  for (const r of ordered) {
    let rawId = null;
    if (page === r.path) rawId = "";
    else if (page.startsWith(`${r.path}/`)) rawId = page.slice(r.path.length + 1);
    if (rawId === null) continue;
    const { locale: loc, id } = decodeLocale(rawId, i18n);
    return i18nRouteFor({ space: r.key, id, locale: loc }, i18n);
  }
  return "#";
}

export default {
  REPO_ROOT,
  siteName,
  tagline,
  locale,
  format,
  mdxEnabled,
  extensions,
  port,
  host,
  verify,
  reviewMode,
  author,
  authorEmail,
  editPattern,
  pdf,
  publicMode,
  publish,
  i18n,
  clientI18n,
  roots,
  storeRel,
  storeAbs,
  clientRoots,
  home,
  homeFiles,
  branding,
  nav,
  navFooter,
  clientNavLabels,
  theme,
  routeForPage,
};
