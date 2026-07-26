import type { APIRoute } from "astro";
import { i18n, publicMode } from "../../config.mjs";

import { ensureH1, twinHeader } from "../../lib/llms";
import { gatherAgentSpaces, llmsIndexPath, publicHref } from "../../lib/llms-content";

// Markdown twin of every doc page (PUBLIC builds only): `<route>/index.md` serves
// the page's raw Markdown source with a one-line pointer header (rendered URL +
// llms.txt index). Discovery: `<link rel="alternate" type="text/markdown">` in the
// HTML head + the llms.txt index. The body ships VERBATIM — the source is already
// Markdown, so unlike downlevel-from-components approaches nothing is lossy;
// relative links inside a twin are the authored file-relative ones (the absolute
// URL of everything is in llms.txt).
export async function getStaticPaths() {
  if (!publicMode) return [];
  const paths: any[] = [];
  for (const locale of i18n.locales) {
    for (const space of await gatherAgentSpaces(locale)) {
      for (const p of space.pages) {
        paths.push({
          params: { path: p.route.slice(1) },
          props: { title: p.title, route: p.route, body: p.body, locale },
        });
      }
    }
  }
  return paths;
}

export const GET: APIRoute = ({ props }) => {
  const { title, route, body, locale } = props as { title: string; route: string; body: string; locale: string };
  const md = twinHeader(publicHref(route), publicHref(llmsIndexPath(locale))) + ensureH1(body, title);
  return new Response(md.endsWith("\n") ? md : `${md}\n`, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};
