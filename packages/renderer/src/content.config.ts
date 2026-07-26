import { pathToFileURL } from "node:url";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { REPO_ROOT, homeFiles, i18n, roots } from "./config.mjs";
import { makeSuffixGenerateId } from "./lib/i18n-content.mjs";

// Content sourced OUTSIDE the app (a viewer over the repo's docs): one collection
// per space declared in notabene.config.mjs (`roots[]`). The collection name = the
// space `key`; the glob `base` = its folder, resolved against the repo root
// (cf. src/config.mjs). Extensions come from `format` (.md/.mdx or .md/.markdown).
//
// i18n SUFFIX strategy only: override the id generator so a "guide/setup.fr.md" keeps its
// locale marker. Astro's default runs each segment through github-slugger, which DELETES
// dots ("setup.fr" → "setupfr") and would destroy the marker (see lib/i18n-content.mjs).
const generateId = i18n.enabled && i18n.strategy === "suffix" ? makeSuffixGenerateId(i18n) : undefined;

const collections: Record<string, ReturnType<typeof defineCollection>> = {};
for (const root of roots) {
  collections[root.key] = defineCollection({
    loader: glob({ pattern: root.pattern, base: root.baseUrl, ...(generateId ? { generateId } : {}) }),
  });
}

// Custom site home (config `home`): a dedicated collection holding exactly the
// configured file(s), based at the repo root. Ids keep the extension-less relative
// path VERBATIM (no slugger — it would eat dots in per-locale names like home.fr.md),
// so SiteHome can match an entry from the configured path deterministically.
if (homeFiles.length > 0) {
  collections["nb-home"] = defineCollection({
    loader: glob({
      pattern: homeFiles,
      base: pathToFileURL(REPO_ROOT),
      generateId: ({ entry }) => entry.replace(/\.(mdx?|markdown)$/i, ""),
    }),
  });
}

export { collections };
