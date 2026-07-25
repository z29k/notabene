import type { APIRoute } from "astro";
import { i18n, publicMode, publish, siteName, tagline } from "../../config.mjs";
import { withBase } from "../../lib/base";
import { renderLlmsIndex } from "../../lib/llms";
import { gatherAgentSpaces, llmsFullPath, llmsIndexPath } from "../../lib/llms-content";

// /llms.txt (+ /<locale>/llms.txt) — machine-readable index of the doc for agents
// (PUBLIC builds only): one section per space, every page in nav order, each link
// pointing at the page's Markdown twin. Pure text assembly lives in lib/llms.
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
  const text = renderLlmsIndex({
    siteName,
    tagline,
    absolute: (p) => `${publish.site}${withBase(p)}`,
    spaces,
    fullPath: llmsFullPath(locale),
    otherLocales: i18n.enabled
      ? i18n.locales.filter((l: string) => l !== locale).map((l: string) => ({ locale: l, path: llmsIndexPath(l) }))
      : [],
  });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
