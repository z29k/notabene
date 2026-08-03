// @ts-check
import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";
import { notabeneAppRoutes } from "./src/integrations/app-routes.mjs";
import { notabeneAssetRoutes } from "./src/integrations/asset-routes.mjs";
import { notabeneDevAssets } from "./src/integrations/dev-assets.mjs";
import { notabeneDevSearch } from "./src/integrations/dev-search.mjs";
import { notabeneEditor } from "./src/integrations/editor.mjs";
import { notabeneRouteTruth } from "./src/integrations/route-truth.mjs";
import { notabenePublicRoutes } from "./src/integrations/public-routes.mjs";
import { rehypeMermaid } from "./src/remark/mermaid.mjs";
import { remarkRewriteLinks } from "./src/remark/rewrite-links.mjs";
import { REPO_ROOT, host, i18n, mdxEnabled, port, publicMode, publish, roots, theme } from "./src/config.mjs";

// This package directory (the Astro root). Run-from-package puts the renderer OUTSIDE the
// consumer tree, so the consumer root alone (REPO_ROOT) does not cover the app's own source
// (e.g. src/styles/global.css, client scripts) — Vite's fs.allow must include it too.
const PKG_ROOT = fileURLToPath(new URL(".", import.meta.url));

// Shiki types the bundled theme names as a literal union; ours are plain strings
// validated at config load against the same list (lib/shiki-themes.mjs), so the check
// has already happened — widen the type rather than duplicate the union here.
/** @type {any} */
const codeThemes = theme.code;

// A site-less public build is a supported, deliberate mode (domain managed server-side) —
// say so once, with what it changes, so nobody hunts for a missing sitemap.
if (publicMode && !publish.site) {
  console.warn(
    "notabene: public build without a site URL → origin-agnostic artifact (no sitemap/canonical/og:url; " +
      "llms.txt and .md-twin links are root-relative). Pass --site or set publish.site to bake absolute URLs.",
  );
}

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
  // host:true = LAN opt-in (all interfaces). Otherwise bind IPv4 loopback EXPLICITLY:
  // Astro's default `localhost` resolves to ::1 on Node ≥17, but the CLI's readiness/
  // status checks and printed URLs use 127.0.0.1 — bind 127.0.0.1 so they match.
  server: { host: host === true ? true : "127.0.0.1", port },
  // outDir/cacheDir default under the app root (= the installed package), which may
  // be read-only. The CLI (bin/notabene.mjs) points these at a writable per-consumer
  // temp dir. Absolute paths are used as-is; undefined = Astro's default.
  ...(process.env.NOTABENE_OUT_DIR ? { outDir: process.env.NOTABENE_OUT_DIR } : {}),
  ...(process.env.NOTABENE_CACHE_DIR ? { cacheDir: process.env.NOTABENE_CACHE_DIR } : {}),
  // PUBLIC MODE (§ public exposure): a pure static artifact. `site`/`base` come from
  // publish config (canonical URLs, llms.txt, sitemap; base = GitHub Pages sub-path).
  // The interactive routes are simply not injected (see integrations below) and NO
  // adapter is loaded — nothing on-demand survives into the artifact.
  ...(publicMode && publish.site ? { site: publish.site } : {}),
  ...(publicMode && publish.base !== "/" ? { base: publish.base } : {}),
  // Doc pages are static (prerendered); /api/comments is `prerender = false`
  // (on-demand) → the Node adapter serves the write API. Dev-only, never in a
  // public build (no adapter → the build fails loudly if an on-demand route leaks in).
  ...(publicMode ? {} : { adapter: node({ mode: "standalone" }) }),
  // MDX only in "mdx" format (§10.bis). In "commonmark", .md files go through
  // Astro's native markdown pipeline (lenient CommonMark/GFM). The interactive app
  // routes (comments/review/journal + /api/*) are INJECTED — absent from a public
  // build (see src/integrations/app-routes.mjs). The sitemap needs absolute URLs →
  // only in public builds WITH a site; a site-less public build stays
  // origin-agnostic (no sitemap rather than a wrong one).
  integrations: [
    ...(mdxEnabled ? [mdx()] : []),
    notabeneAssetRoutes(),
    notabeneRouteTruth(),
    ...(publicMode
      ? [...(publish.site ? [sitemap()] : []), notabenePublicRoutes()]
      : [notabeneAppRoutes(), notabeneDevSearch(), notabeneDevAssets(), notabeneEditor()]),
  ],
  markdown: {
    // GFM on by default. Shiki syntax highlighting — but NOT for ```mermaid: excludeLangs
    // leaves that fence as a plain <pre><code class="language-mermaid">, which the rehype
    // plugin below normalizes to <pre class="mermaid"> for client-side rendering.
    syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
    // Config `theme.code` switches Shiki to DUAL themes with `defaultColor: false`: no
    // baked color, just --shiki-light/--shiki-dark variables per token, which
    // theme.codeCss feeds to light-dark() → the scheme toggle recolors code instantly.
    // Unset → the single built-in theme, i.e. the exact output of every prior version.
    shikiConfig: codeThemes ? { themes: codeThemes, defaultColor: false, wrap: true } : { theme: "github-dark", wrap: true },
    // Astro 6 moved the plugin lists off `markdown.*` and onto a PROCESSOR object;
    // `markdown.remarkPlugins`/`rehypePlugins` still work (they are coerced into the
    // default processor) but warn on every run. `unified()` IS that default processor,
    // taking the lists directly — same pipeline, no deprecation.
    //   · remarkRewriteLinks: inter-doc .md links → site routes (see src/remark/). Tuple
    //     form [attacher, options]; the base is passed explicitly (remark runs outside
    //     Vite → no BASE_URL there).
    //   · rehypeMermaid: ```mermaid fence → <pre class="mermaid"> (rendered client-side).
    // The editor's source-map plugins are appended to THIS processor's options in dev
    // only — see src/integrations/editor.mjs.
    processor: unified({
      remarkPlugins: [[remarkRewriteLinks, { roots, i18n, base: publicMode ? publish.base : "/" }]],
      rehypePlugins: [rehypeMermaid],
    }),
  },
  vite: {
    // Consumer content (docs, notabene.config) lives outside the Astro root
    // (the app is in node_modules) → let Vite serve it.
    server: { fs: { allow: [REPO_ROOT, PKG_ROOT] } },
    // Mermaid (lazy-loaded by lib/client/mermaid.ts via `import("mermaid")`) pulls in
    // dayjs — a CommonJS module with no ESM `default` export — through its OWN internal
    // dynamic imports, which Vite's dep scanner never reaches from our single dynamic
    // import. Left un-prebundled, dayjs is served raw and `import mermaid from "mermaid"`
    // throws `dayjs … does not provide an export named 'default'` BEFORE the per-diagram
    // try/catch — so no diagram renders and every block stays as plain text. Force Vite to
    // pre-bundle both so it synthesizes the CJS→ESM default. Dev-only: the production build
    // goes through Rollup, which handles CJS interop itself.
    // Milkdown (lazy-loaded by lib/client/editor.ts) has the same problem for a different
    // reason: Vite's scanner never reaches these entry points from a single dynamic
    // import, so the FIRST click on a block triggered an on-demand optimize — and Vite
    // reloads the page when the dep graph changes. The editor was torn down mid-mount and
    // fell back to plain-source editing, which read as "it opens a textarea full of raw
    // Markdown". Pre-bundling them makes the first click behave like every other one.
    optimizeDeps: {
      include: [
        "mermaid",
        "dayjs",
        "@milkdown/kit/core",
        "@milkdown/kit/utils",
        "@milkdown/kit/preset/commonmark",
        "@milkdown/kit/preset/gfm",
        "@milkdown/kit/plugin/history",
        "@milkdown/kit/plugin/listener",
      ],
    },
  },
});
