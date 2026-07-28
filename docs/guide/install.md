---
title: Install
description: Two installable pieces — the Claude Code plugin and the npm renderer. Install one or both.
sidebar:
  order: 1
---

# Install

notabene is **two installable pieces**: the **Claude Code plugin** (turnkey setup + the
review loop) and the **renderer** (an npm package + CLI). They install independently —
the plugin does **not** need the npm package: it fetches the renderer on its own.

## The Claude Code plugin — setup + review

In Claude Code:

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

That's the whole install — **no `npm install` required**. The plugin fetches and runs a
pinned version of the renderer itself via `npx` (the first run downloads it, ~30 s);
nothing is scaffolded into your repo, and your repo doesn't even need a `package.json`.
The only prerequisite is Node (see [requirements](#requirements) below).

Then just say **"set up notabene"** (fresh repo) or **"address the doc comments"**
(already set up) — the right skill triggers on its own.

Prefer manual install? Copy `packages/plugin/skills/notabene/` into your project's
`.claude/skills/`. Using another agent entirely? You don't need the plugin at all:
`notabene init` writes the same protocol to `<store>/protocol.md` and points at it from
`AGENTS.md` (see [using it from any agent](./review-loop.md#using-it-from-any-agent)).

## The renderer — npm package (without Claude)

To drive the CLI yourself — by hand, in CI, or from another tool — install the npm
package:

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

Installing both is fine: the plugin always runs its **own pinned renderer version**
(matched to the plugin's version), independent of the one in your `package.json` — the
two never conflict.

## Requirements

Both routes share the same prerequisites:

- **Node ≥ 22.12** and `npx` on your PATH (both ship with Node).
- Any repo with Markdown or MDX files — see [MDX and CommonMark](./configuration.md#mdx-and-commonmarkgfm)
  for how the two formats are handled.

Next: [your first review](./first-review.md).
