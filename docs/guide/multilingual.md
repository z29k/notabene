---
title: Multi-language docs
description: Serve the same docs in several languages — clean prefixed URLs, a header switcher, per-language comments.
sidebar:
  label: Multi-language docs
  order: 8
---

# Multi-language docs (i18n)

Add `i18n` to serve the same docs in several languages with **clean prefixed URLs** (the
default locale unprefixed, others `/<locale>/…`), a **language switcher** in the header,
`hreflang` alternates, and per-page chrome — a French page renders French nav, buttons
and dates.

```js
i18n: { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory" },
```

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-i18n-demo.gif" alt="notabene i18n: pick a language from the header switcher, docs and chrome switch" width="820" />
</p>

## Two authoring layouts

Pick how the files are laid out with `strategy`:

- **`directory`** (default) — a folder per locale: `docs/en/guide.md` · `docs/fr/guide.md`.
- **`suffix`** — one tree, translated per file: `docs/guide.md` (default) ·
  `docs/guide.fr.md`. Best for adding languages to an **existing** doc: the
  default-language files don't move, so their URLs *and* their comment threads are
  preserved.

## Language preference & fallback

The switcher records the visitor's chosen language; from then on, landing on a page
written in another language that *has* a translation **redirects** to it — following any
link keeps you in your language. A page with **no** translation falls back to the source
language and shows a discreet banner. The pages not tied to a content language —
`/comments`, `/journal`, `/review`, the home page and `404` — follow your current
language client-side and carry the same switcher.

## Per-language everything

- **Comments are per language** — a comment on the FR page is its own thread, mapping to
  the FR source file.
- Search and [PDF export](./pdf-export.md) (`notabene pdf --locale fr`) are scoped to one
  language; a [public site](./publish/index.md) ships per-locale `llms.txt` and Markdown
  twins.
- Every human string of the config accepts a per-locale map: a space's
  `label`/`description` (`label: { en: "Docs", fr: "Documentation" }`), the
  [custom home page](./configuration.md#custom-home-page) (`home: { en: …, fr: … }`), and
  every [navigation link](./configuration.md#navigation-links) label, sidebar block title
  and footer line. Unset for a locale → it falls back to the default one.

Omit `i18n` for a single language — behavior is unchanged.
