// The `mdxComponents` bridge: a Vite virtual module the render sites import.
//
// The consumer's component map lives in the consumer's repo (a .ts/.js module, usually
// importing .astro components), OUTSIDE the Astro app — which sits in their node_modules
// (run-from-package). Only Vite can compile it, so the config carries a PATH and this
// plugin turns it into a module:
//
//   import { componentsFor } from "virtual:notabene-mdx-components";
//   componentsFor(spaceKey)   // → the map, or undefined when none is configured
//
//   virtual:notabene-mdx-components       → generated source (lib/mdx-components.mjs)
//   virtual:notabene-mdx-components/<n>   → the consumer file at index n (absolute path,
//                                           so Vite compiles it with its normal pipeline
//                                           and its bare imports resolve from ITS folder,
//                                           i.e. the consumer's own node_modules)
//
// ALWAYS registered, even with nothing configured: the render sites import the module
// statically, so it must always resolve — it then generates a `componentsFor` returning
// undefined, and no `components` prop is passed anywhere (byte-identical output).
import { fileURLToPath } from "node:url";
import { REPO_ROOT, mdxComponentEntries } from "../config.mjs";
import { MDX_COMPONENTS_ID, planMdxComponents, sharesAncestor } from "../lib/mdx-components.mjs";

const PKG_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export function notabeneMdxComponents() {
  const { files, code } = planMdxComponents(mdxComponentEntries);
  const RESOLVED = `\0${MDX_COMPONENTS_ID}`;
  const PREFIX = `${MDX_COMPONENTS_ID}/`;

  // Say it BEFORE Astro says "No cached compile metadata found" (see sharesAncestor).
  // Only components carrying a <style>/<script> break, so this is a warning: it costs a
  // line in a layout no published install can produce, and saves an hour in the one a
  // scratch consumer can.
  if (files.length > 0 && !sharesAncestor(REPO_ROOT, PKG_ROOT)) {
    console.warn(
      `notabene: mdxComponents is configured, but this repo (${REPO_ROOT}) and the renderer ` +
        `(${PKG_ROOT}) share no parent folder. Astro resolves an .astro component's ` +
        "<style>/<script> against its own root, so such a component will fail to build here " +
        "(components without them are fine). Install the renderer inside the repo it renders, " +
        "or move the repo under the same top-level folder.",
    );
  }

  return {
    name: "notabene:mdx-components",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: "notabene:mdx-components",
                // Before vite:resolve, which knows nothing about `virtual:` ids.
                enforce: "pre",
                resolveId(id) {
                  if (id === MDX_COMPONENTS_ID) return RESOLVED;
                  if (!id.startsWith(PREFIX)) return null;
                  const i = Number(id.slice(PREFIX.length));
                  return Number.isInteger(i) && files[i] ? files[i] : null;
                },
                load(id) {
                  return id === RESOLVED ? code : null;
                },
              },
            ],
          },
        });
      },
    },
  };
}
