// Branding asset route, injected in EVERY mode (dev, normal build, public build).
// It cannot live under src/pages/: the /_nb/ prefix is deliberate (internal, can't
// collide with a space key) but Astro excludes underscore-prefixed page files from
// routing — an injected pattern has no such rule. With no branding configured the
// entrypoint's getStaticPaths returns [] and nothing is emitted.
import { fileURLToPath } from "node:url";

export function notabeneAssetRoutes() {
  return {
    name: "notabene:asset-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        injectRoute({
          pattern: "/_nb/[...asset]",
          entrypoint: fileURLToPath(new URL("../asset-routes/branding.ts", import.meta.url)),
        });
      },
    },
  };
}
