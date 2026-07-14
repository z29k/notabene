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
import { decode as decodeLocale, routeFor as i18nRouteFor } from "./lib/i18n-content.mjs";

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

function normalizeRoot(root) {
  const rel = String(root.path).replace(/\\/g, "/").replace(/\/+$/, "");
  const abs = path.resolve(REPO_ROOT, rel);
  return {
    key: root.key ?? slugify(root.label ?? rel),
    label: root.label ?? rel,
    description: root.description ?? "",
    // Logical repo-relative path (= prefix of a comment's `page` field).
    path: rel,
    // Sidebar sub-title (e.g. "docs/").
    subLabel: `${rel}/`,
    exclude: Array.isArray(root.exclude) ? root.exclude : [],
    abs,
    baseUrl: pathToFileURL(abs),
    // Content-loader glob: format extensions minus the exclusions.
    pattern: [`**/*.${extGlob}`, ...(root.exclude ?? []).map((e) => `!${e}`)],
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

/**
 * @typedef {Object} Root
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {string} path
 * @property {string} subLabel
 * @property {string[]} exclude
 * @property {string} abs
 * @property {URL} baseUrl
 * @property {string[]} pattern
 */

/** @type {Root[]} — `userConfig` is untyped (loaded dynamically), so annotate the
 *  resolved shape here; importers (nav, pages, remark) rely on this being typed. */
export const roots = (userConfig.roots ?? [{ label: "Docs", path: "docs" }]).map(normalizeRoot);

// Content i18n (multi-language docs). Optional, backward-compatible: no `i18n` block →
// one locale (the global `locale`), `enabled:false` → identical to a mono-language site.
//   locales       — content languages, e.g. ["en","fr"]; order = switcher order.
//   defaultLocale — the UNPREFIXED language (route /docs/…); others get /<locale>/….
//   strategy      — "directory" (docs/<loc>/…) | "suffix" (guide.md + guide.fr.md).
// The pure resolver lives in lib/i18n-content.mjs. The global `locale` stays the UI language
// for aggregate pages (/comments, /journal, home); per-doc pages follow their own locale.
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

// Store (comments + journal), resolved to absolute. Default: docs/.notabene.
export const storeRel = (userConfig.store ?? "docs/.notabene").replace(/\\/g, "/").replace(/\/+$/, "");
export const storeAbs = path.resolve(REPO_ROOT, storeRel);

// Serializable roots for client scripts (no absolute paths / node:* leak).
export const clientRoots = roots.map((r) => ({
  key: r.key,
  label: r.label,
  path: r.path,
}));

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
  pdf,
  i18n,
  clientI18n,
  roots,
  storeRel,
  storeAbs,
  clientRoots,
  routeForPage,
};
