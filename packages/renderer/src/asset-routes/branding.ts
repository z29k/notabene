import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { REPO_ROOT, branding } from "../config.mjs";
import { assetExt, assetPath, contentTypeFor } from "../lib/asset-types";

// Branding assets (config `branding`): logo / logo-dark / favicon / og served at
// stable /_nb/<name>.<ext> paths. The files live in the CONSUMER repo (outside the
// Astro root), so — like search-index.json — a prerendered endpoint reads the bytes:
// static files in builds, served on demand in dev. Nothing configured → no routes
// (getStaticPaths returns []), byte-identical default.
const NAMES: Record<string, string | null> = {
  logo: branding.logo,
  "logo-dark": branding.logoDark,
  favicon: branding.favicon,
  og: branding.socialImage,
};

export function getStaticPaths() {
  return Object.entries(NAMES)
    .filter(([, file]) => file != null)
    .map(([name, file]) => ({
      // assetPath yields "/_nb/<name>.<ext>" — the [...asset] param is the tail.
      params: { asset: assetPath(name, file as string).slice("/_nb/".length) },
      props: { file: file as string },
    }));
}

export const GET: APIRoute = ({ props }) => {
  const { file } = props as { file: string };
  const bytes = fs.readFileSync(path.resolve(REPO_ROOT, file));
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": contentTypeFor(assetExt(file)) },
  });
};
