import fs from "node:fs";
import path from "node:path";
import { slug as githubSlug } from "github-slugger";
import { decode, routeFor } from "../lib/i18n-content.mjs";

// Rewrites RELATIVE links to .md/.mdx files (between docs) into site routes.
// Without this, inter-doc links (`[x](../foo.md)`) point at files and 404 in the site.
//
//   <root.path>/**  → /<root.key>/<slug>   (or, with i18n, a clean prefixed locale route)
//
// Generic: the mapping comes from notabene.config `roots[]` (cf. src/config.mjs), no
// hardcoded paths. External links (http…, mailto), absolute (/…), anchors (#…) and non-.md
// targets are left intact. .md targets OUTSIDE the declared spaces are left as-is.
//
// i18n: the target's absolute path decodes to (locale, canonical id) → a clean prefixed
// route. In SUFFIX mode a relative link resolves to the CANONICAL file (e.g. `./b.md` from
// `a.fr.md` → `b.md`); when the source is non-default-locale we prefer the same-locale
// sibling `b.<loc>.<ext>` if it exists, else fall back to the default route.

const MD = ["md", "mdx", "markdown"];

function slug(rel) {
  return rel.replace(/\\/g, "/").replace(/\.(mdx?|markdown)$/i, "");
}

function visit(node, fn) {
  fn(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, fn);
  }
}

/**
 * The file→route mapping, shared by the remark plugin below and `notabene lint`
 * (bin — this module is raw-Node importable on purpose: only node:fs/path,
 * i18n-content.mjs and github-slugger, a dependency-free ESM package).
 * Returns `{ rootOf, localeOfFile, toRoute }`:
 *   toRoute(absFilePath, srcLocale) → base-less site route, or null when the file
 *   is outside every declared root.
 * @param {{ roots: { key: string, abs: string }[], i18n: { locales: string[], defaultLocale: string, strategy: string, enabled: boolean } }} opts
 */
export function makeLinkMapper({ roots, i18n }) {
  // Most specific root (longest absolute path) first: a nested space (docs/plans) must win.
  const ordered = [...roots].sort((a, b) => b.abs.length - a.abs.length);

  const rootOf = (abs) => ordered.find((r) => abs === r.abs || abs.startsWith(r.abs + path.sep));
  const localeOfFile = (abs) => {
    const r = rootOf(abs);
    return r ? decode(slug(path.relative(r.abs, abs)), i18n).locale : i18n.defaultLocale;
  };

  function toRoute(abs, srcLocale) {
    const r = rootOf(abs);
    if (!r) return null;
    const rawRel = slug(path.relative(r.abs, abs));
    let { locale, id } = decode(rawRel, i18n);
    // Mirror the ACTUAL id convention of the content loader, or links land on routes
    // that were never emitted. Astro's DEFAULT generateId (`generateIdDefault` →
    // `getContentEntryIdAndSlug`) runs EVERY path segment through github-slugger and
    // then collapses a FOLDER's index ("publish/index" → "publish"):
    //
    //     rawSlugSegments.map(githubSlug).join("/").replace(/\/index$/, "")
    //
    // Slugging is what lowercases: `api/README.md` is served at `/<space>/api/readme`.
    // Rewriting the link without it produced `/<space>/api/README` — a 404 that the
    // sidebar (built from the route table, already slugged) never showed, so it only
    // surfaced on inline links. Same slugger instance as Astro's, on purpose: a
    // hand-rolled copy would drift.
    //
    // Suffix i18n swaps in makeSuffixGenerateId, which keeps ids VERBATIM (slugging
    // would eat the ".<loc>" marker) — so this must follow the same switch as
    // content.config.ts. A root-level "index" keeps its id in both conventions.
    if (!(i18n.enabled && i18n.strategy === "suffix")) {
      id = id
        .split("/")
        .map((segment) => githubSlug(segment))
        .join("/")
        .replace(/\/index$/, "");
    }
    // Suffix mode: a canonical target reached from a non-default-locale source → prefer the
    // same-locale sibling when it exists.
    if (
      i18n.enabled &&
      i18n.strategy === "suffix" &&
      srcLocale &&
      srcLocale !== i18n.defaultLocale &&
      locale === i18n.defaultLocale
    ) {
      if (MD.some((ext) => fs.existsSync(path.join(r.abs, `${id}.${srcLocale}.${ext}`)))) locale = srcLocale;
    }
    return routeFor({ space: r.key, id, locale }, i18n);
  }

  return { rootOf, localeOfFile, toRoute };
}

/**
 * `base` (optional, default "/"): sub-path prefix applied to every rewritten route —
 * public builds served under a prefix (GitHub Pages project site). Passed explicitly
 * because remark runs outside Vite: `import.meta.env.BASE_URL` (lib/base) is not
 * available here.
 * @param {{ roots: { key: string, abs: string }[], i18n: { locales: string[], defaultLocale: string, strategy: string, enabled: boolean }, base?: string }} opts
 */
export function remarkRewriteLinks({ roots, i18n, base = "/" }) {
  const prefix = base === "/" ? "" : base.replace(/\/+$/, "");
  const { localeOfFile, toRoute } = makeLinkMapper({ roots, i18n });

  return (tree, file) => {
    const from = file?.path ?? file?.history?.[0];
    if (!from) return;
    const fromDir = path.dirname(from);
    const srcLocale = i18n.enabled ? localeOfFile(from) : i18n.defaultLocale;

    visit(tree, (node) => {
      if (node.type !== "link" && node.type !== "definition") return;
      const url = node.url;
      if (typeof url !== "string") return;
      if (/^[a-z]+:/i.test(url) || url.startsWith("/") || url.startsWith("#")) return;

      const hashIdx = url.indexOf("#");
      const target = hashIdx === -1 ? url : url.slice(0, hashIdx);
      const hash = hashIdx === -1 ? "" : url.slice(hashIdx);
      if (!/\.(mdx?|markdown)$/i.test(target)) return;

      const abs = path.resolve(fromDir, target);
      const route = toRoute(abs, srcLocale);
      if (route) node.url = prefix + route + hash;
    });
  };
}
