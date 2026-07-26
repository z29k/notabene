---
title: Publish a public site
description: A read-only, agent-readable static site from your docs — no review UI, no store data, deployable anywhere.
sidebar:
  label: Publish a public site
  order: 8
---

# Publish a public site

The review app is a **dev-local tool** — but the docs it renders often deserve a public
home. `build --public` produces a **pure-static, read-only** artifact made for that:

```bash
notabene build --public --site https://you.github.io --base /your-repo --out ./_site
```

> This very site is built that way — notabene's docs, rendered and published by notabene.

## What's in, what's out

- **Everything interactive is gone — structurally.** No comment UI, no identity prompt,
  no `/comments` / `/review` / `/journal`, no API, and **nothing from the `.notabene`
  store**. The routes are not gated; they are **not built**.
- **What remains** is the full reading experience: nav, search, Mermaid + image lightbox,
  dark mode, [i18n](../multilingual.md) (per-locale pages, switcher, `hreflang`),
  [print/PDF routes](../pdf-export.md), `404`.
- **Born agent-readable.** Every page ships a Markdown twin at `<page>/index.md`
  (advertised via `<link rel="alternate" type="text/markdown">`), the site ships
  `/llms.txt` (a machine index of every page, per locale) and `/llms-full.txt` (the whole
  doc as one Markdown document in reading order), plus `robots.txt`, a sitemap, canonical
  URLs, OpenGraph/Twitter meta and JSON-LD. Try it here: [/llms.txt](/notabene/llms.txt).

## Where next

- [Configuring `publish`](./configuration.md) — `site`, `base`, `exclude`, with examples.
- [Keep content private](./private-content.md) — space / sub-tree / page scoping.
- [Domain managed server-side](./server-side-domain.md) — omit `site`, stay
  origin-agnostic.
- [Deploy via GitHub Pages](./github-pages.md) — the ready-made workflow.

The dev loop is untouched: `notabene dev` and plain `notabene build` behave exactly as
before — publishing is opt-in, per build.
