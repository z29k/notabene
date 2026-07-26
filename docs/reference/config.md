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
| `roots[]` | `[{docs}]` | Doc spaces: `{ key, label, path, exclude, description, publish }`. `label`/`description` accept a per-locale map with i18n; `publish: false` keeps the space out of [public builds](../guide/publish/private-content.md) |
| `store` | `"docs/.notabene"` | Comments + journal folder — commit it ([contract](./store-contract.md)) |
| `home` | — | [Custom landing page](../guide/configuration.md#custom-home-page): a repo-relative Markdown file (or per-locale map) rendered above the space cards on `/` |
| `branding` | — | [Identity assets](../guide/configuration.md#branding): `{ logo, logoDark, favicon, socialImage }`, repo-relative files served at `/_nb/…`. Unset favicon → a built-in default mark |
| `theme` | — | [Look customization](../guide/customize.md): `{ tokens, css }` — `--nb-*` token overrides (validated; a typo throws) and/or a stylesheet loaded after the renderer's (cascade-layer-safe) |
| `port` | `3009` | `astro dev` port |
| `host` | `false` | `true`/`NOTABENE_HOST=1`/`--host` exposes the write API to the LAN ([safety](./safety.md)) |
| `verify[]` | `[]` | Post-edit checks the agent runs (the renderer build always runs) |
| `review` | `"auto"` | `"auto"` = agent resolves comments; `"approve"` = agent proposes (`addressed`), you validate each at `/review` with a diff ([review loop](../guide/review-loop.md)) |
| `author` | git `user.name` | Default comment author; each browser overrides it per-device via the identity dialog |
| `authorEmail` | git `user.email` | Default author email; embedded git-style (`Name <email>`) so identities stay unique |
| `editPattern` | — | "Edit this page" link under every doc page: a URL with a `{path}` placeholder (repo-relative source path), e.g. `https://github.com/o/r/edit/main/{path}`. Placeholder required — validated at load |
| `pdf` | `{ enabled: true, pageSize: "A4", margin: "18mm" }` | [PDF export](../guide/pdf-export.md) — `enabled` toggles the Export menu + `/print` routes; `pageSize`/`margin` set the `@page` box |
| `i18n` | — | [Multi-language docs](../guide/multilingual.md): `{ locales, defaultLocale, strategy: "directory"\|"suffix" }`. Omit for one language |
| `publish` | — | [Public build](../guide/publish/configuration.md) target: `{ site, base, exclude }`. `site` optional — omitted = [origin-agnostic artifact](../guide/publish/server-side-domain.md) |

## CLI/env overrides

`--site`/`--base` override `publish.site`/`publish.base`; `NOTABENE_HOST=1` matches
`host: true`; the CLI passes the repo's git identity as the `author`/`authorEmail`
fallback. Nothing else is configurable outside this file.
