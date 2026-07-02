---
name: notabene
description: >-
  notabene docs review loop: process review comments left on the docs and verify
  the docs. Use when the user says "address the comments", "process the doc
  comments", "apply the review feedback", "review/check the docs", or references
  the global /comments page. Reads the notabene store, edits the docs per the
  feedback, marks them resolved + writes the journal, then verifies (renderer
  build, links, project checks). Ignores comments on "hold". Never commits without
  an explicit request.
---

# Docs review loop (comments + verification)

**notabene**: a navigable renderer over a repo's docs + a human↔agent review loop.
**Stateless** — the data lives in the consumer repo's git, not in the tool. The
renderer companion is the `notabene` npm package (`npx notabene dev`), but this loop
is **file-I/O-first** and does not require the server to be running.

## Discovery — EVERYTHING comes from the config (nothing hardcoded)

Read **`notabene.config.mjs`** at the repo root to learn:

- **`store`** — comments + journal folder (e.g. `docs/.notabene`). One JSON file per
  page: `<store>/<page>.json`. Journal: `<store>/journal.json`. Schema version:
  `<store>/meta.json` (`{ "schemaVersion": <n> }`).
- **`roots[]`** — the doc spaces: `{ key, label, path, exclude }`. A comment's `page`
  field is prefixed by a root's `path` (e.g. root `docs/plans` → `page:
  "docs/plans/services/x"`).
- **`verify[]`** — project-specific checks to run after editing.
- **`review`** — `"auto"` (default) or `"approve"`. In **approve** mode you don't resolve
  comments yourself: you edit, mark them **`addressed`**, and a human validates them (with
  a diff) at `/review`. See Step 5.

Assume **no** path, port or label. Do not require a live server or a port.

## Strict rules (no exceptions)

- **NEVER commit or run git operations without an explicit request** ("continue"/
  "go on" ≠ commit). Offer the commit at the end.
- **NEVER bulk-delete the store** (`rm -rf <store>`): those are the user's **real
  comments** (precious, committed). To clean a test, delete a single comment by `id`
  (edit its page file), never the folder.
- **Ignore `hold: true`** ("⏸ on hold") and `status` ≠ `open` (`addressed`/`resolved`
  already handled): only process `open` **and not on hold**.
- **MDX-safety** (format `"mdx"` only): when editing a **`.mdx`** file, don't introduce
  stray `{` or `<` outside code fences (MDX parses them as expression/JSX). **`.md`**
  files (CommonMark/GFM) are lenient — no such constraint. Validated by the renderer build.
- **File-I/O first**: read/write the `<store>/` files **directly** with your file
  tools. The `astro dev` server need NOT be running — the HTTP `/api/comments` is only
  a convenience when the site is already open. Depend on **neither a port nor a process**.

## Step 1 — Read the comments to process

Read each `<store>/**/*.json` (except `journal.json` and `meta.json`) and keep the
comments with `status == "open"` **and** `hold != true`. Use your file tools
directly. A comment reopened after a **rejection** (approve mode) carries the human's
reason as later `thread` replies — **read them** and adjust accordingly before editing.
Optional (Node, if available — **no `python3` dependency**):

```bash
node -e '
const fs=require("fs"),p=require("path");
const store=process.argv[1];
const reserved=new Set(["journal.json","meta.json"]);
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const f=p.join(d,e.name);
  if(e.isDirectory())walk(f);
  else if(e.name.endsWith(".json")&&!(d===store&&reserved.has(e.name)))
    for(const c of JSON.parse(fs.readFileSync(f,"utf8"))){
      if(c.status!=="open"||c.hold)continue;
      console.log(`\n[${c.id}] ${c.scope} page=${c.page}`);
      if(c.anchor)console.log(`  §${c.anchor.section}: «${(c.anchor.quote||"").slice(0,100)}»`);
      c.thread.forEach((t,i)=>console.log(`  ${i?"↳":"•"} ${t.author}: ${t.body}`));
    }
}})(store);
' "$(node -e 'console.log(require("./notabene.config.mjs").default.store)')"
```

## Step 2 — Locate the source page

`page` (= `data-page`) → source file, via `roots[]`: a `page` starting with
`<root.path>/…` maps to a file **under `<root.path>`** at the same relative path.
- `<root.path>/<x>` → `<root.path>/<x>.md` or `.mdx`
- **Index page**: if `<x>.{md,mdx}` doesn't exist, it's **`<x>/index.{md,mdx}`** (the
  loader strips `index` from the id → some `data-page` values omit `/index`). Test both.

## Step 3 — Resolve the anchor

`anchor.quote` is the **rendered text** (markdown stripped: no `**`, links as plain
text…). To find it in the source, search tolerantly, using `anchor.prefix`/`suffix`
(disambiguating context) and `anchor.section` (nearest heading). `scope: "page"` = a
page-wide comment, no anchor.

## Step 4 — Edit the docs (faithfully)

Apply each piece of feedback **faithfully** at the right spot. A comment is a user
decision. If the change touches public behavior documented elsewhere, update it (see
project hooks below).

## Step 5 — Mark the comment + write the journal

Set the status by `review` mode (from the config):
- **`auto`** (default): `status = "resolved"`.
- **`approve`**: `status = "addressed"` — you propose; the human validates at `/review`.
  Do **not** resolve it yourself.

In both cases set `resolution = { note, journalEntryId }` and **append** a
`<store>/journal.json` entry: `{ id, date (YYYY-MM-DD), title, summary, changes[] { page,
commentIds[], what, why } }`. Each resolution's `journalEntryId` = the journal entry's
`id`. Edit the JSON directly (keep 2-space indent + trailing newline).

**Cascade (load-bearing for the review UI):** if fixing a comment touched **several
pages** (a cross-ref, behavior documented elsewhere), emit **one `changes[]` entry per
page actually touched**, each listing that `commentId`. The reviewer's diff is built by
inverting the journal — a page you don't record there won't be shown.

## Step 6 — Verify

1. **ALWAYS: build the renderer** — a broken doc file breaks the tool itself
   (`npx notabene build`, or the project's renderer build). Confirm **0 remaining
   `open` non-held comments**.
2. **`config.verify[]`** — the project's own checks (build/lint/memory update).
3. **Project memory** — if the project keeps a memory doc (`CLAUDE.md`/`AGENTS.md`),
   update it for any public-behavior change.

> Steps 2–3 are the **project extension point**. The core loop is generic; a consumer
> declares its post-edit steps via `verify[]` and its memory conventions. The core
> does not know any specific project.

## Step 7 — Report (without committing)

Summarize as a **table**: per comment → the change made (section) + the why. Point to
`/journal` (and, in **approve** mode, to **`/review`** — the human validates each edit
against its diff there, then approves → resolved or rejects → reopened). Then **ask**
whether to commit, and **what** (doc edits only / + resolved store + journal / + project
artifacts). Wait for an explicit go-ahead.
