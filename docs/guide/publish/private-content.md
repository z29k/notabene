---
title: Keep content private
description: Three scoping levels — a whole space, a sub-tree, a single page — and the guarantee behind them.
sidebar:
  label: Keep content private
  order: 2
---

# Keep content private

Three levels, from coarse to fine — each lives where the thing it scopes lives.

**A whole space** — flag the `roots[]` entry:

```js
roots: [
  { key: "docs",  label: "Docs",  path: "docs" },
  { key: "notes", label: "Notes", path: "notes", publish: false },  // whole space stays private
],
```

**A sub-tree** — `publish.exclude` globs on `<space key>/<page id>` (that's the page's
URL path without any locale prefix, so **one pattern hides every translation**):

```js
publish: { exclude: ["docs/internal/**", "docs/*/draft"] },
```

**A single page** — its own frontmatter:

```yaml
---
publish: false   # this page never ships in a public build
---
```

**A navigation link** — not content, but the same idea: a
[`nav` entry](../configuration.md#navigation-links) marked `publish: false` stays in dev
and never reaches the artifact (a dashboard, an internal wiki):

```js
nav: { header: [{ label: "Ops dashboard", href: "https://ops.internal", publish: false }] },
```

## The guarantee

Private content isn't hidden, it's **not built** — no route (the URL 404s), no sidebar
entry, no search hit, no `llms.txt` line, no `.md` twin, no sitemap entry, no print/PDF
inclusion, and the space's name and path never reach the public HTML.

`notabene dev` and normal builds always show everything — you
[review](../review-loop.md) your private docs exactly like the rest. The `publish` notion
exists **only** for public builds.

## One caveat: links into private content

If a *public* page links to a *private* one, that link 404s in the public artifact — the
build doesn't rewrite or warn about it. **`notabene lint` catches exactly this**: run it
after `build --public` and every link from a public page into scoped-out content is
reported (the public route truth simply doesn't contain those pages — see the
[CLI reference](../../reference/cli.md)).
