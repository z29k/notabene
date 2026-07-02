// Pure store-path resolution (no config, no store I/O) — kept separate so the
// anti-traversal guard is unit-testable without loading the consumer config.
import path from "node:path";

/**
 * Sanitize a logical `page` path and resolve it to an absolute `<root>/<page>.json`,
 * refusing anything that escapes the store. Belt-and-suspenders anti-traversal: the
 * regex strips `..` and leading slashes, then `path.resolve` + a `startsWith` check
 * guarantees containment under `root`.
 */
export function resolveStorePath(root: string, page: string): string {
  const safe = page.replace(/\\/g, "/").replace(/\.\.+/g, "").replace(/^\/+/, "");
  const base = path.resolve(root);
  const abs = path.resolve(base, `${safe}.json`);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error(`notabene: refusing page path outside the store: ${page}`);
  }
  return abs;
}
