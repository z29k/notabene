---
title: CLI
description: Every notabene command and flag.
sidebar:
  label: CLI
  order: 1
---

# CLI

The npm package is scoped (`@z29k/notabene`); the installed command is just
**`notabene`**, so `npx notabene …` works as-is.

| Command | What it does |
| --- | --- |
| `notabene doctor` | Read-only state as JSON: config/store/port + detected doc folders — `--json` |
| `notabene init` | Write `notabene.config.mjs` + create the store (no-op if present); `--detect` auto-detects doc folders |
| `notabene dev` | Start the review server over this repo's docs (live-reload); `--detach` runs it as a background daemon |
| `notabene status` | Is the detached server running? (pid, port, URL) — `--json` |
| `notabene stop` | Stop the detached server |
| `notabene build` | Build the site (Node standalone; docs prerendered, no write API in the artifact) |
| `notabene build --public` | Read-only **static** site for public hosting — [see the guide](../guide/publish/index.md). `[--site URL] [--base /sub] [--out DIR]` |
| `notabene preview` | Serve the built site |
| `notabene lint` | Validate inter-doc links against the **last build's** emitted routes (did-you-mean suggestions; `--json`). After `build --public`, also catches links from public pages into [private content](../guide/publish/private-content.md). Exit 1 = broken links, 2 = no build yet |
| `notabene pdf` | Export a PDF via headless Chromium (bookmark outline + page numbers); `--scope doc\|space:K\|folder:K/P\|page:K/I`, `--locale`, `--out`, `--chrome`. Needs the optional `puppeteer` peer dep (or `puppeteer-core` + `--chrome`) |
| `notabene migrate` | Convert the store to the one-file-per-comment layout (stamps `schemaVersion` 3) |
| `notabene comments ls` | List comments — `--open` `--json` `--page <p>` (for agents/scripts) |
| `notabene journal add` | Append a JSON journal entry read from stdin |

## Global flags

| Flag | Meaning |
| --- | --- |
| `--root <path>` | Consumer repo root (default: cwd) |
| `--config <path>` | Config path (default: `<root>/notabene.config.mjs`) |
| `--port <n>` | Dev server port (else config `port`, else a free one) |
| `--detach` | `dev` only: background daemon (`status`/`stop` manage it) |
| `--detect` | `init` only: prefill `roots[]` from the doc folders found |
| `--host` | Expose on the LAN — trusted networks only ([safety](./safety.md)) |
| `--public` / `--site` / `--base` / `--out` | `build` only: the [public site](../guide/publish/index.md) artifact |
