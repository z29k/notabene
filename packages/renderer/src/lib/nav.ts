import { getCollection } from "astro:content";
import { i18n, locale } from "../config.mjs";
import { t } from "../i18n.mjs";
import { decode, routeFor } from "./i18n-content.mjs";

// A space = the `key` of a notabene.config root (no fixed duo). Free string.
export type Space = string;

export interface NavLeaf {
  type: "leaf";
  title: string;
  href: string;
  segment: string;
  /** Canonical (locale-stripped) entry id — lets consumers (e.g. print-scope) avoid
   *  re-parsing it out of the now-locale-prefixed href. */
  id: string;
  /** Explicit sidebar position from frontmatter `sidebar.order`; unset → sorts by label. */
  order?: number;
}

export interface NavGroup {
  type: "group";
  label: string;
  segment: string;
  prefix: string;
  children: NavNode[];
  /** Explicit position from the folder's index/readme `sidebar.order`; unset → by label. */
  order?: number;
}

export type NavNode = NavLeaf | NavGroup;

// Words to uppercase (acronyms), and small words kept lowercase. The small-word
// set is intentionally EN + FR so path segments in either language title-case well.
const ACRONYMS = new Set([
  "api",
  "iam",
  "dns",
  "ip",
  "ips",
  "url",
  "ssl",
  "tls",
  "ocr",
  "qr",
  "mac",
  "http",
  "https",
  "sse",
  "ws",
  "id",
  "ttl",
  "ssrf",
  "mx",
  "smtp",
  "dnsbl",
  "dbl",
  "dnswl",
  "fcrdns",
  "csv",
  "pdf",
  "svg",
  "png",
  "json",
  "mdx",
  "wasm",
  "cli",
  "vnc",
  "ha",
  "db",
  "s3",
  "ui",
  "ux",
  "seo",
  "jwt",
  "mfa",
  "totp",
  "rgpd",
  "gdpr",
  "ai",
  "llm",
  "waf",
  "ecs",
  "doh",
  "do53",
  "svcb",
  "irn",
  "cmdb",
  "xls",
]);
const SMALL_WORDS = new Set([
  "and",
  "or",
  "of",
  "the",
  "a",
  "an",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "à",
  "pour",
  "par",
  "sur",
  "in",
]);

export function humanize(seg: string): string {
  const words = seg
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // split camelCase (e.g. ipAddress)
    .split(/[-_\s]+/)
    .filter(Boolean);
  return words
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (ACRONYMS.has(lw)) return lw.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(lw)) return lw;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * SHORT nav label = humanized file name. The H1 (often verbose, written for
 * standalone reading) is used for the page title, not the sidebar.
 */
export function navLabel(id: string): string {
  const seg = id.split("/").pop() ?? id;
  if (/^(readme|index)$/i.test(seg)) return "Overview";
  return humanize(seg);
}

/** Loose frontmatter — the glob loader parses it with no schema, so a consumer's arbitrary
 *  YAML flows through untouched; we read only the keys we own and coerce defensively. */
export type FrontMatter = Record<string, unknown> | undefined;

/** `sidebar: { label?, order?, indexLabel? }` — the per-page nav override. A non-string
 *  label/indexLabel or a non-numeric order is ignored (a generic renderer must never choke
 *  on a repo's YAML). `indexLabel` overrides a folder's landing-page leaf (default: the
 *  localized "Overview"); `label`/`order` on a landing page apply to the whole GROUP. */
function sidebarMeta(data: FrontMatter): { label?: string; order?: number; indexLabel?: string } {
  const s = (data as { sidebar?: unknown } | undefined)?.sidebar;
  if (typeof s !== "object" || s === null) return {};
  const rec = s as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const n = typeof rec.order === "number" ? rec.order : typeof rec.order === "string" ? Number(rec.order) : Number.NaN;
  return { label: str(rec.label), indexLabel: str(rec.indexLabel), order: Number.isFinite(n) ? n : undefined };
}

/** `title:` — overrides the H1 for the page title and is a sidebar-label fallback. */
function frontMatterTitle(data: FrontMatter): string | undefined {
  const t = (data as { title?: unknown } | undefined)?.title;
  return typeof t === "string" && t.trim() ? t.trim() : undefined;
}

/** Sidebar label for a PAGE leaf: `sidebar.label` → `title` → humanized file name.
 *  (A readme/index leaf keeps "Overview"; a folder's frontmatter names the GROUP instead —
 *  see resolveGroupLabel.) */
export function resolveNavLabel(id: string, data?: FrontMatter): string {
  return sidebarMeta(data).label ?? frontMatterTitle(data) ?? navLabel(id);
}

/** Label lifted onto a GROUP from its folder's index/readme frontmatter:
 *  `sidebar.label` → `title` → undefined (keep the humanized folder segment). */
export function resolveGroupLabel(data?: FrontMatter): string | undefined {
  return sidebarMeta(data).label ?? frontMatterTitle(data);
}

/** Page title = frontmatter `title` → first H1 (descriptive) → the nav label. */
export function pageTitle(body: string | undefined, id: string, data?: FrontMatter): string {
  const t = frontMatterTitle(data);
  if (t) return t;
  const m = body?.match(/^#\s+(.+?)\s*$/m);
  if (m) return m[1].replace(/[*_`]/g, "").trim();
  return navLabel(id);
}

// Collections are declared dynamically (name = space key, cf. content.config.ts), so
// `getCollection` can't be statically typed here — assert the minimal entry shape we use.
type Entry = { id: string; body?: string; data?: FrontMatter };
async function entriesOf(space: Space): Promise<Entry[]> {
  return getCollection(space as never) as unknown as Promise<Entry[]>;
}

/** `folderPath → display label` for a space, taken from each folder's landing page
 *  frontmatter (`<folder>/index.md` → id `<folder>`, or `<folder>/readme.md`); folders with
 *  no label are absent. Lets breadcrumbs and PDF covers show the same folder name as the
 *  sidebar. Locale-filtered exactly like buildNav. */
export async function folderLabels(space: Space, locale?: string): Promise<Map<string, string>> {
  const canon: { id: string; data: FrontMatter }[] = [];
  for (const entry of await entriesOf(space)) {
    let id = entry.id;
    if (locale !== undefined) {
      const d = decode(entry.id, i18n);
      if (d.locale !== locale) continue;
      id = d.id;
    }
    canon.push({ id, data: entry.data });
  }
  const isFolder = (id: string) => canon.some((c) => c.id.startsWith(`${id}/`));
  const out = new Map<string, string>();
  for (const { id, data } of canon) {
    const label = resolveGroupLabel(data);
    if (!label) continue;
    const parts = id.split("/");
    if (isFolder(id))
      out.set(id, label); // <folder>/index.md → id is the folder path
    else if (parts.length > 1 && /^(readme|index)$/i.test(parts[parts.length - 1]))
      out.set(parts.slice(0, -1).join("/"), label);
  }
  return out;
}

/** One nav entry, already resolved to a CANONICAL (locale-stripped) id + final href. */
export type NavSource = { id: string; href: string; data?: FrontMatter };

/** Lift a folder landing page's frontmatter (label + order) onto its group. */
function liftGroup(group: NavGroup, data: FrontMatter): void {
  const label = resolveGroupLabel(data);
  if (label) group.label = label;
  const order = sidebarMeta(data).order;
  if (order !== undefined) group.order = order;
}

/**
 * Pure tree assembler: canonical ids → a sorted NavNode tree. Split out of buildNav so the
 * label / order / group-lifting rules are unit-testable without the astro:content layer.
 * `space` only feeds the (informational) group `prefix`; `collation` sorts labels.
 *
 * Astro collapses `<folder>/index.md` to the id `<folder>` and keeps `<folder>/readme.md`
 * as `<folder>/readme` — both are the folder's LANDING page: they name + order the GROUP
 * (via frontmatter) and become its landing child, never a duplicate sibling leaf. That
 * child is labeled `overviewLabel` (localized "Overview", passed by buildNav) unless the
 * page sets `sidebar.indexLabel`.
 */
export function assembleNav(
  sources: NavSource[],
  space: Space,
  collation: string = locale,
  overviewLabel = "Overview",
): NavNode[] {
  const rootChildren: NavNode[] = [];
  // An id is a "folder" when some other id is nested beneath it (`<id>/…`).
  const isFolder = (id: string): boolean => sources.some((s) => s.id.startsWith(`${id}/`));

  // Find-or-create the group at a segment path, materializing every ancestor group.
  const groupAt = (segs: string[]): NavGroup => {
    let children = rootChildren;
    let group!: NavGroup;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      let g = children.find((c): c is NavGroup => c.type === "group" && c.segment === seg);
      if (!g) {
        g = {
          type: "group",
          label: humanize(seg),
          segment: seg,
          prefix: `/${space}/${segs.slice(0, i + 1).join("/")}`,
          children: [],
        };
        children.push(g);
      }
      group = g;
      children = g.children;
    }
    return group;
  };

  for (const { id, href, data } of sources) {
    // ROOT README/index (canonical) = the space home page, not a nav leaf.
    if (/^(readme|index)$/i.test(id)) continue;
    const parts = id.split("/");
    const seg = parts[parts.length - 1];

    if (isFolder(id)) {
      // `<folder>/index.md` → id is the folder path itself: configure its own group.
      const group = groupAt(parts);
      liftGroup(group, data);
      group.children.push({
        type: "leaf",
        title: sidebarMeta(data).indexLabel ?? overviewLabel,
        href,
        segment: "index",
        id,
      });
    } else if (parts.length > 1 && /^(readme|index)$/i.test(seg)) {
      // `<folder>/readme.md` → the landing page of its PARENT group.
      const group = groupAt(parts.slice(0, -1));
      liftGroup(group, data);
      group.children.push({
        type: "leaf",
        title: sidebarMeta(data).indexLabel ?? overviewLabel,
        href,
        segment: seg,
        id,
      });
    } else {
      // Regular page → a leaf under its parent group (or the root).
      const children = parts.length > 1 ? groupAt(parts.slice(0, -1)).children : rootChildren;
      children.push({
        type: "leaf",
        title: resolveNavLabel(id, data),
        href,
        segment: seg,
        id,
        order: sidebarMeta(data).order,
      });
    }
  }

  sortNodes(rootChildren, collation);
  return rootChildren;
}

/**
 * Builds a space's navigation tree from the slash-separated ids. When `locale` is given
 * (i18n), only that locale's entries are kept, the tree is built on CANONICAL ids, and
 * hrefs are clean prefixed routes. Omitting `locale` = the pre-i18n behavior (all entries,
 * raw ids) — used where the tree spans locales (e.g. the print route in an early phase).
 */
export async function buildNav(space: Space, locale?: string): Promise<NavNode[]> {
  const sources: NavSource[] = [];
  for (const entry of await entriesOf(space)) {
    // Canonical id + href depend on whether we filter by locale.
    let id = entry.id;
    let href = `/${space}/${entry.id}`;
    if (locale !== undefined) {
      const d = decode(entry.id, i18n);
      if (d.locale !== locale) continue;
      id = d.id;
      href = routeFor({ space, id, locale }, i18n);
    }
    sources.push({ id, href, data: entry.data });
  }
  // The folder landing leaf's default label follows the rendered locale ("Overview"/"Aperçu"/…).
  return assembleNav(sources, space, locale, t(locale).navOverview);
}

/** Effective sort position. Explicit frontmatter `order` wins; otherwise a readme/index
 *  leaf stays first (−∞) and unordered nodes sort last (+∞) — i.e. alphabetically among
 *  themselves, the pre-frontmatter behavior. Groups and pages share one ordering, so a
 *  numbered folder slots into the numbered page sequence without a filename prefix. */
function orderKey(node: NavNode): number {
  if (typeof node.order === "number") return node.order;
  if (node.type === "leaf" && /^(readme|index)$/i.test(node.segment)) return Number.NEGATIVE_INFINITY;
  return Number.POSITIVE_INFINITY;
}

function sortNodes(nodes: NavNode[], collation: string = locale): void {
  nodes.sort((a, b) => {
    const oa = orderKey(a);
    const ob = orderKey(b);
    if (oa !== ob) return oa < ob ? -1 : 1; // NaN-safe (avoids ∞−∞); ties → alphabetical
    const an = a.type === "group" ? a.label : a.title;
    const bn = b.type === "group" ? b.label : b.title;
    return an.localeCompare(bn, collation);
  });
  for (const n of nodes) if (n.type === "group") sortNodes(n.children, collation);
}
