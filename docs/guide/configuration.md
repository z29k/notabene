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

## Branding

Point the header, browser tab and social cards at your own assets — repo-relative files,
served by the renderer (nothing to copy anywhere):

```js
branding: {
  logo: "assets/logo.svg",           // topbar image, next to the site name
  logoDark: "assets/logo-dark.svg",  // optional dark-mode variant (else logo everywhere)
  favicon: "assets/favicon.svg",     // .svg / .ico / .png — unset → a built-in default mark
  socialImage: "assets/og.png",      // og:image / twitter:image of PUBLIC builds
},
```

`socialImage` needs [`publish.site`](./publish/configuration.md) — crawlers require an
absolute URL. The favicon also covers the [print/PDF views](./pdf-export.md).

## Navigation links

Once a reader is *inside* a page, nothing leads back to your repo, your product or your
releases. `nav` adds those outbound links in three places — one item shape everywhere:

```js
nav: {
  // Topbar, right-hand group. Mirrored automatically in the mobile drawer.
  header: [
    { label: "GitHub", href: "https://github.com/you/repo", icon: "github", iconOnly: true },
    { label: { en: "Product", fr: "Produit" }, href: "https://example.com" },
  ],
  // A titled block under the space tree (the mobile drawer shows it too).
  sidebar: {
    title: { en: "Resources", fr: "Ressources" },
    links: [
      { label: "Releases", href: "https://github.com/you/repo/releases", icon: "star" },
      { label: "npm", href: "https://www.npmjs.com/package/your-pkg", icon: "npm" },
    ],
  },
  // The site footer. Nothing configured → no footer element at all.
  footer: {
    links: [{ label: "Licence", href: "/reference/licence" }],
    text: { en: "© 2026 you — MIT", fr: "© 2026 vous — MIT" },
    poweredBy: false,
  },
},
```

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-nav-demo.gif" alt="notabene navigation links: the repo icon in the topbar, a Resources block under the sidebar tree, a site footer, and a footer link back to the home page" width="820" />
</p>

| Field | Meaning |
| --- | --- |
| `label` | Required. A string, or a `{ <locale>: string }` map like `roots[].label`. Doubles as the accessible name when `iconOnly` |
| `href` | Required. An `https://`/`http://`/`mailto:` URL (opened in a new tab, `rel="noopener"`), **or** a site path `/…` (your `publish.base` is applied for you) |
| `icon` | One of `github`, `gitlab`, `npm`, `discord`, `slack`, `x`, `mastodon`, `rss`, `mail`, `book`, `home`, `star`, `download`, `external`. Monochrome — it follows the link color, so it follows your [theme](./customize.md) |
| `iconOnly` | Topbar only: show the icon alone (the label becomes its `aria-label`/tooltip). Ignored elsewhere |
| `publish` | `false` keeps the link **out** of [public builds](./publish/index.md) — same idea as `roots[].publish` |

- Everything is **validated when the config loads**: an unknown key, an unknown icon, a
  duplicate href or a `javascript:` URL throws immediately rather than shipping a broken
  — or booby-trapped — link into a published site.
- These links are *identity*, not review tooling: unlike Comments/Review/Journal they
  show in **dev and in public builds**. They never appear in the
  [print/PDF views](./pdf-export.md), and they are outside the search index.
- Keep the topbar to three or four entries — `iconOnly` exists precisely because that
  row is crowded. Long lists belong in the sidebar block or the footer.

## Custom home page

By default the landing page (`/`) shows the site name and one card per space. Point
`home` at a Markdown file to render **your own welcome** above those cards — the classic
move is a README-like intro written *for the site*, with relative links that become
routes:

```js
home: "docs/home.md",
```

- Full pipeline: Mermaid, code highlighting, and **inter-doc links rewritten** to site
  routes — link straight into your spaces (`[install](./guide/install.md)`).
- Best kept **outside** your spaces (a dedicated doc): inside a space it would *also*
  render as a normal page of that space.
- With [i18n](./multilingual.md), pass a per-locale map:
  `home: { en: "docs/home.md", fr: "docs/home.fr.md" }` — each locale's landing
  (`/`, `/fr`) renders its own file.
- This site's [home page](/notabene/) is exactly that — see
  [`docs/home.md`](https://github.com/z29k/notabene/blob/main/docs/home.md).

## Page footer: edit link & last-updated

Two zero-config touches under every doc page:

- **Last updated** — the page's git **author date** (one streamed `git log` per build;
  a `lastUpdated` frontmatter date overrides it; silently absent outside a git repo).
  Public builds also emit it as `article:modified_time`.
- **Edit this page** — set `editPattern` and every page links to its source:

```js
editPattern: "https://github.com/you/repo/edit/main/{path}",
```

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
