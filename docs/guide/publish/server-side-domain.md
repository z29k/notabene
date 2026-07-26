---
title: Domain managed server-side
description: Omit `site` and the artifact bakes no absolute URL — same output behind any domain. The cost is SEO only.
sidebar:
  label: Server-side domain
  order: 3
---

# Domain managed server-side? Omit `site`

When the public domain is the **server's** business — a vhost or reverse proxy in front,
several mirrors, or a domain that isn't chosen yet — just don't set `site` (and pass no
`--site`). The artifact becomes **origin-agnostic**: not one absolute URL is baked in, so
the *same* output works behind any domain, and changing domains never requires a rebuild.

## What changes

| Surface | With `site` | Without |
| --- | --- | --- |
| `llms.txt` / `llms-full.txt` / `.md` twins | absolute URLs | root-relative paths (agents resolve them against the origin they fetched from) |
| `hreflang` alternates | absolute | path-based |
| canonical, `og:url`, JSON-LD | emitted | not emitted — they only mean something with an origin |
| sitemap + robots.txt `Sitemap:` line | emitted | not emitted — the specs require absolute URLs |

## What that costs, concretely

**Search-engine visibility — nothing else.** Without a sitemap, canonical URLs or valid
`hreflang`, crawlers only discover pages by following links, nothing consolidates
duplicates if the docs answer on several domains, and multilingual pages send no language
signals to search engines. Social link previews keep their title/description but lose the
URL card. **Human readers and AI agents lose nothing** — every page, twin and llms file
works identically.

Rule of thumb: internal hosting, a mirror, or a domain that isn't settled → omit `site`;
a public site whose search ranking matters → set `site`.

## `base` stays independent

Set [`base`](./configuration.md) whenever the site lives under a sub-path, with or
without a domain — a sub-path always affects the rendered links, so it can't be left to
the server.
