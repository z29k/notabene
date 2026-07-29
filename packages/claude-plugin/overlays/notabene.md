---
name: notabene
description: >-
  notabene docs review loop: process review comments left on the docs and verify
  the docs. Use when the user says "address the comments", "process the doc
  comments", "apply the review feedback", "review/check the docs", or references
  the global /comments page. Reads the notabene store, edits the docs per the
  feedback, marks them resolved + writes the journal, then verifies (renderer
  build, links, project checks). Ignores comments on "hold". This skill does NOT
  install, configure, or launch the review server — that's `notabene-setup`. Never
  commits without an explicit request.
---

# Docs review loop (comments + verification)

**notabene**: a navigable renderer over a repo's docs + a human↔agent review loop.
**Stateless** — the data lives in the consumer repo's git, not in the tool. What follows
is the generic, agent-agnostic protocol; **three rules override it inside this plugin**:

1. **Not set up here?** No `notabene.config.mjs` or no `.notabene/` store → **hand off to
   the `notabene-setup` skill** (or `/notabene:setup`) to install/configure and launch,
   then resume. Don't fail; delegate — ignore the generic `npx … init` fallback below.
2. **Every CLI call goes through the plugin forwarder** — `node
   "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" <cmd> --root <repo-root>` — never `npx notabene`
   (unscoped: not our package) and never a hardcoded version. This replaces **every**
   `npx -y @z29k/notabene@latest …` shown below (`comments ls`, `build`, `lint`,
   `journal add`). The loop still never depends on the CLI: file tools are enough.
3. **Authoring palette** — for what you can put in a page (Mermaid diagrams, GFM tables,
   code blocks, inter-doc links) and the MDX-safety rules, use the **`notabene-authoring`**
   skill rather than the web page linked in Step 4.

{{body}}
