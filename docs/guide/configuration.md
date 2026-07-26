---
title: Configuration
description: One data-only config file at your repo root — spaces, format, store, review mode. By example.
sidebar:
  order: 3
---

# Configuration

`notabene.config.mjs` at your repo root is the only wiring. Paths are repo-relative.
`notabene init` scaffolds a commented template; `notabene init --detect` prefills
`roots[]` from the doc folders it finds. Every key is optional — this page shows the ones
you'll actually touch; the [config reference](../reference/config.md) lists them all.

```js
// notabene.config.mjs
export default {
  siteName: "My Project",
  tagline: "docs",
  locale: "en",

  // Input format: "commonmark" (lenient, zero MDX) or "mdx" (.mdx strict + .md lenient).
  format: "commonmark",

  // Doc spaces. `key` = URL slug + store space; `path` = repo-relative folder.
  roots: [
    { key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] },
    { key: "adr", label: "Decisions", path: "docs/adr", description: "Architecture decision records" },
  ],

  store: "docs/.notabene",   // comments + journal (commit this folder)
  review: "auto",            // "approve" = you validate each edit with a diff
  verify: [],                // your own post-edit checks (the renderer build always runs)
};
```

## Spaces (`roots[]`)

Each entry becomes a **space**: its own section in the sidebar, its own card on the home
page, its own prefix in comment ids. A nested root (like `docs/adr` above) wins over its
parent for the pages it contains — the most specific path rules. `label` and
`description` accept a per-locale map when [i18n](./multilingual.md) is on.

## MDX and CommonMark/GFM

The renderer picks the processor **by file extension**:

- **`.md`** → CommonMark/GFM, **lenient**. `<email@x>`, `Promise<T>`, `{var}`, raw HTML
  and GFM tables all render without a crash.
- **`.mdx`** → **strict** MDX (JSX/expressions) — importable components, but `<`/`{`
  outside code fences must be escaped.

`format: "mdx"` (the config default) enables both, mixable in one repo.
`format: "commonmark"` (what `init` scaffolds) drops the MDX dependency entirely — the
safe, most-lenient starting point for a plain-Markdown repo.

## Sidebar labels & ordering

By default a page's sidebar entry is its **humanized file name** and siblings sort
alphabetically. Override either per page with frontmatter — no numeric file-name
prefixes needed:

```yaml
---
title: Internal network map      # page <title> + breadcrumb (overrides the H1)
sidebar:
  label: Network map             # sidebar text (else title, else file name)
  order: 9                       # position among siblings (ascending)
---
```

- `order` sorts ascending; entries without one keep sorting alphabetically, after the
  ordered ones. Groups and pages share one ordering.
- A **folder** is named and positioned by its landing page — `<folder>/index.md` (or
  `readme.md`) — whose `sidebar` frontmatter applies to the whole group; that page shows
  as a localized *Overview* entry (rename via `sidebar.indexLabel`).
- These labels flow through to breadcrumbs and [PDF export](./pdf-export.md).

The full frontmatter surface (including `description` and `publish` for
[public sites](./publish/index.md)) is in the [frontmatter reference](../reference/frontmatter.md).
