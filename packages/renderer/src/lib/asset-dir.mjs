// Consumer asset DIRECTORY (config `theme.assets`) — the plumbing that makes a
// consumer stylesheet self-contained: `@font-face { src: url(…woff2) }` and
// `background-image` need real files, and Astro's `publicDir` lives inside the
// installed package (run-from-package), where a consumer can't put anything.
//
// This is the first surface that serves a FOLDER of the consumer repo instead of a
// handful of named files, so the guard — not the route — is the load-bearing piece:
//   · mount point is FIXED (`/_nb/assets/<path inside the folder>`), so the repo's
//     layout never leaks into URLs;
//   · every path is confined to the declared folder (and thus to the repo);
//   · an EXTENSION ALLOW-LIST — fonts, images, css. Never `.env`, `.md`, `.mjs`:
//     a mis-pointed `assets: "docs"` must not turn the docs into a download.
// Same spirit as store-path.ts: pure, no fs, unit-tested. Symlink resolution
// (realpath) is the caller's job — it needs fs — and re-uses `contains` here.
import path from "node:path";

/** What a consumer asset folder may expose. Fonts, images, stylesheets — nothing executable. */
export const ASSET_EXTENSIONS = [
  "woff2",
  "woff",
  "ttf",
  "otf",
  "eot",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "ico",
  "css",
];

/** Is `abs` inside `base` (or base itself)? Path-level containment, no fs. */
export function contains(base, abs) {
  const b = path.resolve(base);
  const a = path.resolve(abs);
  return a === b || a.startsWith(b + path.sep);
}

/**
 * Is this folder-relative path servable? Rejects absolute paths, `..`, any
 * dot-segment (dotfiles are configuration, not assets) and every extension outside
 * the allow-list. Returns a boolean — enumeration filters silently, single-path
 * resolution throws (see resolveAsset).
 */
export function isAllowedAsset(rel) {
  if (typeof rel !== "string" || rel === "") return false;
  const norm = rel.replace(/\\/g, "/");
  if (norm.startsWith("/")) return false;
  const segments = norm.split("/");
  if (segments.some((s) => s === "" || s.startsWith("."))) return false;
  const ext = /\.([A-Za-z0-9]+)$/.exec(norm)?.[1]?.toLowerCase();
  return ext != null && ASSET_EXTENSIONS.includes(ext);
}

/** Public URL of an asset — FIXED mount point, base applied by the caller (withBase). */
export function assetRoute(rel) {
  return `/_nb/assets/${rel.replace(/\\/g, "/")}`;
}

/** Folder-relative path → absolute file path, or throw. Both guards apply: the
 *  allow-list AND containment (belt and suspenders, like resolveStorePath). */
export function resolveAsset(dirAbs, rel) {
  if (!isAllowedAsset(rel)) {
    throw new Error(`notabene: refusing asset "${rel}" (allowed extensions: ${ASSET_EXTENSIONS.join(", ")}).`);
  }
  const abs = path.resolve(dirAbs, rel);
  if (!contains(dirAbs, abs)) {
    throw new Error(`notabene: refusing asset path outside the assets folder: ${rel}`);
  }
  return abs;
}
