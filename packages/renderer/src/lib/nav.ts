import { getCollection } from "astro:content";
import { i18n, locale } from "../config.mjs";
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
}

export interface NavGroup {
  type: "group";
  label: string;
  segment: string;
  prefix: string;
  children: NavNode[];
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

/** Page title = first H1 (descriptive), else the nav label. */
export function pageTitle(body: string | undefined, id: string): string {
  const m = body?.match(/^#\s+(.+?)\s*$/m);
  if (m) return m[1].replace(/[*_`]/g, "").trim();
  return navLabel(id);
}

// Collections are declared dynamically (name = space key, cf. content.config.ts), so
// `getCollection` can't be statically typed here — assert the minimal entry shape we use.
type Entry = { id: string; body?: string };
async function entriesOf(space: Space): Promise<Entry[]> {
  return getCollection(space as never) as unknown as Promise<Entry[]>;
}

/**
 * Builds a space's navigation tree from the slash-separated ids. When `locale` is given
 * (i18n), only that locale's entries are kept, the tree is built on CANONICAL ids, and
 * hrefs are clean prefixed routes. Omitting `locale` = the pre-i18n behavior (all entries,
 * raw ids) — used where the tree spans locales (e.g. the print route in an early phase).
 */
export async function buildNav(space: Space, locale?: string): Promise<NavNode[]> {
  const entries = await entriesOf(space);
  const rootChildren: NavNode[] = [];

  for (const entry of entries) {
    // Canonical id + href depend on whether we filter by locale.
    let id = entry.id;
    let href = `/${space}/${entry.id}`;
    if (locale !== undefined) {
      const d = decode(entry.id, i18n);
      if (d.locale !== locale) continue;
      id = d.id;
      href = routeFor({ space, id, locale }, i18n);
    }
    // ROOT README/index (canonical) = the space home page, not a nav leaf.
    if (/^(readme|index)$/i.test(id)) continue;
    const parts = id.split("/");
    let children = rootChildren;

    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      let group = children.find((c): c is NavGroup => c.type === "group" && c.segment === seg);
      if (!group) {
        group = {
          type: "group",
          label: humanize(seg),
          segment: seg,
          prefix: `/${space}/${parts.slice(0, i + 1).join("/")}`,
          children: [],
        };
        children.push(group);
      }
      children = group.children;
    }

    children.push({ type: "leaf", title: navLabel(id), href, segment: parts[parts.length - 1], id });
  }

  sortNodes(rootChildren, locale);
  return rootChildren;
}

function rank(node: NavNode): number {
  // README / index first; groups and pages sort TOGETHER by label so a numbered
  // folder (e.g. 09-cartographie/) slots into the numbered sequence of pages.
  if (node.type === "leaf" && /^(readme|index)$/i.test(node.segment)) return 0;
  return 1;
}

function sortNodes(nodes: NavNode[], collation: string = locale): void {
  nodes.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const an = a.type === "group" ? a.label : a.title;
    const bn = b.type === "group" ? b.label : b.title;
    return an.localeCompare(bn, collation);
  });
  for (const n of nodes) if (n.type === "group") sortNodes(n.children, collation);
}
