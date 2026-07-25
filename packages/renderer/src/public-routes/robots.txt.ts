import type { APIRoute } from "astro";
import { publish } from "../config.mjs";
import { withBase } from "../lib/base";

// /robots.txt for the PUBLIC artifact (injected by integrations/public-routes.mjs —
// absent from dev/normal builds). Everything is public docs → allow all; point
// crawlers at the sitemap the @astrojs/sitemap integration emits.
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${publish.site}${withBase("/sitemap-index.xml")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
