<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-logo.jpg" width="150" alt="notabene - an ink bottle stamped N.B." />
</p>

<h1 align="center">notabene</h1>

<p align="center"><em>nota bene</em> - the margin mark that means <strong>“note this well.”</strong></p>

<p align="center">
  <strong>Leave notes in the margins of your repo's docs - right on the rendered page -<br />
  then let your AI agent apply them, resolve the threads, and journal <em>what changed &amp; why</em>.</strong>
</p>

<p align="center">
  <a href="https://z29k.github.io/notabene/">📖 Documentation</a> ·
  <a href="https://github.com/z29k/notabene">GitHub</a>
</p>

---

**notabene renders your repo's Markdown/MDX as a navigable site with review comments right
on the page, and ships the human↔agent review protocol that turns those comments into
edits.** Comments and journal are plain JSON committed in your git - no SaaS, no database;
the viewer is the support, the protocol is the product.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="notabene demo: comment a passage, the agent applies the edit, you approve the real diff" width="820" />
</p>

## Install

```bash
npm install -D @z29k/notabene   # or: pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # writes the config, the .notabene store + the agent protocol
npx notabene dev                # → http://localhost:3009
```

`init` is the only thing that touches your repo - the renderer **runs from the package**
(nothing scaffolded, upgrades are `npm update`). Then comment the rendered docs and tell
your agent to *"address the doc comments"* - the review loop ships as a
[Claude Code plugin](https://github.com/z29k/notabene#readme) and as a plain-text
protocol `init` installs in your repo (`<store>/protocol.md` + an `AGENTS.md` pointer),
so any agent can follow it.

## Features

Every entry links into the [documentation](https://z29k.github.io/notabene/):

- [Anchored comments](https://z29k.github.io/notabene/guide/first-review) - text
  selections, whole pages, diagrams & images; threads, hold, `/comments`.
- [The agent review loop](https://z29k.github.io/notabene/guide/review-loop) -
  file-I/O-first protocol; optional **approve mode** with real git diffs at `/review`.
- [A real doc site](https://z29k.github.io/notabene/guide/configuration) - spaces,
  frontmatter sidebar, search, commentable Mermaid, light/dark toggle, responsive.
- [MDX and CommonMark/GFM](https://z29k.github.io/notabene/guide/configuration) - lenient
  `.md`, strict `.mdx`, mixable.
- [Multi-language docs](https://z29k.github.io/notabene/guide/multilingual) - clean
  prefixed URLs, switcher, per-language comments.
- [PDF export](https://z29k.github.io/notabene/guide/pdf-export) - print views in the
  browser, bookmarked PDFs via `notabene pdf`.
- [Make it yours](https://z29k.github.io/notabene/guide/customize) - custom home page,
  logo/favicon/social card, navigation links (topbar, sidebar, footer), theming via
  `--nb-*` design tokens, fonts, a code theme, or your own stylesheet.
- [Publish a public site](https://z29k.github.io/notabene/guide/publish) - read-only
  static build with `llms.txt` + Markdown twins, private-content scoping, optional
  full-text search (Pagefind, in the dev app too), GitHub Pages workflow.
- [Link validation](https://z29k.github.io/notabene/reference/cli) - `notabene lint`
  checks internal links against the last build's real routes (did-you-mean suggestions,
  public→private leaks).
- [The `.notabene` store contract](https://z29k.github.io/notabene/reference/store-contract)
  and the [safety model](https://z29k.github.io/notabene/reference/safety).

The full CLI (build, pdf, lint, status, migrate, comments, journal…) is in the
[CLI reference](https://z29k.github.io/notabene/reference/cli).

## Requirements

**Node ≥ 22.12**, npm/pnpm/bun. Optional peer dependencies: `puppeteer` for
`notabene pdf`, `pagefind` for full-text search (dev app + `build --public`).

## License

[MIT](https://github.com/z29k/notabene/blob/main/LICENSE)
