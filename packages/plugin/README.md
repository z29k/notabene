# notabene — Claude Code plugin

Turnkey **docs review** for any repo, driven entirely through your agent. The plugin
**sets notabene up** (writes the config, creates the store, starts the review server via
`npx` — no toolchain to install, on any stack) and then **runs the human↔agent review
loop**: you leave Google-Docs-style comments on your rendered docs, the agent applies the
feedback, marks it resolved, journals it, and verifies.

Companion to the [`@z29k/notabene`](https://www.npmjs.com/package/@z29k/notabene) npm
renderer — the plugin fetches and runs it for you; nothing is scaffolded into your repo.

## Install

In Claude Code:

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

Then just say **"set up notabene"** (fresh repo) or **"address the doc comments"** (already
set up) — the right skill triggers on its own.

## Commands

| Command | What it does |
| --- | --- |
| `/notabene:setup [roots…] [--format …] [--yes]` | Install/configure **or** reconfigure notabene and start the server. Routes on state (fresh install / reconfigure / repair). `--yes` (or explicit args) = non-interactive. |
| `/notabene:dev [--port N] [--host]` | Start (or reuse) the review server as a background daemon; prints the URL. Idempotent, non-blocking. |
| `/notabene:status [--json]` | Is the server running? (pid, port, URL) + open-comment count. |
| `/notabene:stop` | Stop the background server. |
| `/notabene:review` | Process the open review comments (the review loop). |

`setup` and `review` are **orchestrated** (they invoke a skill); `dev`/`status`/`stop` are
thin wrappers around the renderer CLI.

## Skills

- **`notabene-setup`** — state-aware install / reconfigure / launch. Runs a read-only
  `doctor` preflight, then writes or edits `notabene.config.mjs` (shown first), creates the
  `.notabene/` store, and starts the server. Never commits; never exposes the LAN unasked.
- **`notabene`** — the review loop (**the product**). Reads the `.notabene/` store, edits
  the docs per each comment, marks them resolved (or *addressed* in approve mode), appends
  the journal, and verifies (renderer build + your `verify[]` checks). This file **is** the
  agent-agnostic protocol spec — point any agent at it.
- **`notabene-authoring`** — the doc rendering palette: what you can put in a page
  (CommonMark/GFM, code + Shiki highlighting, **Mermaid diagrams**, inter-doc links) and the
  MDX-safety rules, so the agent can write a complete doc with every tool the renderer supports.

## How it works

`bin/nb.mjs` is a small Node forwarder the skills and commands call. It:

1. reads the **pinned renderer version** from this plugin's manifest (resolved relative to
   itself, so it also works when run directly), keeping plugin and renderer in lockstep;
2. **preflights** `npx`/Node and emits a structured error (→ an install-Node fallback) if
   `npx` isn't on your PATH;
3. forwards to `npx -y --prefer-offline @z29k/notabene@<version> <args>`.

The renderer lives in the **npx cache**, not your repo — only **data** (config + the
`.notabene/` store + your docs) lives with you.

## Requirements

- **Node ≥ 22.12** and **`npx` on your PATH** (both ship with Node). Claude Code's bundled
  Node runtime isn't always exposed on PATH — if `npx` is missing, the setup skill guides
  you through installing Node.
- First run fetches the renderer (~30 s, ~100 MB); subsequent runs are fast (cached).
- **Developing the plugin?** Set `NOTABENE_RENDERER_SPEC` (e.g. `@z29k/notabene@dev`, a
  tarball, or `file:../renderer`) to test against a renderer version that isn't published
  as a stable release yet.

## Safety

The renderer's write API only runs under `notabene dev`, binds **loopback** by default, and
LAN exposure (`--host`) is explicit opt-in. The plugin **never commits** and never deletes
the store. The `.notabene/` store is meant to be **committed** in your repo — it's the
public data contract agents read.

See the [repo](https://github.com/z29k/notabene) for the full docs, the renderer CLI, and
the review protocol.
