import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { roots } from "./config.mjs";

// Content sourced OUTSIDE the app (a viewer over the repo's docs): one collection
// per space declared in notabene.config.mjs (`roots[]`). The collection name = the
// space `key`; the glob `base` = its folder, resolved against the repo root
// (cf. src/config.mjs). Extensions come from `format` (.md/.mdx or .md/.markdown).
const collections: Record<string, ReturnType<typeof defineCollection>> = {};
for (const root of roots) {
  collections[root.key] = defineCollection({
    loader: glob({ pattern: root.pattern, base: root.baseUrl }),
  });
}

export { collections };
