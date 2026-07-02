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
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REPO_ROOT = process.env.NOTABENE_ROOT ? path.resolve(process.env.NOTABENE_ROOT) : process.cwd();

const CONFIG_PATH = process.env.NOTABENE_CONFIG
  ? path.resolve(process.env.NOTABENE_CONFIG)
  : path.resolve(REPO_ROOT, "notabene.config.mjs");

// Top-level await: load the consumer's config by absolute path. Astro loads this
// module (via astro.config.mjs / content.config.ts) as ESM, which supports TLA.
let userConfig;
try {
  userConfig = (await import(/* @vite-ignore */ pathToFileURL(CONFIG_PATH).href)).default ?? {};
} catch (err) {
  throw new Error(
    `notabene: could not load config at ${CONFIG_PATH}. Run \`notabene init\` first, ` +
      `or set NOTABENE_CONFIG. (${err instanceof Error ? err.message : err})`,
  );
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
const FORMAT = String(userConfig.format ?? "mdx").toLowerCase();
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
 * Logical `page` path (e.g. "docs/plans/services/x") → site route
 * (e.g. "/workbench/services/x"). Most specific root (longest path) first — a
 * nested space (docs/plans) must win over its parent (docs).
 */
export function routeForPage(page) {
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);
  for (const r of ordered) {
    if (page === r.path) return `/${r.key}`;
    if (page.startsWith(`${r.path}/`)) return `/${r.key}/${page.slice(r.path.length + 1)}`;
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
  roots,
  storeRel,
  storeAbs,
  clientRoots,
  routeForPage,
};
