---
title: Install
description: Two installable pieces — the npm renderer and the Claude Code plugin. Install one or both.
sidebar:
  order: 1
---

# Install

notabene is **two installable pieces**: the **renderer** (an npm package + CLI) and the
**Claude Code plugin** (turnkey setup + the review loop). Install one or both.

## The renderer — npm package

```bash
npm install -D @z29k/notabene   # or: pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # writes notabene.config.mjs + creates the .notabene store
npx notabene dev                # → http://localhost:3009
```

> The npm package is scoped (`@z29k/notabene`); the CLI command it installs is just
> **`notabene`**, so `npx notabene …` works as-is.

`init` is the **only** thing that touches your repo — it writes `notabene.config.mjs` and
creates the `.notabene/` store (`init --detect` prefills `roots[]` from the doc folders it
finds). The renderer itself **runs from the package**: nothing is scaffolded or copied
into your repo, and upgrading is just `npm update`.

The full command surface (build, pdf, status, migrate, comments, journal…) is in the
[CLI reference](../reference/cli.md).

## The Claude Code plugin — setup + review

In Claude Code:

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

Then just say **"set up notabene"** (fresh repo) or **"address the doc comments"**
(already set up) — the right skill triggers on its own. The plugin fetches and runs the
renderer for you via `npx`; nothing is scaffolded into your repo.

Prefer manual install? Copy `packages/plugin/skills/notabene/` into your project's
`.claude/skills/`. Using another agent entirely? The skill file **is** the protocol
spec — point your agent at it (see [the review loop](./review-loop.md)).

## Requirements

- **Node ≥ 22.12** and `npx` on your PATH (both ship with Node).
- Any repo with Markdown or MDX files — see [MDX and CommonMark](./configuration.md#mdx-and-commonmarkgfm)
  for how the two formats are handled.

Next: [your first review](./first-review.md).
