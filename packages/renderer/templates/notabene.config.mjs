// notabene.config.mjs — configuration for the notabene docs review tool.
//
// The tool (renderer + human↔agent review loop) is GENERIC; this file is the only
// thing that points it at YOUR docs. Your data (content, comments, journal) lives
// in your git, not in the tool. Paths are relative to this repo root.
export default {
  // Brand shown in the header / title.
  siteName: "Docs",
  tagline: "docs",
  // UI language + nav sort collation (localeCompare).
  locale: "en",

  // Input format (§10.bis). "mdx": .mdx STRICT + .md CommonMark/GFM LENIENT (mix by
  // extension). "commonmark": everything CommonMark/GFM, no MDX dependency/strictness.
  format: "commonmark",

  // Doc spaces. Each: { key (url slug + store `space`), label, path (repo-relative),
  // exclude (globs), description (optional home-card text) }.
  // With i18n on (below), `label` and `description` may be a per-locale map instead of a
  // string — e.g. label: { en: "Docs", fr: "Documentation" } — resolved to the rendered
  // language (falls back to defaultLocale, then any defined value). A string stays as-is.
  roots: [
    { key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] },
  ],

  // Comments + journal store (one JSON per page: <store>/<page>.json). Commit it.
  store: "docs/.notabene",

  // astro dev port.
  port: 3009,

  // SAFETY: the write API modifies your git. false = loopback only (127.0.0.1).
  // true (or NOTABENE_HOST=1 / --host) exposes it to the LAN — trusted networks only.
  host: false,

  // Consumer post-edit checks the agent runs after applying comments (build/lint/
  // memory update). The renderer build is ALWAYS run by the loop — don't duplicate it.
  verify: [],

  // Review loop. "auto" (default): the agent resolves comments directly. "approve":
  // the agent proposes edits (status "addressed"); you validate them (with a diff) at
  // /review or via the "to validate" filter on /comments, then resolve or reject.
  review: "auto",

  // PDF export (the "Export PDF" menu + /print routes). Optional — omit for defaults.
  // pdf: { enabled: true, pageSize: "A4", margin: "18mm" },

  // Public publishing (`notabene build --public`): a read-only STATIC site — no
  // comments/review UI, no API, no store data — plus an agent-readable surface
  // (llms.txt, per-page .md twins, sitemap, OG/JSON-LD). `site` = deployed origin;
  // OPTIONAL — omit it to keep the domain out of the repo (server-side vhost/proxy):
  // the artifact then bakes no absolute URL (llms/twin links go root-relative; the
  // origin-only surfaces — sitemap, canonical, og:url, JSON-LD — are not emitted).
  // The cost is search-engine visibility only — readers and AI agents lose nothing.
  // `base` = sub-path when hosted under a prefix (GitHub Pages project site →
  // "/<repo>") — unlike the domain, it always affects rendering. CLI flags
  // --site/--base override. Scope what goes public (dev always shows everything):
  //   - a whole space:  `publish: false` on a roots[] entry (above)
  //   - a sub-tree:     `exclude` globs on `<space key>/<page id>` (locale-independent)
  //   - a single page:  frontmatter `publish: false`
  // publish: { site: "https://user.github.io", base: "/my-repo", exclude: ["docs/internal/**"] },

  // Multi-language docs. Optional — omit for a single language. Clean prefixed URLs
  // (default locale unprefixed, others /<locale>/…). Two authoring layouts:
  //   "directory" → a folder per locale:  docs/en/guide.md · docs/fr/guide.md
  //   "suffix"    → one tree, per file:    docs/guide.md · docs/guide.fr.md
  // Translate a space's own name via a per-locale `roots[].label`/`description` map (above).
  // i18n: { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory" },

  // Default comment identity. Omit → the CLI uses this repo's `git config user.name` /
  // `user.email` (else "you"). Each browser overrides it per-device via the identity dialog
  // (name + optional email); the author is stored git-style as "Name <email>".
  // author: "Alex",
  // authorEmail: "alex@example.com",
};
