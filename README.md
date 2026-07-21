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

<p align="center">
  MDX <strong>and</strong> CommonMark/GFM · Mermaid diagrams · PDF export · dev-local · zero backend · responsive · <strong>your data stays in git</strong>
</p>

<p align="center"><strong>English</strong> · <a href="https://github.com/z29k/notabene/blob/main/README.fr.md">Français</a></p>

---

**Iterate on your docs with an LLM - leave feedback anywhere, not squeezed into one prompt.**
A navigable doc site with multi-user comments, self-hosted in your git - no SaaS.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="notabene demo: comment a passage, the agent applies the edit, you approve the real diff" width="900" />
</p>

## Why

Fixing or writing docs with an AI agent means turning every change into prose: quote the
passage, name the section - *"can you fix the wording in section 3"* - then hope the agent
re-finds the exact spot in the source. Past a couple of changes it's a wall of instructions,
and the whole exchange lives in one chat input, back and forth. The real instruction was
always simpler: *this passage - change it like so.*

notabene makes that the interface. Select the exact text on the rendered page - or a whole
diagram or image - and leave a comment right there. The anchored comment **is** the
instruction: located, unambiguous, nothing to quote. The agent reads the comments, edits the
source faithfully, marks each resolved, and journals *what changed & why* - as a Claude Code
skill, or a plain-text protocol any agent can follow.

That core loop pulled the rest in:

- **A shared comment layer.** Several people annotate the same docs - threads, resolve, hold,
  a global `/comments` view - so it's no longer one person prompting alone.
- **A real, navigable doc site.** Your whole repo's Markdown/MDX, rendered and browsable - MDX
  *and* CommonMark/GFM, commentable Mermaid diagrams, PDF export, phone-ready - not one file at
  a time.
- **Self-hosted, in your git.** No SaaS, no database, no extra tooling to run. Comments and
  journal are JSON under `.notabene/` that travel with the repo and diff in PRs; the write API
  is dev-local and loopback by default.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-mobile-demo.gif" alt="notabene on a phone: touch-select a passage, the action bar docks at the bottom, leave a comment" width="300" />
</p>

<p align="center"><em>Same loop on a phone - touch-select, comment from the docked bar; nav and anchored comments as sheets.</em></p>

## How it works (30 seconds)

1. `npx notabene dev` → open the site, **select any text → leave a comment** (or comment a
   whole page, or a whole **diagram/image**). Threads, resolve, hold, a global `/comments` view.
2. Tell your agent: **"address the doc comments."**
3. The agent reads `.notabene/`, edits the docs faithfully, marks each comment
   **resolved**, and appends a **journal** entry (what / why / which comments).
4. Read the trail at `/journal`.

> 📽️ _That's the clip above - comment a passage, the agent proposes the edit, you approve the real diff._

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-diagrams-demo.gif" alt="notabene: click a Mermaid diagram to enlarge it in a lightbox, then comment the whole diagram - the comment lands in the right rail" width="820" />
</p>

<p align="center"><em>Diagrams are first-class - render <strong>Mermaid</strong>, <strong>enlarge</strong> any diagram or image, and <strong>comment the whole block</strong> (it lands in the rail like a text comment).</em></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-pdf-demo.gif" alt="notabene: open the Export PDF menu, pick a scope, and get a print-ready view with a cover and a clickable table of contents" width="820" />
</p>

<p align="center"><em>Export any scope to PDF - a <strong>page</strong>, <strong>section</strong>, <strong>space</strong>, or the <strong>whole doc</strong> - into a print-ready view with a cover and a clickable table of contents (→ your browser's <em>Save as PDF</em>, or <code>notabene pdf</code> for a bookmarked file).</em></p>

## Install

notabene is **two installable pieces**: the **renderer** (an npm package + CLI) and
the **Claude Code plugin** (turnkey setup + the review loop). Install one or both.

### 1 · The renderer - npm package

```bash
npm install -D @z29k/notabene   # or: pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # writes notabene.config.mjs + creates the .notabene store
npx notabene dev                # → http://localhost:3009
```

> The npm package is scoped (`@z29k/notabene`); the CLI command it installs is
> just **`notabene`**, so `npx notabene …` works as-is.

`init` is the **only** thing that touches your repo - it writes `notabene.config.mjs`
and creates the `.notabene/` store. The renderer itself **runs from the package**
(nothing is scaffolded or copied into your repo; upgrades are just `npm update`).

CLI:

| Command | What it does |
| --- | --- |
| `notabene doctor` | Read-only state as JSON: config/store/port + detected doc folders - `--json` |
| `notabene init` | Write `notabene.config.mjs` + create the store (no-op if present); `--detect` auto-detects doc folders |
| `notabene dev` | Start the review server over this repo's docs (live-reload); `--detach` runs it as a background daemon |
| `notabene status` | Is the detached server running? (pid, port, URL) - `--json` |
| `notabene stop` | Stop the detached server |
| `notabene build` | Build the site (Node standalone; docs prerendered, no write API in the artifact) |
| `notabene preview` | Serve the built site |
| `notabene pdf` | Export a PDF via headless Chromium (real bookmark outline + page numbers); `--scope doc\|space:K\|folder:K/P\|page:K/I`, `--locale`, `--out`, `--chrome`. Needs the optional `puppeteer` peer dep (or `puppeteer-core` + `--chrome`) |
| `notabene migrate` | Convert the store to the one-file-per-comment layout (stamps `schemaVersion` 3) |
| `notabene comments ls` | List comments - `--open` `--json` `--page <p>` (for agents/scripts) |
| `notabene journal add` | Append a JSON journal entry read from stdin |

Flags: `--port <n>` · `--detach` (dev: background daemon) · `--detect` (init: auto-detect
roots) · `--scope`/`--out`/`--chrome` (pdf) · `--config <path>` · `--root <path>` · `--host`
(expose on the LAN - trusted networks only).

### 2 · The Claude Code plugin - setup + review

In Claude Code:

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

On a fresh repo, say **"set up notabene"** first - the plugin writes
`notabene.config.mjs`, creates the store, and starts the review server for you
(also via `/notabene:setup` · `/notabene:dev` · `/notabene:status` · `/notabene:stop`).
It works on **any stack** (Rust/Python/Go/JS) - no toolchain to install. See
[`packages/plugin/README.md`](packages/plugin/README.md).

Then say **"address the doc comments"** (or *"review the docs"*, *"apply the
review feedback"*). The skill reads your `notabene.config.mjs`, processes the `open`
(non-held) comments, edits the docs, marks them resolved, appends the journal, and
runs your `verify` checks - never committing without asking.

Prefer manual install? Copy `packages/plugin/skills/notabene/` into your project's
`.claude/skills/`. Using another agent? The skill file **is** the protocol spec -
point your agent at it.

## Configure

`notabene.config.mjs` at your repo root is the only wiring. Paths are repo-relative.
(`notabene init` scaffolds a template; `notabene init --detect` prefills `roots[]` from the
doc folders it finds.)

```js
// notabene.config.mjs
export default {
  siteName: "My Project",
  tagline: "docs",
  locale: "en",

  // Input format. "mdx": .mdx STRICT + .md CommonMark/GFM lenient (mix by extension).
  // "commonmark": everything CommonMark/GFM, no MDX dependency/strictness.
  format: "commonmark",

  // Doc spaces. `key` = url slug + store space; `path` = repo-relative folder.
  roots: [
    { key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] },
  ],

  store: "docs/.notabene",   // comments + journal (commit this folder)
  port: 3009,
  host: false,               // loopback only - the write API edits your git
  verify: [],                // consumer checks your agent runs after editing
  review: "auto",            // "auto" (agent resolves) | "approve" (you validate - see below)

  // author: "Alex", authorEmail: "alex@x.io",  // comment identity default (else git user.name / user.email)
  // pdf: { enabled: true, pageSize: "A4", margin: "18mm" },  // PDF export (Export menu + /print)
};
```

| Key | Default | Meaning |
| --- | --- | --- |
| `siteName` / `tagline` | `"Docs"` / `"docs"` | Header brand |
| `locale` | `"en"` | UI language + nav sort collation |
| `format` | `"mdx"` | `"mdx"` or `"commonmark"` (see below) |
| `roots[]` | `[{docs}]` | Doc spaces: `{ key, label, path, exclude, description }` |
| `store` | `"docs/.notabene"` | Comments + journal folder |
| `port` | `3009` | `astro dev` port |
| `host` | `false` | `true`/`NOTABENE_HOST=1`/`--host` exposes the write API to the LAN |
| `verify[]` | `[]` | Post-edit checks the agent runs (the renderer build always runs) |
| `review` | `"auto"` | `"auto"` = agent resolves comments; `"approve"` = agent proposes (`addressed`), you validate each at `/review` with a diff |
| `author` | git `user.name` | Default comment author; each browser overrides it per-device via the **identity dialog** (name + optional email) |
| `authorEmail` | git `user.email` | Default author email; embedded git-style (`Name <email>`) so identities stay unique |
| `pdf` | `{ enabled: true, pageSize: "A4", margin: "18mm" }` | PDF export — `enabled` toggles the Export menu + `/print` routes; `pageSize`/`margin` set the `@page` box |
| `i18n` | — | Multi-language docs: `{ locales, defaultLocale, strategy: "directory"\|"suffix" }` (see below). Omit for one language |

### Sidebar labels & ordering

By default a page's sidebar entry is its **humanized file name** and siblings sort
alphabetically. Override either per page with frontmatter — so you don't have to prefix file
names with numbers:

```yaml
---
title: Cartographie du réseau interne   # page <title> + breadcrumb (overrides the H1)
sidebar:
  label: Cartographie                   # sidebar text (else title, else file name)
  order: 9                              # position among siblings (ascending)
---
```

- `order` sorts ascending; entries **without** an `order` keep sorting alphabetically,
  after the ordered ones. Groups and pages share one ordering, so a numbered folder slots
  into the numbered page sequence.
- A **folder** is named and positioned by its landing page — `<folder>/index.md` (or
  `<folder>/readme.md`) — whose `sidebar` frontmatter applies to the whole group. That page
  shows as a localized *Overview* entry inside the group; rename it with `sidebar.indexLabel`.
- These labels flow through to breadcrumbs and PDF export as well.

## Two-phase review (optional)

By default the agent resolves comments directly. Set `review: "approve"` for a
**human-in-the-loop** loop: the agent edits and marks each comment **`addressed`** instead
of resolved, then you validate at **`/review`** (or the *To validate* filter on
`/comments`). You see the **real git diff** of everything that changed for a comment -
**cascades included** (one comment can touch several pages) - and **approve** (→ resolved)
or **reject** (→ reopened, with your reason, which the agent reads on its next pass). The
diff renders **unified or side-by-side**, and a **Review** badge in the header counts
what's waiting.

## MDX and CommonMark/GFM

The renderer picks the processor **by file extension**:

- **`.md`** → CommonMark/GFM, **lenient**. `<email@x>`, `Promise<T>`, `{var}`, raw
  HTML and GFM tables all render without a crash.
- **`.mdx`** → **strict** MDX (JSX/expressions) - importable components, but `<`/`{`
  outside code fences must be escaped.

`format: "mdx"` (default) enables both, mixable in one repo. `format: "commonmark"`
drops the MDX dependency entirely - best for a plain-Markdown repo.

> Note: the config **default** is `"mdx"` (omit the key to get it), but `notabene init`
> scaffolds `"commonmark"` - the safe, zero-dependency, most-lenient starting point.

## Multi-language docs (i18n)

Add `i18n` to serve the same docs in several languages with **clean prefixed URLs** (the
default locale unprefixed, others `/<locale>/…`), a **language switcher** (a dropdown in the
header, next to Export), `hreflang` alternates, and per-page chrome (a French page renders
French nav/buttons/dates).

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-i18n-demo.gif" alt="notabene i18n: open the header language switcher, pick Français - the docs and chrome turn French, aggregate pages follow the language, and a page with no translation shows a discreet fallback banner" width="820" />
</p>

<p align="center"><em>Pick a language from the header switcher - docs <strong>and</strong> chrome switch, aggregate pages (comments, journal…) follow, and an untranslated page falls back with a banner.</em></p>

```js
i18n: { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory" },
```

Pick how you lay out the files with `strategy`:

- **`directory`** (the default) — a folder per locale: `docs/en/guide.md` · `docs/fr/guide.md`.
- **`suffix`** — one tree, translated per file: `docs/guide.md` (default) · `docs/guide.fr.md`.
  Best for adding languages to an **existing** doc: the default-language files don't move,
  so their URLs *and* their comment threads are preserved.

**Language preference & redirect.** The switcher records the visitor's chosen language; from
then on, landing on a page written in another language that *has* a translation **redirects**
to it — so following any link keeps you in your language. A page with **no** translation
falls back to the source language and shows a discreet banner ("not available in your
language yet"). The pages that aren't tied to a content language — `/comments`, `/journal`,
`/review`, the **home page** and **404** — follow your current language too (chrome + dates,
resolved client-side, no URL change) and carry the same switcher.

Comments are **per language** (a comment on the FR page is its own thread). Search and PDF
export (`notabene pdf --locale fr`) are scoped to one language. Omit `i18n` for a single
language — behavior is unchanged.

## The `.notabene` contract

The store is a **versioned contract** (`<store>/meta.json` → `schemaVersion`), so
your data stays portable and diffable. A comment:

```jsonc
{ "id", "space", "page", "scope",
  "anchor": { "quote", "prefix", "suffix", "section" } | null,   // text-quote anchor
  "thread": [{ "author", "body", "ts" }],
  "status": "open" | "addressed" | "resolved",
  "hold": false,                                                 // agent skips held comments
  "resolution": { "note", "journalEntryId"? } | null,
  "createdAt", "updatedAt" }
```

A journal entry: `{ id, date, title, summary, changes[] { page, commentIds[], what, why } }`.

> The `anchor` shown is a text-quote selector; a **block-scoped** comment (a whole diagram or
> image) carries a block anchor instead. `thread[].author` is a plain string that may be
> git-style **`Name <email>`** — split on the trailing `<…>` for the display name.

## Read it. Comment it. Ship it.

Point notabene at your repo and you get three things in one tool:

- **Read** your whole repo's docs as a real, navigable site - nav, spaces & folders,
  rewritten inter-doc links, search, Mermaid diagrams, dark mode, PDF export, multi-language.
- **Comment** any passage - or a whole diagram or image - right on the rendered page,
  Google-Docs-style.
- **Ship the edits** - your agent reads the comments, applies them, resolves the threads, and
  journals *what changed & why*. Comments and journal are **plain JSON committed in your git**
  (no SaaS, no database), and the review protocol is **file-I/O-first**: no running server, no
  port, no MCP - any agent can follow it.

The viewer is the support, the protocol is the product: a **repo-wide navigable doc site + a
git-native comment store + a serverless agent review protocol**, self-hosted from your own
`node_modules`.

## Safety

The comments API writes into your git. So:

- It **only runs under `notabene dev`** - it is not part of a build artifact
  (writes return `403` outside dev).
- It **binds loopback by default** - not reachable from your network unless you opt
  in with `--host` / `NOTABENE_HOST=1` on a trusted network.
- **Every write is gated** beyond the bind: cross-origin requests are refused
  (anti-CSRF), a non-loopback `Host` is refused in loopback mode (anti-DNS-rebinding),
  and - when you set `NOTABENE_TOKEN` - each write must carry a matching
  `x-notabene-token`. Setting a token is **recommended when you use `--host`**.
- The agent skill **never commits without asking** and **never bulk-deletes** the
  store.
- On a **non-loopback host** (LAN via `--host`, or a deployed build), each visitor is asked
  to set their **identity** (name + optional email) before browsing, so comments are
  attributed to a real person rather than the repo owner's git default.

## Repo layout

- **`packages/renderer`** - the `notabene` npm package (Astro renderer + CLI).
- **`packages/plugin`** - the Claude Code plugin (the review skill).

## License

[MIT](./LICENSE).
