// Pure helpers for the DEV full-text search middleware (integrations/dev-search.mjs):
// bundle-file resolution (traversal-guarded) + content types for the Pagefind bundle.
// `.mjs` and dependency-free so the integration (and unit tests) load them directly.
import path from "node:path";

/** Content-Type for a Pagefind bundle file (engine JS/CSS, entry JSON, wasm, chunks). */
export function searchContentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".wasm") return "application/wasm";
  // .pagefind / .pf_meta / .pf_index / .pf_fragment — binary index chunks.
  return "application/octet-stream";
}

/** Resolve a bundle-relative URL sub-path to a file INSIDE `bundleDir`, or null.
 *  Rejects empty paths, escapes (`..`), absolute paths and URL-encoded tricks. */
export function resolveBundlePath(bundleDir, sub) {
  let decoded;
  try {
    decoded = decodeURIComponent(sub);
  } catch {
    return null;
  }
  if (!decoded || decoded.includes("\0")) return null;
  const root = path.resolve(bundleDir);
  const resolved = path.resolve(root, decoded);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}
