# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

notabene renders a repo's Markdown/MDX as a navigable site with Google-Docs-style
commenting, and ships a human↔agent review protocol that turns those comments into
edits. The viewer is the support; **the protocol (the review skill) is the product.**

Two installable pieces, one npm workspace:

- **`packages/renderer`** — the `@z29k/notabene` npm package: a generic Astro renderer
  + the `notabene` CLI (`init` / `dev` / `build` / `preview` / `pdf`, plus `doctor` /
  `status` / `stop` / `migrate` / `comments` / `journal`). Published to npm.
- **`packages/plugin`** — the Claude Code plugin. Its single skill
  (`skills/notabene/SKILL.md`) doubles as the agent-agnostic protocol spec.

## Commands

Everything runs against a **consumer repo** (see run-from-package model below), so the
CLI is never invoked bare in this repo. Develop and validate against a scratch consumer:

```bash
npm install                      # installs the renderer's deps (workspace root)

# Quality gates (run in packages/renderer — these are what CI enforces):
cd packages/renderer
npm test                         # Vitest — pure-logic unit tests (test/*.test.ts)
npm run lint                     # Biome — lint + format check on bin/src/test (JS/TS; .astro/.css excluded)
npm run format                   # Biome — apply formatting
NOTABENE_ROOT=/tmp/nb-scratch NOTABENE_CONFIG=/tmp/nb-scratch/notabene.config.mjs \
  npm run check                  # astro check — type-checks .astro + .ts (needs a consumer via env)

# Point the CLI at a throwaway consumer repo (run-from-package):
mkdir -p /tmp/nb-scratch/docs && printf '# Hi\n' > /tmp/nb-scratch/docs/index.md
node bin/notabene.mjs init --root /tmp/nb-scratch   # writes notabene.config.mjs + .notabene store
node bin/notabene.mjs dev   --root /tmp/nb-scratch   # review server → http://localhost:3009
node bin/notabene.mjs build --root /tmp/nb-scratch   # verification build — must complete with 0 errors
```

- **Tests are pure-logic** (`test/*.test.ts`, Vitest): anchoring/route resolution
  (`lib/client/comments-client`), the write-API guard (`lib/write-guard`), store-path
  anti-traversal (`lib/store-path`), the schema-version guard (`lib/store-meta`), link
  rewriting (`remark/rewrite-links`), nav humanization (`lib/nav`). Modules that load the
  consumer config or `astro:content` are covered via a fixture + stub wired in
  `vitest.config.ts`. Run a single file with `npx vitest run test/write-guard.test.ts`.
- **`build` output goes to a writable temp dir** (`os.tmpdir()/notabene/<hash>`), not the
  installed package — with a `node_modules` symlink beside it so the bundled server
  resolves deps (see `bin/notabene.mjs`). Nothing is written into the package.
- **CI** (`.github/workflows/ci.yml`, Node 22 + 24): lint → test → `astro check` → smoke
  `build` of a consumer whose `index.md` is deliberately GFM-hostile-to-MDX
  (`Promise<T>`, `<a@b.com>`, `{x}`, GFM table) to prove the lenient CommonMark path.
- **Test both formats** (`format: "mdx"` and `"commonmark"`) and both an EN config and a
  `locale: "fr"` config when touching UI strings or nav sorting.
- **Node ≥ 22.12, npm — not Bun.** The OSS target is npm/pnpm/Node; don't add Bun assumptions.

## Architecture: run-from-package

This is the load-bearing design decision and the reason paths flow through env vars.

The renderer is **not scaffolded into the consumer's repo**. It lives in the consumer's
`node_modules` and is *pointed at* the consumer repo at runtime. Only **data** lives in
the consumer: `notabene.config.mjs` + the `.notabene/` store + the docs themselves.

- `bin/notabene.mjs` resolves `--root` (consumer repo, default cwd) and `--config`, then
  spawns Astro with `--root <package dir>` while setting env vars `NOTABENE_ROOT` and
  `NOTABENE_CONFIG` (+ `NOTABENE_HOST` for `--host`). Build output goes to a gitignored
  `dist/` **inside the installed package**, not the consumer's tree.
- `src/config.mjs` is the **single source of file-layout truth** — the only place that
  knows the layout. It reads those env vars, loads the consumer's `notabene.config.mjs`
  by absolute path (top-level await), and resolves every path. **No hardcoded paths
  anywhere else.** `astro.config.mjs`, `content.config.ts`, the remark plugin, and the
  runtime libs all import from it. It is **server-only** (uses `node:path`/`url`); client
  scripts get `clientRoots` (a serialized, path-free subset) instead.
- Content is sourced from **outside** the Astro app: `content.config.ts` builds one Astro
  content collection per `roots[]` entry, with the glob `base` resolved against the
  consumer repo. Vite's `server.fs.allow` is widened to `REPO_ROOT` so it can serve that
  external content.

## Architecture: the `.notabene` store is a public data contract

The store (comments + journal, **one file per comment** at `<store>/<page>/<id>.json`
— schema v3 — plus `journal.json` and `meta.json`) is **committed in consumer repos and read
by agents**. Treat its shape as a public API:

- Versioned by a sidecar `<store>/meta.json` (`{ "schemaVersion": n }`, currently **3**).
  **Any shape change bumps `schemaVersion` and ships a migrator — never a silent
  mutation.** Types and `SCHEMA_VERSION` live in `src/lib/comment-types.ts`; the guard that
  refuses a store *newer* than the renderer is `src/lib/store-meta.ts` (called on every read).
- **Version ladder:** v1 (one array per page, `<store>/<page>.json`) → **v2** (one file per
  comment, `<store>/<page>/<id>.json` → conflict-free git merges) → **v3** (block-scoped
  comments on diagrams/images — see `BlockAnchor`). Readers stay **backward-compatible** with
  v1; any write migrates that page to the per-comment layout, and `notabene migrate` converts
  a whole store eagerly and stamps `schemaVersion` 3. `write()` never recurses into sub-page
  dirs when clearing a page.
- `src/lib/comments.ts` is the server-only I/O layer (dev-only). Writes are **atomic**
  (temp file + `rename`) so the agent never reads a truncated JSON; page paths/dirs are
  resolved + traversal-guarded by `src/lib/store-path.ts` (`resolveStorePath`/`resolveStoreDir`). Anchors use a W3C
  TextQuoteSelector (`quote` + `prefix`/`suffix` context + nearest `section` heading) —
  the prefix/suffix are load-bearing for re-anchoring rendered text back to source; the
  client capture side lives in `src/components/Comments.astro`. A **block-scoped** comment
  (`scope: "block"`, a whole diagram or image) uses a `BlockAnchor` (`kind: "mermaid"|"image"`
  + `key`/`label`) instead of a text-quote anchor. Browser-side comment helpers shared across
  the two comment UIs live in `src/lib/client/comments-client.ts`.
- A comment has `status: open|addressed|resolved` and `hold: boolean`. The agent
  processes only `open` **and not on hold**; held comments are the user's WIP. `addressed`
  is the two-phase-review state (see below): agent-proposed, awaiting human validation.
- Comment/reply **author** is a plain string carrying the per-device **identity** — name +
  optional **email** — composed git-style as `Name <email>` (`composeAuthor` in
  `comments-client.ts`; readers strip the email via `displayName`). Identity is set in a
  **modal dialog** (the header shows a chip that opens it), stored in `localStorage`.
  Resolution: `localStorage` name/email → config `author`/`authorEmail` → the repo's
  `git config user.name`/`user.email` (the CLI passes `NOTABENE_AUTHOR`/`NOTABENE_AUTHOR_EMAIL`)
  → `"you"`. **Identity gate:** on a non-loopback host (LAN via `--host`, or a deployed build)
  with no identity set, the dialog is forced before browsing, so comments attribute per person
  (client-side nudge — `isLoopbackHost` in `comments-client.ts`, wired in `DocLayout`).

## Architecture: the review loop (the product)

`packages/plugin/skills/notabene/SKILL.md` is the protocol. It is **file-I/O-first**: it
reads/writes `<store>/` files directly and requires **neither a running server nor a
port**. Everything (store path, doc spaces, post-edit checks) is discovered from
`notabene.config.mjs` — nothing is hardcoded. The loop: read open non-held comments →
locate source page via `roots[]` → resolve the text anchor tolerantly → edit faithfully
→ mark resolved + append a journal entry (linking `resolution.journalEntryId`) → verify
(**always** run the renderer build; then the consumer's `verify[]` checks) → report as a
table and **ask before committing**. Never bulk-delete the store; never commit unasked.

**Two-phase review** (`review: "approve"` in config; default `"auto"`). Instead of
resolving directly, the agent marks each comment `addressed` and a human validates at
`/review` (or the *To validate* filter on `/comments`) — both mount the shared
`src/lib/client/review-card.ts`. The card shows the **real git diff** of everything a
comment changed: `GET /api/diff?page=…` (dev-only, loopback-guarded, `git diff HEAD` via
`execFile`) diffs the page files, resolved by `src/lib/page-file.ts`; the comment→pages
mapping is the **inversion of the journal** (`GET /api/journal`), so a single comment can
surface a multi-page cascade. Approve → `resolved`; reject → `open` + the reason as a
reply (the agent re-reads it next pass). Diff renders unified/side-by-side
(`src/lib/client/diff.ts`, mode persisted in `localStorage`). `reviewMode` is exported
from `config.mjs` and injected to the client via `DocLayout` (`#notabene-review`).

## Architecture: PDF export

Static `src/pages/print/[...scope].astro` routes render a print-optimized, concatenated view
of a scope (whole doc / `space/<key>` / `folder/<key>/<path>` / `page/<key>/<id>`) — cover +
clickable TOC, via `PrintLayout` (no app chrome), styled by `src/styles/print.css` (forced
light; Mermaid forced light too, so dark-mode diagrams stay readable on white). Scope
parsing/ordering is the pure, unit-tested `src/lib/print-scope.ts`. Two ways to a PDF:

- **In-browser** (zero deps): the header **Export PDF** menu opens a `/print` route in a new
  tab and auto-triggers the browser's *Save as PDF* (`?autoprint=1`, handled by
  `src/lib/client/print.ts`). The routes are static → present in `dev` **and** the build (no
  write API → safe to deploy). Toggled by config `pdf.enabled`; page size/margin from
  `pdf.pageSize`/`pdf.margin`.
- **`notabene pdf`** (CLI): builds the site, serves it, and drives **headless Chromium via
  Puppeteer** (an **optional** `peerDependency`, lazy-required — falls back to `puppeteer-core`
  + a system Chrome) → a PDF with a real **bookmark outline** + running footer page numbers.
  Flags: `--scope`, `--locale`, `--out`, `--chrome`. `pagedjs` was evaluated and **removed** (client-side
  pagination hangs in a hidden tab and can't emit a real PDF outline — see the pdf-export memory).

## Architecture: content i18n (multi-language docs)

Optional (`i18n: { locales, defaultLocale, strategy }` in config). **Locale is DERIVED per
entry** — `roots[]` stay declared once. The pure resolver is `src/lib/i18n-content.mjs`
(**`.mjs`** so `config.mjs`/`rewrite-links.mjs` can import it): `decode(rawId, i18n)` →
`{ locale, id }` (canonical, locale-stripped), `routeFor` (default locale unprefixed `/docs/…`, others
`/<loc>/…`), `buildEquivalence`/`switchLinks`, `makeSuffixGenerateId`. Two authoring layouts:
`directory` (`docs/<loc>/…`) or `suffix` (`guide.md` + `guide.fr.md` — needs the custom
`generateId` because Astro's default slugger deletes the dot). One unified route
`src/pages/[...path].astro` (replaced `[space]/[...slug]`) emits exact prefixed paths;
`DocLayout` takes a per-page `locale` → `t()`/`<html lang>`/injected catalog + a language
switcher + `hreflang`. **The store `page` key is the raw locale-encoded id**, so comments are
locale-scoped with **no schema change** (page-file/store-path resolve it unchanged). Disabled
(one locale) → byte-identical to before. `buildNav(space, locale?)`, `makeRouteFor(roots,
i18n?)`, `parseScope(scope, locales)` all take the i18n arg OPT-IN so mono-language + tests
are unaffected. Search + print/PDF are per-locale (`/print/<loc>/…`, `notabene pdf --locale`).

**Per-locale space names.** A `root`'s own `label`/`description` (its space title + home-card
blurb — the only human-facing root strings) may be a plain string OR a `{ <locale>: string }`
map. The pure `localizeField(value, locale, defaultLocale)` (in `i18n-content.mjs`) resolves it
(exact locale → `defaultLocale` → first defined → undefined; a string is returned verbatim).
`config.mjs` keeps the RAW map on `root.labelI18n`/`descriptionI18n` and a **default-locale**
`root.label`/`description` string for locale-agnostic consumers (CLI `doctor`, the `key`
fallback — a `key` is NEVER slugged from a map). Server surfaces with a real per-page locale
resolve directly (Sidebar, `SpaceIndex`, `[...path]` breadcrumb/title, `print/[...scope]`);
locale-less pages (home, `404`, `/comments`) SSR the default locale with
`data-nb-root-label`/`-desc` hooks + carry the maps in `#notabene-roots` (`clientRoots`, **only
when i18n is enabled** → mono-language output byte-identical) so the client applier re-localizes
them. Declared once; no `.notabene` schema change.

**Per-locale site home.** The landing page (space cards) is a **real per-locale page**, NOT an
aggregate: `src/components/SiteHome.astro` renders it in one locale (sidebar nav tree + space
names + cards all server-rendered in that locale). The default-locale home is `/` (`index.astro`);
other locales are `/<locale>` (e.g. `/en`), emitted by the **site-home branch of
`[...path].astro`** (`isSiteHome`) — a bare-locale path, no collision with the rest route. The
language menu does a real navigation (`/` ↔ `/en`) + the same `#notabene-i18n-alts` head-redirect
as doc pages, so a visitor's `nb-locale` bounces `/` → `/en`. This replaced the old
`i18nClientChrome` home, whose sidebar was stuck in the default locale.

**Language preference (client-side).** The switcher records a preferred locale in
`localStorage` (`nb-locale`) — only the switcher changes it. On doc pages a `<head>` script
**redirects** to the preferred-locale equivalent when one exists (from the injected
`#notabene-i18n-alts`); a page with no such translation stays on the source language and
reveals a discreet banner (i18n key `pageNotTranslated`, injected per-locale). The remaining
**cross-locale aggregate** pages — `/comments`, `/journal`, `/review`, `404` (no single content
locale) — pass `i18nClientChrome` to `DocLayout`: it ships every locale's catalog (`#notabene-i18n-all`), a `<head>` script
picks `nb-locale` (→ `<html lang>` + swaps `#notabene-i18n` so client-rendered lists/dates
follow), and an applier re-localizes the static chrome (`[data-i18n]` / `-ph` / `-aria` /
`-date`, plus `data-nb-root-label`/`-desc` from `#notabene-roots`) and wires a client switcher
(sets `nb-locale` + reloads — no URL change). No server
locale state; disabled i18n → none of this ships.

## Safety model (keep it intact)

The comments API (`src/pages/api/comments.ts`) writes into the consumer's git, so:

- It only mutates under `astro dev` (`import.meta.env.DEV`; override `NOTABENE_ALLOW_WRITE=1`).
  In build/preview, writes return `403` — the write path is not in the deployable artifact.
- Binds **loopback** (`127.0.0.1`) by default. LAN exposure is explicit opt-in only
  (`host: true`, `NOTABENE_HOST=1`, or `--host`) and for trusted networks.
- Beyond the bind, every mutating request is gated by `src/lib/write-guard.ts` (pure,
  unit-tested): rejects cross-origin writes (anti-CSRF), non-loopback `Host` in loopback
  mode (anti-DNS-rebinding), and — when `NOTABENE_TOKEN` is set (recommended with
  `--host`) — a missing/invalid `x-notabene-token` (the client sends it from
  `localStorage`, never embedded in HTML).

## Conventions

- **MDX-safety.** `format` toggles the pipeline: `"mdx"` (default) globs `.md`+`.mdx`,
  loads the MDX integration, parses `.mdx` **strict** (JSX/expressions) and `.md`
  **lenient** CommonMark/GFM; `"commonmark"` globs `.md`+`.markdown` with MDX **not**
  loaded. In `.mdx` files, never introduce stray `{` or `<` outside code fences. `.md` is
  lenient. Enforced by the build.
- **English** for code, comments, and default UI. UI strings live in `src/i18n.mjs` (EN
  is the source of truth; other locales fall back to it). Add a language by adding a
  top-level key there — never hardcode a user-visible string. Nav sorting collates by `locale`.
- Inter-doc relative `.md`/`.mdx` links are rewritten to site routes by
  `src/remark/rewrite-links.mjs` (mapping derived from `roots[]`; most-specific root wins).
  The same longest-path-first rule governs `routeForPage` in `config.mjs`.
- **Sidebar labels & order are frontmatter-driven** (`src/lib/nav.ts`, all resolution is
  pure + unit-tested). A page's leaf label resolves `sidebar.label` → `title` → humanized
  file name; `sidebar.order` sorts siblings ascending (unset → `±Infinity` sentinels, i.e.
  the pre-frontmatter alphabetical order, so no-frontmatter output is unchanged). Groups and
  pages share one ordering. A **folder** is labeled/ordered by its landing page — Astro
  collapses `<folder>/index.md` to the id `<folder>` (kept as `<folder>/readme.md`
  otherwise); `assembleNav` folds it into a single group with an *Overview* child (no
  duplicate sibling leaf) and `liftGroup`s its frontmatter. That child's label is the
  **localized** `navOverview` (`t(locale)`, passed by `buildNav`) — FR *Aperçu* — overridable
  per page via `sidebar.indexLabel`. `folderLabels()` mirrors the same
  rule so breadcrumbs (`[...path].astro`) + PDF covers (`print/[...scope].astro`) stay in
  sync. `pageTitle`/search-index also prefer frontmatter `title`. **No config knob, no
  `.notabene` schema change** — labels/order never touch page ids or store keys.
- Keep the `.notabene` contract and the CLI surface stable; call out changes to either
  explicitly in PRs.
