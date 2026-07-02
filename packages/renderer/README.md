# notabene

**Comment your docs like Google Docs — then let your AI coding agent apply the
feedback, resolve the threads, and journal *what changed and why*.**

notabene renders your repo's Markdown/MDX as a navigable site with
**Google-Docs-style commenting**, and ships the **human↔agent review protocol**
that turns those comments into edits. The viewer is the support; **the protocol is
the product.**

> *nota bene* — the margin mark that means "note this." A comment.

**MIT** · Node ≥ 22.12 · MDX **and** CommonMark/GFM · dev-local, zero backend ·
_pre-1.0, dogfooded on a real multi-service platform._

---

## Why

Doc review today is scattered across PR line-comments, chat threads, and "can you
fix the wording in section 3." The feedback is disconnected from the doc, and
applying it is manual and lossy.

notabene puts the comments **on the rendered doc**, stores them **in your git**
(no SaaS, no database), and closes the loop: your agent reads the comments, edits
the docs, marks them resolved, and writes a journal entry linking *what changed* to
*why*.

- **Stateless tool, data in your git.** Comments and journal are JSON files under
  `.notabene/`. They travel with your repo, diff in PRs, and are readable by your
  agent. No account, no server to deploy, no central state.
- **Agent-native.** The review loop ships as a Claude Code skill — and as a
  plain-text protocol any agent can follow.
- **MDX *and* CommonMark/GFM.** Point it at `.md` (lenient) or `.mdx` (strict), or
  mix them — selectable via config.
- **Dev-local & safe by default.** The write API only runs under `notabene dev`,
  binds loopback (`127.0.0.1`) by default, and never ships in a build.

## How it works (30 seconds)

1. `npx notabene dev` → open the site, **select any text → leave a comment** (or
   comment a whole page). Threads, resolve, hold, a global `/comments` view.
2. Tell your agent: **"address the doc comments."**
3. The agent reads `.notabene/`, edits the docs faithfully, marks each comment
   **resolved**, and appends a **journal** entry (what / why / which comments).
4. Read the trail at `/journal`.

> 📽️ _Live in 30s — run `npx notabene dev` and select some text. (Demo GIF coming.)_

## Install

notabene is **two installable pieces**: the **renderer** (an npm package + CLI) and
the **review skill** (a Claude Code plugin). Install one or both.

### 1 · The renderer — npm package

```bash
npm install -D @z29k/notabene   # or: pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # writes notabene.config.mjs + creates the .notabene store
npx notabene dev                # → http://localhost:3009
```

> The npm package is scoped (`@z29k/notabene`); the CLI command it installs is
> just **`notabene`**, so `npx notabene …` works as-is.

`init` is the **only** thing that touches your repo — it writes `notabene.config.mjs`
and creates the `.notabene/` store. The renderer itself **runs from the package**
(nothing is scaffolded or copied into your repo; upgrades are just `npm update`).

CLI:

| Command | What it does |
| --- | --- |
| `notabene init` | Write `notabene.config.mjs` + create the store (no-op if present) |
| `notabene dev` | Start the review server over this repo's docs (live-reload) |
| `notabene build` | Build the site (Node standalone; docs prerendered, no write API in the artifact) |
| `notabene preview` | Serve the built site |

Flags: `--port <n>` · `--config <path>` · `--root <path>` · `--host` (expose on the
LAN — trusted networks only).

### 2 · The review skill — Claude Code plugin

In Claude Code:

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

Then just say **"address the doc comments"** (or *"review the docs"*, *"apply the
review feedback"*). The skill reads your `notabene.config.mjs`, processes the `open`
(non-held) comments, edits the docs, marks them resolved, appends the journal, and
runs your `verify` checks — never committing without asking.

Prefer manual install? Copy `packages/plugin/skills/notabene/` into your project's
`.claude/skills/`. Using another agent? The skill file **is** the protocol spec —
point your agent at it.

## Configure

`notabene.config.mjs` at your repo root is the only wiring. Paths are repo-relative.

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
  host: false,               // loopback only — the write API edits your git
  verify: [],                // consumer checks your agent runs after editing
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

## MDX and CommonMark/GFM

The renderer picks the processor **by file extension**:

- **`.md`** → CommonMark/GFM, **lenient**. `<email@x>`, `Promise<T>`, `{var}`, raw
  HTML and GFM tables all render without a crash.
- **`.mdx`** → **strict** MDX (JSX/expressions) — importable components, but `<`/`{`
  outside code fences must be escaped.

`format: "mdx"` (default) enables both, mixable in one repo. `format: "commonmark"`
drops the MDX dependency entirely — best for a plain-Markdown repo.

> Note: the config **default** is `"mdx"` (omit the key to get it), but `notabene init`
> scaffolds `"commonmark"` — the safe, zero-dependency, most-lenient starting point.

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

## Why not Starlight / Docusaurus / Google Docs?

- **Starlight / Docusaurus** render docs beautifully — but there's no commenting and
  no review loop.
- **Google Docs** has commenting — but your docs aren't in Google Docs. They're in
  your repo, in Markdown, next to your code, in your PRs.
- **notabene** is the missing middle: review your **repo's** docs in the browser,
  keep **everything in git**, and let your **agent** close the loop.

## Safety

The comments API writes into your git. So:

- It **only runs under `notabene dev`** — it is not part of a build artifact
  (writes return `403` outside dev).
- It **binds loopback by default** — not reachable from your network unless you opt
  in with `--host` / `NOTABENE_HOST=1` on a trusted network.
- **Every write is gated** beyond the bind: cross-origin requests are refused
  (anti-CSRF), a non-loopback `Host` is refused in loopback mode (anti-DNS-rebinding),
  and — when you set `NOTABENE_TOKEN` — each write must carry a matching
  `x-notabene-token`. Setting a token is **recommended when you use `--host`**.
- The agent skill **never commits without asking** and **never bulk-deletes** the
  store.

## Repo layout

- **`packages/renderer`** — the `notabene` npm package (Astro renderer + CLI).
- **`packages/plugin`** — the Claude Code plugin (the review skill).

## Status & roadmap

Pre-1.0 and **dogfooded on a real multi-service platform** before this release.
Positioned as a **Claude Code companion** today; the protocol is agent-agnostic by
design. Feedback and issues welcome.

## License

[MIT](./LICENSE).
