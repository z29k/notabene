---
title: The .notabene store contract
description: The versioned JSON schema agents read and write — comments, journal, migrations.
sidebar:
  label: Store contract
  order: 4
---

# The `.notabene` store contract

The store is a **versioned public contract** — committed in your repo, read and written
by agents. Its shape never changes silently: `<store>/meta.json` carries
`{ "schemaVersion": n }` (currently **3**), and any shape change ships a migrator
(`notabene migrate`).

## Layout

```
<store>/
  meta.json                # { "schemaVersion": 3 }
  journal.json             # one array of journal entries
  protocol.md              # the agent protocol (written by `init`; not data)
  <page>/<comment-id>.json # ONE FILE PER COMMENT → conflict-free git merges
```

`meta.json`, `journal.json` and `protocol.md` are **reserved names** at the top level;
everything else under `<store>/` is comment data. Readers only ever parse `.json`, so
`protocol.md` is inert — it rides along so the spec is always next to the comments.

`<page>` is the logical page path (`docs/guide/setup` — with i18n it's the raw,
locale-encoded id, so comments are per-language). Older v1 stores (one array per page)
are still read; any write migrates that page forward.

## A comment

```jsonc
{ "id", "space", "page", "scope",            // scope: "selection" | "page" | "block"
  "anchor": {                                 // selection: W3C-style text quote
    "quote", "prefix", "suffix", "section"    // rendered text + context + nearest heading
  } | { "kind", "key", "label",               // block (diagram/image): content-derived key
        "section", "index" } | null,
  "thread": [{ "author", "body", "ts" }],     // author may be git-style "Name <email>"
  "status": "open" | "addressed" | "resolved",
  "hold": false,                              // true → the agent skips it (reviewer WIP)
  "resolution": { "note", "journalEntryId" } | null,
  "createdAt", "updatedAt" }
```

`addressed` is the [two-phase review](../guide/review-loop.md) state: agent-proposed,
awaiting human validation at `/review`.

## A journal entry

```jsonc
{ "id", "date",                               // YYYY-MM-DD
  "title", "summary",
  "changes": [{ "page", "commentIds": [], "what", "why" }] }
```

One `changes[]` record **per page actually touched** — the `/review` diff is built by
inverting the journal, so a page not recorded there won't show in the reviewer's diff.
Each resolved comment's `resolution.journalEntryId` points back at its entry.

## Rules agents must honor

- Writes are **atomic** (temp file + rename) — never hand-write partial JSON. The CLI
  (`comments done` / `reopen`, `journal add`) does this for you; `comments verify` audits
  the result.
- **Never bulk-delete the store**; delete a single comment by id if asked.
- Only process `status: "open"` **and** `hold: false`.
- The full protocol lives in **[`<store>/protocol.md`](./agent-protocol.md)** — written by
  `notabene init`, committed with the store, refreshed by re-running `init`. Point any
  agent at it.
