---
title: Configuration keys
description: The full notabene.config.mjs surface, one table.
sidebar:
  label: Configuration keys
  order: 2
---

# Configuration keys

`notabene.config.mjs` is a **data-only** ES module at your repo root; every key is
optional. The narrative version with examples is in the
[configuration guide](../guide/configuration.md).

| Key | Default | Meaning |
| --- | --- | --- |
| `siteName` / `tagline` | `"Docs"` / `"docs"` | Header brand |
| `locale` | `"en"` | UI language + nav sort collation |
| `format` | `"mdx"` | `"mdx"` (.mdx strict + .md lenient) or `"commonmark"` (no MDX at all). `init` scaffolds `"commonmark"` |
| `mdxComponents` | — | [Components for `.mdx` pages](../guide/configuration.md#components-in-mdx-mdxcomponents): a repo-relative JS/TS module whose **default export** maps names to components, handed to every render (page, print/PDF, public build). Requires `format: "mdx"` — validated at load, like the file's existence and extension |
| `roots[]` | `[{docs}]` | Doc spaces: `{ key, label, path, exclude, description, publish, edit, mdxComponents }`. `label`/`description` accept a per-locale map with i18n; `publish: false` keeps the space out of [public builds](../guide/publish/private-content.md); `mdxComponents` replaces the global map for this space |
| `store` | `"docs/.notabene"` | Comments + journal folder — commit it ([contract](./store-contract.md)) |
| `home` | — | [Custom landing page](../guide/configuration.md#custom-home-page): a repo-relative Markdown file (or per-locale map) rendered above the space cards on `/` |
| `branding` | — | [Identity assets](../guide/configuration.md#branding): `{ logo, logoDark, favicon, socialImage }`, repo-relative files served at `/_nb/…`. Unset favicon → a built-in default mark |
| `theme` | — | [Look customization](../guide/customize.md): `{ tokens, css, assets, code }` — `--nb-*` token overrides (validated; a typo throws), a stylesheet loaded after the renderer's (cascade-layer-safe), a repo folder served at `/_nb/assets/…` for fonts/images (extension allow-list, no traversal), a Shiki theme for code (`"github-light"` or `{ light, dark }` — dual palettes follow the scheme toggle), and `mermaid: false` to keep Mermaid's own diagram palette |
| `nav` | — | [Outbound links](../guide/configuration.md#navigation-links): `{ header[], sidebar: { title, links[] }, footer: { links[], text, poweredBy } }`. One item shape — `{ label, href, icon, iconOnly, publish }`; `label` accepts a per-locale map, `publish: false` keeps a link out of public builds. Validated at load (scheme allow-list, icon names, duplicates) |
| `port` | `3009` | `astro dev` port |
| `host` | `false` | `true`/`NOTABENE_HOST=1`/`--host` exposes the write API to the LAN ([safety](./safety.md)) |
| `verify[]` | `[]` | Post-edit checks the agent runs (the renderer build always runs) |
| `review` | `"auto"` | `"auto"` = agent resolves comments; `"approve"` = agent proposes (`addressed`), you validate each at `/review` with a diff ([review loop](../guide/review-loop.md)) |
| `author` | git `user.name` | Default comment author; each browser overrides it per-device via the identity dialog |
| `authorEmail` | git `user.email` | Default author email; embedded git-style (`Name <email>`) so identities stay unique |
| `edit` | `{ enabled: true, requireGit: true }` | [In-page editor](../guide/editor.md) (dev only): `enabled` shows the affordance and injects the write API; `requireGit: false` allows writing a file git isn't tracking. Per space: `roots[].edit: false` makes it read-only |
| `editPattern` | — | "Edit this page" link under every doc page: a URL with a `{path}` placeholder (repo-relative source path), e.g. `https://github.com/o/r/edit/main/{path}`. Placeholder required — validated at load |
| `pdf` | `{ enabled: true, pageSize: "A4", margin: "18mm" }` | [PDF export](../guide/pdf-export.md) — `enabled` toggles the Export menu + `/print` routes; `pageSize`/`margin` set the `@page` box |
| `i18n` | — | [Multi-language docs](../guide/multilingual.md): `{ locales, defaultLocale, strategy: "directory"\|"suffix" }`. Omit for one language |
| `publish` | — | [Public build](../guide/publish/configuration.md) target: `{ site, base, exclude }`. `site` optional — omitted = [origin-agnostic artifact](../guide/publish/server-side-domain.md) |

## CLI/env overrides

`--site`/`--base` override `publish.site`/`publish.base`; `NOTABENE_HOST=1` matches
`host: true`; the CLI passes the repo's git identity as the `author`/`authorEmail`
fallback. Nothing else is configurable outside this file.
