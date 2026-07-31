// DEV serving of the consumer asset folder (config `theme.assets`). The build
// enumerates it in getStaticPaths (asset-routes/branding.ts), but that enumeration is
// evaluated once per module load — a font dropped into the folder while `notabene dev`
// runs would 404 until a restart. A Vite middleware resolves each request against the
// filesystem instead, so the folder behaves like a normal static directory in dev.
//
// The guards are the SAME pure ones the build route uses (lib/asset-dir.mjs): the
// extension allow-list, path-shape/traversal refusal, and realpath containment inside
// the folder. Dev has no `base` (astro.config sets one only in public mode), so the
// prefix is fixed.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, theme } from "../config.mjs";
import { contains, isAllowedAsset, resolveAsset } from "../lib/asset-dir.mjs";
import { assetExt, contentTypeFor } from "../lib/asset-types.mjs";

const PREFIX = "/_nb/assets/";

export function notabeneDevAssets() {
  return {
    name: "notabene:dev-assets",
    hooks: {
      "astro:server:setup": ({ server }) => {
        if (!theme.assets) return;
        const dirAbs = path.resolve(REPO_ROOT, theme.assets);
        server.middlewares.use((req, res, next) => {
          const url = (req.url ?? "").split("?")[0];
          if (!url.startsWith(PREFIX)) return next();
          let rel;
          try {
            rel = decodeURIComponent(url.slice(PREFIX.length));
          } catch {
            return next();
          }
          if (!isAllowedAsset(rel)) return next();
          let abs;
          try {
            abs = resolveAsset(dirAbs, rel);
            if (!fs.statSync(abs).isFile()) return next();
            if (!contains(fs.realpathSync(dirAbs), fs.realpathSync(abs))) return next();
          } catch {
            // Missing file (or a broken symlink) → let Astro answer its own 404.
            return next();
          }
          res.setHeader("content-type", contentTypeFor(assetExt(abs)));
          res.end(fs.readFileSync(abs));
        });
      },
    },
  };
}
