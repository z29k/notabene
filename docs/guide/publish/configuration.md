---
title: Configuring publish
description: The publish config block — site, base, exclude — with the three typical hosting setups.
sidebar:
  label: Configuring publish
  order: 1
---

# Configuring `publish`

Everything lives under one optional config key — the CLI flags (`--site`/`--base`)
override it, and `--out` copies the artifact to a stable path (it refuses to overwrite
anything it didn't generate):

```js
// notabene.config.mjs
export default {
  // …
  publish: {
    // Deployed ORIGIN. Bakes absolute URLs into canonical, og:url, JSON-LD,
    // hreflang, llms.txt, the sitemap and robots.txt's Sitemap line.
    // OPTIONAL — omit it to keep the domain out of the repo (see
    // "Domain managed server-side"). Origin only, no path: a sub-path goes in `base`.
    site: "https://you.github.io",

    // Sub-path when the site is served under a prefix (GitHub Pages project
    // site → "/<repo>"). Prefixes every link and asset URL — unlike the domain,
    // a sub-path always affects rendering, it can't be server-side.
    base: "/your-repo",

    // Sub-trees to keep out of public builds — globs matched against
    // `<space key>/<page id>` (locale-independent: one pattern hides every
    // translation of a page). `*` = one path segment, `**` = any depth.
    exclude: ["docs/internal/**", "docs/*/draft"],
  },
};
```

## Three typical setups

```js
publish: { site: "https://you.github.io", base: "/my-repo" }  // GitHub Pages, project site
publish: { site: "https://docs.example.com" }                 // custom domain at the root
publish: { exclude: ["docs/internal/**"] }                    // domain kept out of the repo
```

The third one is the [origin-agnostic mode](./server-side-domain.md) — same artifact
behind any domain.

## Per-page metadata

Two frontmatter keys feed the public surfaces (see the full
[frontmatter reference](../../reference/frontmatter.md)):

```yaml
---
description: One-line summary — becomes the meta description / OpenGraph.
publish: false   # this page never ships in a public build
---
```

Scoping content out of the build has its own page:
[keep content private](./private-content.md).
