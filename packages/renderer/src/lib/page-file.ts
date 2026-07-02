// Resolve a logical `page` path (as stored on comments/journal, e.g.
// "docs/guide/nested") to its absolute source file on disk. There is no such resolver
// elsewhere — nav.ts only has a readme/index regex for labels. Because the content
// loader strips "index" from ids, a page maps to EITHER "<rel>.{md,mdx}" OR
// "<rel>/index.{md,mdx}"; a space root ("docs") maps to "<root>/index.{md,mdx}".
// Server-only (fs/path). The core is pure (roots/exts/exists injected) so it's testable
// without the config or the filesystem.
import fs from "node:fs";
import path from "node:path";
import { extensions, roots } from "../config.mjs";

/**
 * @param page logical page path (comment `page` field)
 * @param roots normalized spaces: `{ path (repo-relative), abs (absolute) }`
 * @param extensions file extensions to try, in order (e.g. ["md","mdx"])
 * @param exists existence predicate (injected for tests; defaults to fs)
 * @returns absolute file path, or null if none exists / the page escapes every root
 */
export function resolvePageFile(
  page: string,
  roots: { path: string; abs: string }[],
  extensions: string[],
  exists: (p: string) => boolean = fs.existsSync,
): string | null {
  const safe = page.replace(/\\/g, "/").replace(/\.\.+/g, "").replace(/^\/+/, "");
  // Most specific root first: a nested space (docs/plans) must win over its parent.
  const ordered = [...roots].sort((a, b) => b.path.length - a.path.length);

  for (const r of ordered) {
    let rel: string | null = null;
    if (safe === r.path) rel = "";
    else if (safe.startsWith(`${r.path}/`)) rel = safe.slice(r.path.length + 1);
    if (rel === null) continue;

    // Try the direct file first, then the index form.
    const direct: string[] = [];
    const indexed: string[] = [];
    for (const ext of extensions) {
      if (rel) {
        direct.push(`${rel}.${ext}`);
        indexed.push(`${rel}/index.${ext}`);
      } else {
        indexed.push(`index.${ext}`);
      }
    }
    const base = path.resolve(r.abs);
    for (const cand of [...direct, ...indexed]) {
      const abs = path.resolve(base, cand);
      // Containment: never resolve outside the declared root.
      if (abs !== base && !abs.startsWith(base + path.sep)) continue;
      if (exists(abs)) return abs;
    }
  }
  return null;
}

/** Config-backed convenience: resolve against the consumer's roots + format extensions. */
export function pageFile(page: string): string | null {
  return resolvePageFile(page, roots, extensions);
}
