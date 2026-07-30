---
title: CLI
description: Every notabene command and flag.
sidebar:
  label: CLI
  order: 1
---

# CLI

The npm package is scoped (`@z29k/notabene`); the installed command is just
**`notabene`**, so `npx notabene …` works as-is **once the package is a dependency of
your repo**. Without a local install, always use the scoped name —
`npx -y @z29k/notabene@latest …` — because unscoped `notabene` is **not** our package.

| Command | What it does |
| --- | --- |
| `notabene doctor` | Read-only state as JSON: config/store/port + detected doc folders — `--json` |
| `notabene init` | Write `notabene.config.mjs` + create the store (no-op if present); `--detect` auto-detects doc folders. Also writes the [agent entry point](./agent-protocol.md): `<store>/protocol.md` + a bounded block in `AGENTS.md` — opt out with `--no-protocol` / `--no-agents-md`. Idempotent: re-run it to refresh both |
| `notabene dev` | Start the review server over this repo's docs (live-reload); `--detach` runs it as a background daemon. With the optional `pagefind` dev dep, its search is [full-text](../guide/publish/index.md#full-text-search-optional) too |
| `notabene status` | Is the detached server running? (pid, port, URL) — `--json` |
| `notabene stop` | Stop the detached server |
| `notabene build` | Build the site (Node standalone; docs prerendered, no write API in the artifact) |
| `notabene build --public` | Read-only **static** site for public hosting — [see the guide](../guide/publish/index.md). `[--site URL] [--base /sub] [--out DIR]`. With the optional `pagefind` dev dep installed, the artifact gets [static full-text search](../guide/publish/index.md#full-text-search-optional) |
| `notabene preview` | Serve the built site |
| `notabene lint` | Validate inter-doc links against the **last build's** emitted routes (did-you-mean suggestions; `--json`). After `build --public`, also catches links from public pages into [private content](../guide/publish/private-content.md). Exit 1 = broken links, 2 = no build yet |
| `notabene pdf` | Export a PDF via headless Chromium (bookmark outline + page numbers); `--scope doc\|space:K\|folder:K/P\|page:K/I`, `--locale`, `--out`, `--chrome`. Needs the optional `puppeteer` peer dep (or `puppeteer-core` + `--chrome`) |
| `notabene migrate` | Convert the store to the one-file-per-comment layout (stamps `schemaVersion` 3) |
| `notabene comments ls` | List comments — `--open` `--json` `--page <p>` (for agents/scripts) |
| `notabene comments done` | Mark comment(s) handled: `done <id…> [--note <text>] [--journal <entryId>]`. **The status comes from `review`** (auto → `resolved`, approve → `addressed`) — `--status` overrides, `--force` acts on a comment that is on hold. Atomic; every other field preserved |
| `notabene comments reopen` | Send comment(s) back to `open`: `reopen <id…> [--reply <text>] [--author <name>]` — the reason becomes a thread reply the agent reads on its next pass (the CLI side of rejecting at `/review`) |
| `notabene comments verify` | Audit the store: statuses, comment↔journal links **both ways**, layout, duplicates, dangling pages. `--json`; exit 1 on errors, 2 with no store. Run it after an agent pass, or in CI |
| `notabene journal add` | Append a JSON journal entry read from stdin (atomic; `--json` echoes `{ id }` so an agent can chain it) |
| `notabene protocol` | Print the [agent protocol](./agent-protocol.md) on stdout — `--path` prints where it lives, `--write` refreshes `<store>/protocol.md` |

## Global flags

| Flag | Meaning |
| --- | --- |
| `--root <path>` | Consumer repo root (default: cwd) |
| `--config <path>` | Config path (default: `<root>/notabene.config.mjs`) |
| `--port <n>` | Dev server port (else config `port`, else a free one) |
| `--detach` | `dev` only: background daemon (`status`/`stop` manage it) |
| `--detect` | `init` only: prefill `roots[]` from the doc folders found |
| `--no-protocol` / `--no-agents-md` | `init` only: skip the `<store>/protocol.md` copy / the `AGENTS.md` block |
| `--host` | Expose on the LAN — trusted networks only ([safety](./safety.md)) |
| `--public` / `--site` / `--base` / `--out` | `build` only: the [public site](../guide/publish/index.md) artifact |
