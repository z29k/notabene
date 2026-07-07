---
description: Set up, configure, or reconfigure notabene and start the docs review server.
argument-hint: "[roots…] [--format mdx|commonmark] [--port N] [--yes]"
---

Use the **notabene-setup** skill to install/configure (or reconfigure) notabene for this
repo and start the review server. It runs `doctor` first, routes on the current state
(fresh install / reconfigure / repair), writes or edits `notabene.config.mjs` (confirmed),
creates the `.notabene/` store, and launches the server in the background.

Arguments: `$ARGUMENTS`

Treat any of these as a **non-interactive (express)** signal — skip confirmations,
defaults-first, don't ask questions unless a doc folder genuinely can't be determined:
`--yes` is present, explicit roots / `--format` are given, or the phrasing is terse.

Safety rails hold even in express mode: never expose the LAN (`--host`), commit, or delete
anything without an explicit request.
