---
name: notabene-authoring
description: >-
  What you can put in a notabene doc — the full rendering palette, so you can author or
  expand documentation using everything the renderer supports. Use when writing or editing
  docs in a notabene repo: "write the documentation for X", "add a docs page", "document
  this feature", "add a diagram / flowchart / ER diagram to the docs", "what Markdown/MDX
  features does notabene support", "make the docs richer". Covers CommonMark/GFM, code +
  syntax highlighting, Mermaid diagrams, inter-doc links, images, and the MDX-safety rules.
  This skill does NOT install/configure notabene (that's `notabene-setup`) or process review
  comments (that's `notabene`) — it's the authoring reference for the content itself.
---

# Authoring notabene docs — the rendering palette

What actually renders in a notabene site, so you can write a **complete** doc with every
tool available and nothing that silently degrades to plain text. Docs are plain files in
the repo (Markdown/MDX), rendered by the notabene renderer (Astro + GFM + Shiki + Mermaid).

Run every CLI command shown below through the plugin forwarder —
`node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" <cmd> --root <repo-root>` — never `npx notabene`
(unscoped: not our package).

{{body}}

## Working with the other skills

- Just installing/configuring or launching the server → **`notabene-setup`**.
- Applying review comments (which is also *writing docs*) → **`notabene`**; use **this** palette for
  the edits (e.g. a comment asking for "a diagram here" → add a ```mermaid block).
