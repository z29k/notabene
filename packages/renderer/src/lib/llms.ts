// Agent-web surface renderers (PUBLIC builds): /llms.txt (machine-readable index of
// the whole doc) and /llms-full.txt (the entire corpus as one Markdown document).
// Pure text assembly — no astro:content, no config, no fs — so it unit-tests like
// route/print-scope. The routes gather entries (nav order via buildNav+flattenNav,
// the same ordering the print/PDF export uses) and feed them here.
//
// Contract stamped into the outputs (mirrors what agents already expect from the
// llms.txt convention): a link ending in `/index.md` IS the page content (the
// Markdown twin); `llms-full.txt` is everything in one request. Outputs carry NO
// timestamps — a rebuild of unchanged docs is byte-identical.

export interface LlmsPage {
  title: string;
  /** Base-less site route of the rendered page (e.g. "/docs/guide/intro"). */
  route: string;
}

export interface LlmsSpace {
  label: string;
  pages: LlmsPage[];
}

export interface LlmsCorpusPage extends LlmsPage {
  /** Raw Markdown source (frontmatter already stripped by the content loader). */
  body: string;
}

/** Route of a page's Markdown twin (see pages/[...path]/index.md.ts). */
export function twinPath(route: string): string {
  return route === "/" ? "/index.md" : `${route}/index.md`;
}

/** Prepend `# title` when the body doesn't already open with an H1 (title came from
 *  frontmatter) — so a twin / corpus block always states its own title. */
export function ensureH1(body: string, title: string): string {
  const trimmed = body.replace(/^\s+/, "");
  return /^#\s/.test(trimmed) ? body : `# ${title}\n\n${body}`;
}

/** Header block of a Markdown twin: where the rendered page lives + where the index is. */
export function twinHeader(pageUrl: string, llmsUrl: string): string {
  return `> Rendered: ${pageUrl} · Docs index: ${llmsUrl}\n\n`;
}

export interface LlmsIndexOpts {
  siteName: string;
  tagline: string;
  /** Base-less path → absolute URL (site + base applied by the caller). */
  absolute: (path: string) => string;
  spaces: LlmsSpace[];
  /** Path of the matching llms-full.txt (base-less). */
  fullPath: string;
  /** Other locales' index files, when i18n is enabled (base-less paths). */
  otherLocales?: { locale: string; path: string }[];
}

/** The /llms.txt index: site header, corpus pointer, one section per space listing
 *  every page (nav order) as a link to its Markdown twin. */
export function renderLlmsIndex(opts: LlmsIndexOpts): string {
  const { siteName, tagline, absolute, spaces, fullPath, otherLocales = [] } = opts;
  const lines: string[] = [];
  lines.push(`# ${siteName}`);
  lines.push("");
  lines.push(`> ${tagline}. Links ending in /index.md are the page content (Markdown).`);
  lines.push("");
  lines.push(`Full corpus (all pages, one document): ${absolute(fullPath)}`);
  for (const o of otherLocales) {
    lines.push(`Index for locale "${o.locale}": ${absolute(o.path)}`);
  }
  for (const space of spaces) {
    lines.push("");
    lines.push(`## ${space.label}`);
    lines.push("");
    for (const p of space.pages) {
      lines.push(`- [${p.title}](${absolute(twinPath(p.route))}): rendered at ${absolute(p.route)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export interface LlmsFullOpts {
  siteName: string;
  tagline: string;
  absolute: (path: string) => string;
  /** Path of the matching llms.txt index (base-less). */
  indexPath: string;
  spaces: { label: string; pages: LlmsCorpusPage[] }[];
}

/** The /llms-full.txt corpus: every page's Markdown, nav order, each block opened by
 *  a horizontal rule + a Source line so page boundaries stay machine-splittable even
 *  when bodies contain their own H1s. */
export function renderLlmsFull(opts: LlmsFullOpts): string {
  const { siteName, tagline, absolute, indexPath, spaces } = opts;
  const parts: string[] = [];
  parts.push(`# ${siteName}\n\n> ${tagline}\n\nIndex: ${absolute(indexPath)}\n`);
  for (const space of spaces) {
    for (const p of space.pages) {
      parts.push(
        `\n---\n\nSource: ${absolute(p.route)} · Markdown: ${absolute(twinPath(p.route))}\n\n${ensureH1(p.body, p.title).trimEnd()}\n`,
      );
    }
  }
  return parts.join("");
}
