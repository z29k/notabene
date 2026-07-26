import type { APIRoute } from "astro";
import { publish } from "../config.mjs";
import { withBase } from "../lib/base";

// /robots.txt for the PUBLIC artifact (injected by integrations/public-routes.mjs —
// absent from dev/normal builds). Everything is public docs → allow all. The
// Sitemap directive requires an absolute URL, so it (like the sitemap itself) only
// exists when `publish.site` is known — an origin-agnostic build must not point
// crawlers at a file that isn't emitted.
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n${publish.site ? `\nSitemap: ${publish.site}${withBase("/sitemap-index.xml")}\n` : ""}`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
