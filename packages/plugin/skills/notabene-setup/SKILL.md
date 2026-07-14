---
name: notabene-setup
description: >-
  Install, configure, OR reconfigure notabene (the docs review tool) and start its
  review server — for a user who drives everything through the agent, on any stack
  (Rust/Python/Go/JS, no toolchain needed). Use to GET STARTED / LAUNCH: "set up
  notabene", "install notabene", "set up docs review/commenting", "start the review
  server", "open the review UI", "I want to leave comments on / review my docs", "get
  notabene running". Use to RECONFIGURE (a notabene.config.mjs already exists):
  "add/remove/rename a docs folder", "move the store", "switch review to
  approve/validation mode", "change notabene's port", "rename the site", "change the
  language", "add a verify step", "expose it on the LAN". This skill does NOT act on
  existing comments — processing review feedback is the `notabene` skill, which it hands
  off to once the server is up. Writes/edits notabene.config.mjs (shown first), creates
  the store, launches the server. Never commits; never exposes the LAN without an
  explicit request.
---

# notabene setup (install · reconfigure · run)

Get a user from nothing (or from a config they want changed) to an open review server,
**with zero npm/build commands typed by hand**, on any repo. The renderer is fetched and
run **through `npx`** — nothing is installed into the user's repo; only **data** lives
there (`notabene.config.mjs` + the `.notabene/` store + their docs).

Everything routes on **`doctor`** (read-only state) — you encode **no** defaults yourself.
This skill only sets things up; **processing comments is the `notabene` skill** (hand off
at the end).

## The forwarder — how you call the tool

Never call `npx notabene` (unscoped — that package does not exist on npm) and never
hardcode a version. Always go through the plugin forwarder, which pins the right renderer:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" <subcommand> --root <repo-root> [flags…]
```

`<repo-root>` = the current project directory (the repo whose docs you're reviewing). Use
its absolute path. `nb.mjs` forwards to `npx -y --prefer-offline @z29k/notabene@<pinned>`.

## Golden rules (no exceptions)

- **Never commit / push / rewrite history** without an explicit request. Tell the user to
  commit the config + `.notabene/` store; don't do it for them. (Offering `git init` on a
  non-repo is fine — that's not a commit.)
- **Never expose the LAN** (`host: true` / `--host`) unless the user explicitly asks. It's
  loopback-only by default; keep it that way.
- **Never `rm -rf` the store** or regenerate a config from the template over an existing
  one — those hold the user's real comments and settings.
- **Confirm every config write/edit** by showing the diff first — in **express mode**,
  still **print** the config you wrote (show, don't ask); never write invisibly.
- **Re-entrant & read-only-first**: `doctor` writes nothing, `init` is idempotent. Safe to
  re-run at any point.

## Step 0 — Preflight (always)

Run once and read the JSON:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" doctor --root <repo-root> --json
```

- **`{ "error": "npx-unavailable" }`** → the fallback branch. `npx` isn't on PATH (Claude
  Code's bundled Node isn't always exposed). Guide the user to install Node — nodejs.org,
  their OS package manager, or `nvm` — then re-run Step 0. Don't proceed silently.
- **`node.ok: false`** → their Node is older than the required ≥ 22.12. `init` may still
  work but the server (Astro) will fail silently in the daemon log. Warn and point to the
  Node requirement **before proceeding** — same install fixes as `npx-unavailable`.
- **First run is slow (~30 s, ~100 MB)**: the first `npx` fetches the renderer + Astro.
  **Say so** before/while it runs, so the wait isn't mistaken for a hang.
- Then check `git.isRepo`. If false, offer `git init` (the store is meant to be committed).
- **Route on the config state**:
  - `config.exists: false` → **Branch A** (fresh install).
  - `config.exists: true, config.valid: true` → **Branch B** (reconfigure).
  - `config.exists: true, config.valid: false` → **Branch C** (repair).

## Branch A — fresh install (`config.exists: false`)

The report has no `config`/`store`/`port` blocks yet (there's no config to resolve) — it
has **`docs.detected`** instead.

1. **Confirm the doc folders.** Present `docs.detected`. Keep only folders that are
   *actually* documentation; drop stray matches (a top-level `README`, `CHANGELOG`,
   generated dirs). If `docs.detected` is empty, ask where the docs live (don't guess).
2. **Choose the shape** — confirm with the user:
   - `roots[]`: one entry per doc space, each `{ key (unique url slug), label, path,
     exclude }`. Derive readable `key`/`label` from the paths; keep `key`s unique.
   - `store`: put it under the primary root (e.g. `docs/.notabene`, or `<root>/.notabene`
     if there's no `docs/`). It gets committed.
   - `format`: **`commonmark`** by default (lighter, no MDX-safety traps). Write it
     **explicitly** — the renderer's *code* default is `mdx`. Use `mdx` only if `.mdx`
     files exist or the user asks.
3. **Write `notabene.config.mjs`** at the repo root — **show the diff and confirm first**.
   Keep the safety default `host: false`. Shape:

   ```js
   // notabene.config.mjs — points the generic docs review tool at YOUR docs.
   // Your data (docs, comments, journal) lives in your git, not in the tool.
   export default {
     siteName: "Docs",
     tagline: "docs",
     locale: "en",              // UI language + nav sort collation
     format: "commonmark",      // "mdx" only if you have .mdx files
     roots: [
       { key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] },
     ],
     store: "docs/.notabene",   // comments + journal; commit it
     port: 3009,
     host: false,               // true / --host exposes the LAN — trusted networks only
     verify: [],                // extra post-edit checks the review loop runs
     review: "auto",            // "approve" = you validate each edit (with a diff) at /review
     // pdf: { enabled: true, pageSize: "A4", margin: "18mm" },  // PDF export (optional)
     // author: "Alex", authorEmail: "alex@x.io",  // comment identity default (else git user.name/.email)
   };
   ```

4. **Create the store**: `node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" init --root <repo-root>`
   (idempotent; reads `store` from the config you just wrote, makes the dir + `meta.json`).
   Remind the user to **commit `.notabene/`** — but don't commit it.
5. **Check it's not ignored**: `git check-ignore <store>`. A repo that ignores dotfolders
   could silently exclude `.notabene/` (the contract is that it's committed). Warn if so.
6. Go to **Launch & handoff**.

## Branch B — reconfigure (`config.exists: true, config.valid: true`)

The user wants to change an existing setup. **Do not** re-run onboarding and **do not**
regenerate from the template.

1. **Restate the current config** from the report (`config.roots/format/port/host/review/
   store`), then ask **what to change**.
2. **Edit in place** (Edit tool) — leave untouched fields and comments alone, **show the
   diff, confirm**. Common changes: add/remove/rename a `roots[]` entry; `format`; `port`;
   `review` (auto ↔ approve); `siteName`/`tagline`/`locale`; `author`/`authorEmail`; `pdf`
   (PDF export); `verify[]`; `host` (⚠ security — only on explicit request).
3. **Surface the consequences — never silently** (some edits orphan comments):
   - **`store` moved** → existing comments stay at the old path. Offer to move the store dir.
   - **`roots[].key` renamed** → changes URL slugs and the stored `space`/`page` prefix →
     **re-anchoring breaks**. Warn; offer to migrate the affected `page` values, or advise
     against it.
   - **`format` mdx ↔ commonmark** → different globbing + MDX strictness. Flag the
     MDX-safety implications.
4. Most changes (port, roots, format, host…) take effect **only after a restart**. Go to
   **Launch & handoff** and restart the server (see there).

## Branch C — repair (`config.exists: true, config.valid: false`)

The config is present but failed to load. **Do not** overwrite it with the template.

1. Show `config.error` (from `doctor`) — it's the import/syntax failure.
2. Read the file, fix the syntax (a stray comma, a bad quote, an accidental `import`), and
   **re-run Step 0** to confirm it now resolves (`valid: true`), then continue on Branch B.

## Non-interactive mode (power user)

Detect an **express** signal — invoked as `/notabene:setup … --yes`, or the user gives
explicit roots/format, or the phrasing is terse ("just set it up on docs/") — and **cut
the confirmations**: defaults-first, write the config (**print it** — show, don't ask),
`init`, launch, return the URL, **no questions**. Only stop on an **undefaultable
ambiguity** (e.g. no doc folder detected
and none given). Safety rails are **never** bypassed even with `--yes`: `host`, committing,
and `rm` stay explicit.

## Launch & handoff

1. **Launch a detached daemon.** `dev --detach` **self-selects a free port**, starts a real
   background server that **survives this session**, is **idempotent** (reuses a live one
   instead of starting a second), and **prints the URL itself** once the port answers — so
   run it as a normal Bash call (not `run_in_background`); it returns on its own:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" dev --detach --root <repo-root>
   ```

   Pass `--port <n>` only to pin a specific port (e.g. `port.suggested` from `doctor`); to
   **persist** a port, edit the config instead. The first run also does the ~30 s renderer
   fetch, so this call can take a bit — say so. Give the user the `http://localhost:<port>`
   URL from its output.
2. **Lifecycle** (managed across sessions):
   - `node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" status --json` → `{ running, pid, port, url }`
     (or `/notabene:status`).
   - `node "${CLAUDE_PLUGIN_ROOT}/bin/nb.mjs" stop` → stop it (or `/notabene:stop`).
3. **On Branch B**, most changes take effect only after a restart: **`stop` then
   `dev --detach`**. Confirm the current state first with `status`.
4. **Hand off.** Explain the loop in one line — *leave comments on the rendered docs; the
   agent reads them, edits, journals, verifies* — and point to the **`notabene`** skill (or
   `/notabene:review`) for processing those comments. If `doctor` reported
   `store.openComments > 0` (typically a Branch B reconfigure of a populated repo), say so —
   *N comment(s) already waiting; run `/notabene:review`.* Setup's job ends here.

## Fallback — `npx` unavailable

If Step 0 returns `npx-unavailable`, notabene can't run yet. Explain plainly: notabene runs
via `npx`, which comes with Node, and Node isn't on PATH. Offer the concrete fixes
(nodejs.org installer / OS package manager / `nvm install --lts`), then re-run Step 0. Don't
attempt any renderer command until `doctor` succeeds.
