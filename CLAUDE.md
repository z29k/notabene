# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

notabene renders a repo's Markdown/MDX as a navigable site with Google-Docs-style
commenting, and ships a human↔agent review protocol that turns those comments into
edits. The viewer is the support; **the protocol (the review skill) is the product.**

Two installable pieces, one npm workspace:

- **`packages/renderer`** — the `@z29k/notabene` npm package: a generic Astro renderer
  + the `notabene` CLI (`init` / `dev` / `build` / `preview`). Published to npm.
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

The store (comments + journal, one JSON file per page at `<store>/<page>.json`, plus
`journal.json` and `meta.json`) is **committed in consumer repos and read by agents**.
Treat its shape as a public API:

- Versioned by a sidecar `<store>/meta.json` (`{ "schemaVersion": n }`). **Any shape
  change bumps `schemaVersion` and ships a migrator — never a silent mutation.** Types
  and `SCHEMA_VERSION` live in `src/lib/comment-types.ts`; the guard that refuses a store
  newer than the renderer is `src/lib/store-meta.ts` (called on every store read).
- `src/lib/comments.ts` is the server-only I/O layer (dev-only). Writes are **atomic**
  (temp file + `rename`) so the agent never reads a truncated JSON; the store path is
  resolved + traversal-guarded by `src/lib/store-path.ts`. Anchors use a W3C
  TextQuoteSelector (`quote` + `prefix`/`suffix` context + nearest `section` heading) —
  the prefix/suffix are load-bearing for re-anchoring rendered text back to source; the
  client capture side lives in `src/components/Comments.astro`. Browser-side comment
  helpers shared across the two comment UIs live in `src/lib/client/comments-client.ts`.
- A comment has `status: open|addressed|resolved` and `hold: boolean`. The agent
  processes only `open` **and not on hold**; held comments are the user's WIP. `addressed`
  is the two-phase-review state (see below): agent-proposed, awaiting human validation.

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
- Keep the `.notabene` contract and the CLI surface stable; call out changes to either
  explicitly in PRs.
