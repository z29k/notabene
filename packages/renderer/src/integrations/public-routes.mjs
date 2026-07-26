// Static routes that exist ONLY in a public build (`notabene build --public`) —
// the mirror of app-routes.mjs. Dynamic public routes (llms.txt, llms-full.txt,
// the .md twins) live under src/pages/ and gate themselves via getStaticPaths
// returning [] when !publicMode; param-less routes can't do that, so they are
// injected here instead and the integration is only loaded in public mode.
import { fileURLToPath } from "node:url";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

export function notabenePublicRoutes() {
  return {
    name: "notabene:public-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        injectRoute({ pattern: "/robots.txt", entrypoint: here("../public-routes/robots.txt.ts") });
      },
    },
  };
}
