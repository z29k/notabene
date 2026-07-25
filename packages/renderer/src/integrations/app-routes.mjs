// Interactive app routes — the comments/review/journal pages and the /api/*
// endpoints — are injected by this integration instead of living in src/pages/, so
// a PUBLIC build (`notabene build --public`) can drop them STRUCTURALLY: when the
// integration isn't loaded, the routes do not exist. No store data can leak into
// the artifact and there is nothing to gate — the safety is the absence of code,
// not a runtime check. Entrypoints keep their own `export const prerender` flags,
// so dev/normal builds behave exactly as when these files lived under src/pages/.
import { fileURLToPath } from "node:url";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

export function notabeneAppRoutes() {
  return {
    name: "notabene:app-routes",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        injectRoute({ pattern: "/comments", entrypoint: here("../app-routes/comments.astro") });
        injectRoute({ pattern: "/review", entrypoint: here("../app-routes/review.astro") });
        injectRoute({ pattern: "/journal", entrypoint: here("../app-routes/journal.astro") });
        injectRoute({ pattern: "/api/comments", entrypoint: here("../app-routes/api/comments.ts") });
        injectRoute({ pattern: "/api/diff", entrypoint: here("../app-routes/api/diff.ts") });
        injectRoute({ pattern: "/api/journal", entrypoint: here("../app-routes/api/journal.ts") });
      },
    },
  };
}
