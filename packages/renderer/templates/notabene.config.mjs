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
};
