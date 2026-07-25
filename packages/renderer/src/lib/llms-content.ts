// Server-side gatherer for the agent surface (llms.txt / llms-full.txt / the .md
// twins): the ordered page list per locale, one space at a time. Ordering matches
// the print/PDF export exactly — space home first, then the nav tree flattened
// (buildNav + flattenNav) — so the corpus reads in the same order a human gets.
import { getCollection } from "astro:content";
import { i18n, roots } from "../config.mjs";
import { decode, localizeField, routeFor } from "./i18n-content.mjs";
import { buildNav, pageTitle } from "./nav";
import { flattenNav } from "./print-scope";

export interface AgentPage {
  title: string;
  /** Base-less site route of the rendered page. */
  route: string;
  /** Raw Markdown source (frontmatter stripped by the content loader). */
  body: string;
}

export interface AgentSpace {
  key: string;
  label: string;
  pages: AgentPage[];
}

export async function gatherAgentSpaces(locale: string): Promise<AgentSpace[]> {
  const out: AgentSpace[] = [];
  for (const root of roots) {
    const entries = (await getCollection(root.key as never)) as any[];
    // Canonical id → entry, for THIS locale only.
    const byCanonical = new Map<string, (typeof entries)[number]>();
    let indexEntry: (typeof entries)[number] | undefined;
    for (const e of entries) {
      const d = decode(e.id, i18n);
      if (d.locale !== locale) continue;
      byCanonical.set(d.id, e);
      if (/^(readme|index)$/i.test(d.id)) indexEntry = e;
    }
    if (byCanonical.size === 0) continue; // no content in this locale

    const pages: AgentPage[] = [];
    const push = (canonicalId: string, e: any) => {
      if (!e) return;
      pages.push({
        title: pageTitle(e.body ?? "", canonicalId, e.data),
        route: routeFor({ space: root.key, id: canonicalId, locale }, i18n),
        body: e.body ?? "",
      });
    };
    // The space home is not a nav leaf (assembleNav skips the root readme/index) →
    // lead with it, same as the print bundle.
    if (indexEntry) push(decode(indexEntry.id, i18n).id, indexEntry);
    for (const item of flattenNav(root.key, await buildNav(root.key, locale))) {
      if (item.type === "leaf") push(item.id, byCanonical.get(item.id));
    }
    out.push({
      key: root.key,
      label: localizeField(root.labelI18n, locale, i18n.defaultLocale) ?? root.label,
      pages,
    });
  }
  return out;
}

/** Base-less path of a locale's llms.txt index (default locale unprefixed). */
export function llmsIndexPath(locale: string): string {
  return locale === i18n.defaultLocale ? "/llms.txt" : `/${locale}/llms.txt`;
}

/** Base-less path of a locale's llms-full.txt corpus. */
export function llmsFullPath(locale: string): string {
  return locale === i18n.defaultLocale ? "/llms-full.txt" : `/${locale}/llms-full.txt`;
}
