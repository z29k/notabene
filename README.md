<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-logo.jpg" width="150" alt="notabene - logo" />
</p>

<h1 align="center">notabene</h1>

<p align="center"><em>nota bene</em> - the margin mark that means <strong>“note this well.”</strong></p>

<p align="center">
  <strong>Leave notes in the margins of your repo's docs - right on the rendered page -<br />
  then let your AI agent apply them, resolve the threads, and journal <em>what changed &amp; why</em>.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@z29k/notabene"><img alt="npm" src="https://img.shields.io/npm/v/@z29k/notabene?logo=npm&amp;color=cb3837" /></a>
  <a href="https://github.com/z29k/notabene/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/z29k/notabene/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Node ≥ 22.12" src="https://img.shields.io/node/v/@z29k/notabene?logo=node.js&amp;color=5FA04E" />
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/npm/l/@z29k/notabene?color=3da638" /></a>
</p>

<p align="center"><strong>English</strong> · <a href="https://github.com/z29k/notabene/blob/main/README.fr.md">Français</a> · <a href="https://z29k.github.io/notabene/">📖 Documentation</a></p>

---

**Iterate on your docs with an LLM - leave feedback anywhere, not squeezed into one prompt.**
A navigable doc site with multi-user comments, self-hosted in your git - no SaaS, no
database. The anchored comment **is** the instruction: located, unambiguous, nothing to
quote. Your agent reads it, edits the source, and journals *what changed & why*.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="notabene demo: comment a passage, the agent applies the edit, you approve the real diff" width="900" />
</p>

## How it works (30 seconds)

1. `npx notabene dev` → open the site, **select any text → leave a comment** (or comment a
   whole page, diagram or image).
2. Tell your agent: **"address the doc comments."**
3. The agent reads `.notabene/`, edits the docs faithfully, marks each comment
   **resolved**, and appends a **journal** entry (what / why / which comments).
4. Read the trail at `/journal` - or validate each **real git diff** yourself in
   [approve mode](https://z29k.github.io/notabene/guide/review-loop).

## Try it

```bash
npm install -D @z29k/notabene   # or pnpm / bun
npx notabene init               # writes the config, the .notabene store + the agent protocol
npx notabene dev                # → http://localhost:3009
```

Using Claude Code? `/plugin marketplace add z29k/notabene` then
`/plugin install notabene@z29k` - and just say *"set up notabene"*.
→ [Full install guide](https://z29k.github.io/notabene/guide/install)

## Features

Each one is a link into the [documentation](https://z29k.github.io/notabene/) - go deep
only where you're curious:

- **[Anchored comments](https://z29k.github.io/notabene/guide/first-review)** - select
  text on the rendered page, or comment a whole page, **diagram or image**. Threads,
  resolve, hold, a global `/comments` view, touch-first on mobile.
- **[The agent review loop](https://z29k.github.io/notabene/guide/review-loop)** - a
  file-I/O-first protocol any agent can follow (no server, no port, no MCP). Ships as a
  Claude Code skill; the skill file *is* the spec.
- **[Two-phase review](https://z29k.github.io/notabene/guide/review-loop)** - approve
  mode: the agent proposes, you validate each edit against its **real git diff**
  (cascades included) at `/review`.
- **[A real doc site](https://z29k.github.io/notabene/guide/configuration)** - spaces,
  frontmatter-driven sidebar, search, commentable **Mermaid** diagrams with a pan/zoom
  lightbox, a light/dark toggle, responsive.
- **[MDX *and* CommonMark/GFM](https://z29k.github.io/notabene/guide/configuration)** -
  lenient `.md`, strict `.mdx`, mixable per extension.
- **[Multi-language docs](https://z29k.github.io/notabene/guide/multilingual)** - clean
  prefixed URLs, a language switcher, per-language comments, EN/FR/… .
- **[PDF export](https://z29k.github.io/notabene/guide/pdf-export)** - any page, folder,
  space or the whole doc: cover + clickable TOC in the browser, or a **bookmarked PDF**
  via `notabene pdf`.
- **[Make it yours](https://z29k.github.io/notabene/guide/customize)** - a custom
  [home page](https://z29k.github.io/notabene/guide/configuration#custom-home-page),
  logo + favicon + social card, and theming via stable `--nb-*` design tokens or your
  own stylesheet (cascade-layer-safe: your CSS always wins).
- **[Publish a public site](https://z29k.github.io/notabene/guide/publish)** - a
  read-only static build with an **agent-readable surface** (`llms.txt`, per-page
  Markdown twins, sitemap, OpenGraph), private-content scoping, optional **full-text
  search** (Pagefind: per-language stemming, highlighted excerpts — in the dev app
  too), GitHub Pages workflow included. The [documentation site](https://z29k.github.io/notabene/) is
  notabene publishing itself.
- **[Link validation](https://z29k.github.io/notabene/reference/cli)** - `notabene lint`
  checks every internal link against the routes the last build **actually emitted** -
  dead links with did-you-mean suggestions, plus public→private leaks after
  `build --public`.
- **[A git-native store](https://z29k.github.io/notabene/reference/store-contract)** -
  comments + journal as versioned JSON in your repo: diffs in PRs, conflict-free merges,
  a schema agents can rely on.
- **[Safe by default](https://z29k.github.io/notabene/reference/safety)** - the write API
  is dev-only, loopback-bound, CSRF/rebinding-gated; public builds contain none of it.

## Repo layout

- **`packages/renderer`** - the `@z29k/notabene` npm package (Astro renderer + CLI).
- **`packages/claude-plugin`** - the Claude Code plugin (setup + the review skill/protocol).
- **`docs/`** - this documentation, reviewed and published by notabene itself.

## License

[MIT](./LICENSE)
