// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import { remarkRewriteLinks } from "./src/remark/rewrite-links.mjs";
import { REPO_ROOT, host, mdxEnabled, port, roots } from "./src/config.mjs";

// notabene renderer — a navigable site over a repo's docs + a human↔agent review
// loop. DEV-LOCAL tool, not deployed. Plain Astro (not Starlight): content lives
// OUTSIDE the app (glob `base` derived from notabene.config `roots[]`), and we keep
// full control of the 3-column layout for the comments right-rail. Run-from-package:
// the app renders the consumer's repo (NOTABENE_ROOT), only data lives there.
export default defineConfig({
  // SAFETY (§3): the comments API writes into the consumer's git. Default bind is
  // LOOPBACK (host: false = 127.0.0.1) — the write endpoint is NOT reachable from
  // the LAN. Explicit opt-in only (config `host: true` or NOTABENE_HOST=1), trusted
  // networks only.
  server: { host, port },
  // Doc pages are static (prerendered); /api/comments is `prerender = false`
  // (on-demand) → the Node adapter serves the write API. Dev-only.
  adapter: node({ mode: "standalone" }),
  // MDX only in "mdx" format (§10.bis). In "commonmark", .md files go through
  // Astro's native markdown pipeline (lenient CommonMark/GFM).
  integrations: mdxEnabled ? [mdx()] : [],
  markdown: {
    // GFM on by default. Shiki syntax highlighting.
    shikiConfig: { theme: "github-dark", wrap: true },
    // Rewrite inter-doc .md links → site routes (see src/remark/). Tuple form
    // [attacher, options]: unified calls remarkRewriteLinks(roots).
    remarkPlugins: [[remarkRewriteLinks, roots]],
  },
  vite: {
    // Consumer content (docs, notabene.config) lives outside the Astro root
    // (the app is in node_modules) → let Vite serve it.
    server: { fs: { allow: [REPO_ROOT] } },
  },
});
