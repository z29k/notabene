import { getCollection } from "astro:content";
import { locale } from "../config.mjs";

// A space = the `key` of a notabene.config root (no fixed duo). Free string.
export type Space = string;

export interface NavLeaf {
  type: "leaf";
  title: string;
  href: string;
  segment: string;
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
  "api", "iam", "dns", "ip", "ips", "url", "ssl", "tls", "ocr", "qr", "mac", "http",
  "https", "sse", "ws", "id", "ttl", "ssrf", "mx", "smtp", "dnsbl", "dbl", "dnswl",
  "fcrdns", "csv", "pdf", "svg", "png", "json", "mdx", "wasm", "cli", "vnc", "ha",
  "db", "s3", "ui", "ux", "seo", "jwt", "mfa", "totp", "rgpd", "gdpr", "ai", "llm",
  "waf", "ecs", "doh", "do53", "svcb",
]);
const SMALL_WORDS = new Set([
  "and", "or", "of", "the", "a", "an", "de", "du", "des", "la", "le", "les", "et",
  "à", "pour", "par", "sur", "in",
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

async function entriesOf(space: Space) {
  // Collection name = the space key (cf. content.config.ts). Dynamic.
  return getCollection(space as never);
}

/** Builds a space's navigation tree from the slash-separated ids. */
export async function buildNav(space: Space): Promise<NavNode[]> {
  const entries = await entriesOf(space);
  const rootChildren: NavNode[] = [];

  for (const entry of entries) {
    // ROOT README/index = the space home page, not a nav leaf.
    if (/^(readme|index)$/i.test(entry.id)) continue;
    const parts = entry.id.split("/");
    let children = rootChildren;

    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      let group = children.find(
        (c): c is NavGroup => c.type === "group" && c.segment === seg,
      );
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

    children.push({
      type: "leaf",
      title: navLabel(entry.id),
      href: `/${space}/${entry.id}`,
      segment: parts[parts.length - 1],
    });
  }

  sortNodes(rootChildren);
  return rootChildren;
}

function rank(node: NavNode): number {
  // README / index first, then groups, then other pages.
  if (node.type === "leaf" && /^(readme|index)$/i.test(node.segment)) return 0;
  if (node.type === "group") return 1;
  return 2;
}

function sortNodes(nodes: NavNode[]): void {
  nodes.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const an = a.type === "group" ? a.label : a.title;
    const bn = b.type === "group" ? b.label : b.title;
    return an.localeCompare(bn, locale);
  });
  for (const n of nodes) if (n.type === "group") sortNodes(n.children);
}
