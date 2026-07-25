import type { APIRoute } from "astro";
import { i18n, publicMode, publish, siteName, tagline } from "../../config.mjs";
import { withBase } from "../../lib/base";
import { renderLlmsFull } from "../../lib/llms";
import { gatherAgentSpaces, llmsIndexPath } from "../../lib/llms-content";

// /llms-full.txt (+ /<locale>/llms-full.txt) — the whole doc as ONE Markdown
// document (PUBLIC builds only), pages in nav order, each block opened by a rule +
// Source line so boundaries stay machine-splittable. No timestamps: rebuilding
// unchanged docs is byte-identical.
export function getStaticPaths() {
  if (!publicMode) return [];
  return i18n.locales.map((l: string) => ({
    params: { loc: l === i18n.defaultLocale ? undefined : l },
    props: { locale: l },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { locale } = props as { locale: string };
  const spaces = await gatherAgentSpaces(locale);
  const text = renderLlmsFull({
    siteName,
    tagline,
    absolute: (p) => `${publish.site}${withBase(p)}`,
    indexPath: llmsIndexPath(locale),
    spaces,
  });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
