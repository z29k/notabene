// Route truth for `notabene lint` — the nimbus lesson applied: NEVER reconstruct
// routes from the filesystem (it drifts); record what Astro ACTUALLY emitted, at
// `astro:build:done`, from its own `pages` array. Written to <workDir>/routes.json
// (next to the CLI's dist/), so nothing lands in the consumer repo. `publicMode`
// rides along: the truth of a public build already excludes publish-scoped pages,
// which is exactly what makes `lint` catch public→private links for free.
import fs from "node:fs";
import path from "node:path";
import { publicMode, publish } from "../config.mjs";

export function notabeneRouteTruth() {
  return {
    name: "notabene:route-truth",
    hooks: {
      "astro:build:done": ({ pages }) => {
        const outDir = process.env.NOTABENE_OUT_DIR;
        if (!outDir) return; // bare astro run outside the CLI — nowhere stable to write
        // Normalize to base-less, no-trailing-slash, leading-slash routes — the same
        // vocabulary the link mapper emits (routeFor), so lint compares apples to apples.
        const basePrefix = publish.base === "/" ? "" : publish.base;
        const routes = [
          ...new Set(
            pages.map((p) => {
              let r = `/${String(p.pathname).replace(/^\/+|\/+$/g, "")}`;
              if (basePrefix && (r === basePrefix || r.startsWith(`${basePrefix}/`))) {
                r = r.slice(basePrefix.length) || "/";
              }
              return r === "/" ? "/" : r.replace(/\/+$/, "");
            }),
          ),
        ].sort();
        // `pages` only lists PRERENDERED routes — /journal is on-demand in normal
        // mode yet perfectly real; a doc link to it must not be flagged.
        if (!publicMode) routes.push("/journal");
        routes.sort();
        const truth = { version: 1, publicMode, base: publish.base, generatedAt: new Date().toISOString(), routes };
        fs.writeFileSync(path.join(path.dirname(outDir), "routes.json"), `${JSON.stringify(truth, null, 2)}\n`);
      },
    },
  };
}
