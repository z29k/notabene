// Pure logic for the PDF export routes (`/print/…`). No astro:content / config
// imports → unit-testable in isolation (see test/print-scope.test.ts). The route
// (src/pages/print/[...scope].astro) wires these against the live collections + nav.
//
// A "scope" is the export unit the user picked in the Export menu:
//   doc                       — the whole documentation (every space)
//   space/<key>               — one space (a notabene.config root)
//   folder/<key>/<path…>      — one folder / nav subtree inside a space
//   page/<key>/<id…>          — a single page
// It is carried by the `[...scope]` rest param of the print route.
import type { NavGroup, NavNode } from "./nav";

export type PrintScope =
  | { kind: "doc"; locale?: string }
  | { kind: "space"; space: string; locale?: string }
  | { kind: "folder"; space: string; path: string; locale?: string }
  | { kind: "page"; space: string; id: string; locale?: string };

/** Parse the `[...scope]` rest param (undefined = the whole doc). An OPTIONAL leading
 *  locale token (∈ `locales`) scopes doc/space/folder to one language; page scopes encode
 *  the locale in their raw id. Returns null when the shape is invalid (route → 404). */
export function parseScope(scope: string | undefined, locales: string[] = []): PrintScope | null {
  if (!scope) return { kind: "doc" };
  const parts = scope.split("/").filter(Boolean);
  let locale: string | undefined;
  if (parts.length && locales.includes(parts[0])) locale = parts.shift();
  if (!parts.length) return { kind: "doc", locale }; // just a locale token → whole doc in it
  const [disc, space, ...rest] = parts;
  if (!space) return null;
  if (disc === "space" && rest.length === 0) return { kind: "space", space, locale };
  if (disc === "folder" && rest.length > 0) return { kind: "folder", space, path: rest.join("/"), locale };
  if (disc === "page" && rest.length > 0) return { kind: "page", space, id: rest.join("/"), locale };
  return null;
}

/** The `[...scope]` param string for a scope (undefined → the base `/print`). */
export function scopeParam(s: PrintScope): string | undefined {
  const loc = s.locale ? `${s.locale}/` : "";
  switch (s.kind) {
    case "doc":
      return s.locale || undefined;
    case "space":
      return `${loc}space/${s.space}`;
    case "folder":
      return `${loc}folder/${s.space}/${s.path}`;
    case "page":
      return `${loc}page/${s.space}/${s.id}`;
  }
}

/** The site URL for a scope (used by the Export menu links). */
export function scopeToPath(s: PrintScope): string {
  const p = scopeParam(s);
  return p ? `/print/${p}` : "/print";
}

/** Stable, collision-free anchor id for a page's section in a concatenated document.
 *  Space keys are unique and ids are unique within a space → unique across the doc. */
export function sectionId(space: string, id: string): string {
  return `pg-${slug(space)}-${slug(id)}`;
}

function slug(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Every ancestor folder path present in a set of entry ids (for getStaticPaths).
 *  "guide/advanced/x" → "guide", "guide/advanced". Sorted, de-duplicated. */
export function folderPrefixes(ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const parts = id.split("/");
    for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("/"));
  }
  return [...set].sort();
}

/** Descend a space's nav tree to the subtree rooted at a folder path
 *  (e.g. "guide/advanced"). Returns the group's children, or null if absent. */
export function findSubtree(nodes: NavNode[], path: string): NavNode[] | null {
  const segs = path.split("/").filter(Boolean);
  let current = nodes;
  let group: NavGroup | null = null;
  for (const seg of segs) {
    group = current.find((n): n is NavGroup => n.type === "group" && n.segment === seg) ?? null;
    if (!group) return null;
    current = group.children;
  }
  return group ? group.children : null;
}

export interface PrintGroupItem {
  type: "group";
  label: string;
  depth: number;
}
export interface PrintLeafItem {
  type: "leaf";
  space: string;
  id: string;
  title: string;
  depth: number;
  anchorId: string;
}
export type PrintItem = PrintGroupItem | PrintLeafItem;

/** Flatten a nav tree (from buildNav) into an ordered list of print items — group
 *  headers and page leaves, depth-first, in nav order. The leaf `id` is recovered
 *  from `href` = `/<space>/<id>`. This drives both the concatenated body and the TOC. */
export function flattenNav(space: string, nodes: NavNode[], depth = 1): PrintItem[] {
  const out: PrintItem[] = [];
  for (const node of nodes) {
    if (node.type === "group") {
      out.push({ type: "group", label: node.label, depth });
      out.push(...flattenNav(space, node.children, depth + 1));
    } else {
      // node.id is the canonical entry id (set by buildNav) — no href re-parsing needed.
      out.push({ type: "leaf", space, id: node.id, title: node.title, depth, anchorId: sectionId(space, node.id) });
    }
  }
  return out;
}
