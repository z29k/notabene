---
title: What is notabene?
description: A navigable doc site over your repo's Markdown, Google-Docs-style comments, and an agent that applies the feedback — all in your git.
sidebar:
  label: What is notabene?
  order: 0
---

# What is notabene?

*nota bene* — the margin mark that means **"note this well."**

notabene renders your repo's Markdown/MDX as a **navigable site with review comments
right on the page**, and ships the **human↔agent review protocol** that turns those
comments into edits. The viewer is the support — the protocol is the product.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="notabene demo: comment a passage, the agent applies the edit, you approve the real diff" width="820" />
</p>

## The problem it solves

Fixing or writing docs with an AI agent means turning every change into prose: quote the
passage, name the section — *"can you fix the wording in section 3"* — then hope the agent
re-finds the exact spot in the source. Past a couple of changes it's a wall of
instructions in one chat input. The real instruction was always simpler: *this passage —
change it like so.*

notabene makes that the interface. Select the exact text on the rendered page — or a
whole diagram or image — and leave a comment right there. The anchored comment **is** the
instruction: located, unambiguous, nothing to quote. The agent reads the comments, edits
the source faithfully, marks each resolved, and journals *what changed & why*.

## The loop, in 30 seconds

1. `npx notabene dev` → open the site, **select any text → leave a comment** (or comment
   a whole page, diagram or image). Threads, resolve, hold, a global `/comments` view.
2. Tell your agent: **"address the doc comments."**
3. The agent reads `.notabene/`, edits the docs faithfully, marks each comment
   **resolved**, and appends a **journal** entry (what / why / which comments).
4. Read the trail at `/journal` — or [validate each diff yourself](./review-loop.md)
   in approve mode.

## Everything is in your git

Comments and journal are **plain JSON files** under `.notabene/` — no SaaS, no database,
no account. They travel with your repo, diff in PRs, and are readable by any agent: the
review protocol is **file-I/O-first** (no server, no port, no MCP required).

## Where to go next

- [Install](./install.md) — the npm renderer, the Claude Code plugin, or both.
- [Your first review](./first-review.md) — from a comment to a journaled edit.
- [Configuration](./configuration.md) — the one config file, by example: spaces,
  MDX components, branding, navigation links and footer, custom home page.
- [Customize the look](./customize.md) — branding, design tokens, fonts, code theme,
  your own stylesheet.
- [The review loop](./review-loop.md) — auto vs. approve (human-in-the-loop diffs).
- [Authoring docs](./authoring.md) — the rendering palette: GFM, Mermaid, code, links.
- [Multi-language docs](./multilingual.md) — EN/FR/… with clean URLs and a switcher.
- [PDF export](./pdf-export.md) — print-ready views and bookmarked PDFs.
- [Publish a public site](./publish/index.md) — a read-only, agent-readable static site.

Looking for exhaustive tables instead? Head to the **Reference** space: the
[CLI](../reference/cli.md), every [config key](../reference/config.md), the
[frontmatter](../reference/frontmatter.md), the [store contract](../reference/store-contract.md)
and the [safety model](../reference/safety.md).
