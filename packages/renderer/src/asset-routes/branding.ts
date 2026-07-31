import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { REPO_ROOT, branding, theme } from "../config.mjs";
import { assetRoute, contains, isAllowedAsset, resolveAsset } from "../lib/asset-dir.mjs";
import { assetExt, assetPath, contentTypeFor } from "../lib/asset-types";

// Consumer assets served at stable /_nb/… paths. The files live in the CONSUMER repo
// (outside the Astro root), so — like search-index.json — a prerendered endpoint reads
// the bytes: static files in builds, served on demand in dev. Two families:
//   · named branding/theme files (config `branding`, `theme.css`) → /_nb/<name>.<ext>;
//   · the optional asset FOLDER (config `theme.assets`) → /_nb/assets/<path in folder>.
// Nothing configured → no routes (getStaticPaths returns []), byte-identical default.
const NAMES: Record<string, string | null> = {
  logo: branding.logo,
  "logo-dark": branding.logoDark,
  favicon: branding.favicon,
  og: branding.socialImage,
  theme: theme.css,
};

/**
 * Every servable file of the asset folder, as `<route tail> → repo-relative path`.
 * Three filters, in this order: the extension allow-list + path shape
 * (`isAllowedAsset`), containment of the resolved path, and — because a symlink can
 * point anywhere — containment of its REALPATH in the folder's own realpath (the
 * folder itself was realpath-checked against the repo at config load). A file failing
 * any of them is skipped silently: enumeration must not turn a stray symlink into a
 * build error, and not serving it is the whole point.
 */
function folderAssets(): { tail: string; file: string }[] {
  if (!theme.assets) return [];
  const dirAbs = path.resolve(REPO_ROOT, theme.assets);
  let entries: string[];
  let dirReal: string;
  try {
    dirReal = fs.realpathSync(dirAbs);
    entries = fs.readdirSync(dirAbs, { recursive: true, encoding: "utf8" });
  } catch {
    return [];
  }
  const out: { tail: string; file: string }[] = [];
  for (const entry of entries) {
    const rel = entry.replace(/\\/g, "/");
    if (!isAllowedAsset(rel)) continue;
    try {
      const abs = resolveAsset(dirAbs, rel);
      if (!fs.statSync(abs).isFile()) continue;
      if (!contains(dirReal, fs.realpathSync(abs))) continue;
    } catch {
      continue;
    }
    out.push({ tail: assetRoute(rel).slice("/_nb/".length), file: `${theme.assets}/${rel}` });
  }
  return out;
}

export function getStaticPaths() {
  const named = Object.entries(NAMES)
    .filter(([, file]) => file != null)
    .map(([name, file]) => ({
      // assetPath yields "/_nb/<name>.<ext>" — the [...asset] param is the tail.
      tail: assetPath(name, file as string).slice("/_nb/".length),
      file: file as string,
    }));
  return [...named, ...folderAssets()].map(({ tail, file }) => ({ params: { asset: tail }, props: { file } }));
}

export const GET: APIRoute = ({ props }) => {
  const { file } = props as { file: string };
  const bytes = fs.readFileSync(path.resolve(REPO_ROOT, file));
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": contentTypeFor(assetExt(file)) },
  });
};
