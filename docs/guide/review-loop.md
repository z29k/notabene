---
title: The review loop
description: File-I/O-first protocol any agent can follow — and the optional human-in-the-loop approve mode with real git diffs.
sidebar:
  label: The review loop
  order: 5
---

# The review loop

The loop is the product: comments in, faithful edits out, everything journaled. It's
designed so **any** agent can run it — the protocol is a plain-text skill file that
reads and writes the store directly.

## How the agent works

Everything is discovered from `notabene.config.mjs` — nothing hardcoded, no server or
port required:

1. **Read** the open, non-held comments from `<store>/` (one JSON file per comment).
2. **Locate** the source page via `roots[]`, then resolve the text anchor tolerantly
   (the anchor stores the quoted text + surrounding context + nearest heading).
3. **Edit** the docs faithfully — a comment is a user decision.
4. **Mark** the comment resolved (or `addressed` in approve mode) and **append the
   journal**: one entry per pass, one change record per page touched, linked back to the
   comment ids.
5. **Verify**: the renderer build always runs, then `notabene lint` (inter-doc links
   validated against the routes that build just emitted), then your `verify[]` checks.
6. **Report** and ask before committing — never a silent commit, never a bulk delete.

Comments a reviewer puts **on hold** (⏸) are skipped — they're your work-in-progress.

Steps 4 and 5 have CLI primitives so an agent never hand-edits the store JSON:
`notabene comments done <id…> --note … --journal <entryId>` picks the right status from
your `review` mode, and **`notabene comments verify`** audits what it wrote — statuses,
comment↔journal links in both directions, layout. It exits non-zero on a real problem, so
it doubles as a CI gate on the store your agents commit.

## Approve mode: humans validate every edit

By default (`review: "auto"`) the agent resolves comments directly. Set
`review: "approve"` for a **human-in-the-loop** flow:

- the agent edits and marks each comment **`addressed`** instead of resolved;
- you validate at **`/review`** (or the *To validate* filter on `/comments`);
- you see the **real git diff** of everything that changed for that comment —
  **cascades included** (one comment can touch several pages);
- **approve** → resolved, or **reject** → reopened with your reason, which the agent
  reads on its next pass;
- the diff renders unified or side-by-side, and a **Review** badge in the header counts
  what's waiting.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="approve mode: the agent proposes, you validate the real diff" width="820" />
</p>

## Using it from any agent

The protocol is a plain-text spec, and `notabene init` **installs it in your repo** so no
agent has to go looking for it:

- **`<store>/protocol.md`** — the full spec, committed next to the comments it describes.
  Offline, no npm, no network. This is what you point any agent at.
- **`AGENTS.md`** — a bounded `<!-- notabene:begin -->…<!-- notabene:end -->` block that
  tells the agents which read it at startup (Codex CLI, Cursor, Gemini CLI, Zed, Amp…)
  where the comments and the protocol live. Nothing outside the markers is ever touched;
  opt out with `init --no-agents-md`.

Both are refreshed by re-running `notabene init` (idempotent) — do that after moving the
store or renaming a space, and `notabene doctor` will tell you when they drift. Two more
copies of the same generated text: `npx -y @z29k/notabene@latest protocol` prints it, and
the [agent protocol](../reference/agent-protocol.md) page publishes it (with a Markdown
twin in public builds, for agents that browse).

In Claude Code the plugin skill *is* that protocol — it triggers on "address the doc
comments" and needs no AGENTS.md. The store shape itself is a versioned public contract —
see the [store reference](../reference/store-contract.md).
