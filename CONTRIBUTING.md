# Contributing to notabene

Thanks for your interest! notabene is a small, focused tool — a docs renderer plus
a human↔agent review protocol. Contributions are welcome.

## Repo layout

- **`packages/renderer`** — the `@z29k/notabene` npm package: a generic Astro
  renderer + the `notabene` CLI (`init` / `dev` / `build` / `preview` / `pdf`, plus
  `doctor` / `status` / `stop` / `migrate` / `comments` / `journal`). Runs
  *from the package* against a consumer repo (`NOTABENE_ROOT` / `NOTABENE_CONFIG`).
- **`packages/plugin`** — the Claude Code plugin (the review skill). The skill file
  doubles as the agent-agnostic protocol spec.

The single source of file-layout truth is `packages/renderer/src/config.mjs` — it
loads `notabene.config.mjs` and resolves every path. No hardcoded paths elsewhere.

## Develop

```bash
npm install                       # installs the renderer's deps (Astro, MDX, Node adapter)

# Run the renderer against a scratch consumer:
mkdir -p /tmp/nb-scratch/docs && echo "# Hi" > /tmp/nb-scratch/docs/index.md
cd /tmp/nb-scratch
node ~/…/notabene/packages/renderer/bin/notabene.mjs init
node ~/…/notabene/packages/renderer/bin/notabene.mjs dev
```

For a **realistic corpus** — a multi-space tree, comments in every state
(open/addressed/resolved/hold, selection + page), a journal with a cascade and a shared
page, and (with `--git`) uncommitted "agent edits" so `/review` shows real diffs — use the
deterministic generator instead of hand-rolling a scratch:

```bash
npm run demo    # generate ./.demo (gitignored, git-backed, approve mode) + start dev
# or customize (deterministic per --seed; default out is ./.demo):
node scripts/gen-fixture.mjs --format mdx --locale fr --review approve \
  --spaces 3 --pages 6 --seed 7 --git
```

The demo lands in a gitignored `.demo/` at the repo root (a nested git repo when `--git`),
so it's easy to browse and never gets committed.

## Conventions

- **Node, not Bun** — the OSS target is npm/pnpm/Node. Don't add Bun assumptions.
- **English** for code, comments, README, and the default UI. UI strings live in
  `src/i18n.mjs` (EN is the source of truth; other locales fall back to it). Add a
  language by adding a top-level key there — never hardcode a user-visible string.
- **MDX-safety** — the renderer supports `.md` (lenient CommonMark/GFM) and `.mdx`
  (strict). Don't introduce stray `{`/`<` in `.mdx` outside code fences.
- **The `.notabene` contract is public** — it's committed in consumer repos and read
  by agents. Any shape change bumps `schemaVersion` (`<store>/meta.json`) with a
  migrator; never mutate silently. Types: `src/lib/comment-types.ts`.
- **Dev-local & safe** — the write API binds loopback by default and only runs under
  `notabene dev`. Keep it that way.

## Validate a change

Quality gates (run in `packages/renderer` — these are what CI enforces on Node 22 + 24):

```bash
cd packages/renderer
npm test          # Vitest — pure-logic unit tests (test/*.test.ts)
npm run lint      # Biome — lint + format check (JS/TS; .astro/.css excluded)
npm run format    # Biome — apply formatting
npm run check     # astro check — type-checks .astro + .ts (needs a consumer, see below)
```

`astro check` and the build run *against* a consumer repo, so point them at a scratch one
via `--root` / the `NOTABENE_ROOT`+`NOTABENE_CONFIG` env:

```bash
mkdir -p /tmp/nb-scratch/docs && echo "# Hi" > /tmp/nb-scratch/docs/index.md
node packages/renderer/bin/notabene.mjs init  --root /tmp/nb-scratch
node packages/renderer/bin/notabene.mjs build --root /tmp/nb-scratch   # must complete with 0 errors
NOTABENE_ROOT=/tmp/nb-scratch NOTABENE_CONFIG=/tmp/nb-scratch/notabene.config.mjs \
  npm --prefix packages/renderer run check
```

Tests are pure-logic only (anchoring, route/link rewriting, the write-API guard, store
paths, the schema-version guard, nav humanization); `.astro`/config-dependent code is
covered by `astro check` + the smoke build. Test both formats (`format: "mdx"` and
`"commonmark"`) and both a fresh EN config and a `locale: "fr"` config when touching UI
strings.

## Branching model

- **`main`** — stable / production. Only release commits and `vX.Y.Z` tags land here;
  never push feature work directly to it.
- **`develop`** — integration + staging. Every push auto-publishes a prerelease to the
  `@dev` npm channel (see Releasing). Kept at the in-progress next version.
- **`feature/<name>`** and **`fix/<name>`** — branch **from `develop`** for each change,
  then open a PR back into `develop`. Naming: `feature/…` for new work, `fix/…` for bug
  fixes. When `develop` is ready to ship, bump the version and promote it to `main`, then
  tag `vX.Y.Z`.

```
main ──●────────────────────────●─(tag vX.Y.Z)──▶  stable @latest
        \                      /
develop  ●───●───●───●───●────●  ─────────────────▶ prereleases @dev
          \     /   \       /
    feature/…  ●   fix/… ●          (PRs into develop)
```

## Pull requests

Keep PRs focused. Describe what changed and why. Branch from `develop` as `feature/…` or
`fix/…` and PR back into `develop`. For anything touching the `.notabene` contract or the
CLI surface, call it out explicitly.

## Releasing

npm allows a **single Trusted Publisher per package**, so both channels run from one
workflow (`.github/workflows/publish.yml`, the one registered on npm). Auth is **trusted
publishing** (OIDC — no stored secret, provenance on); the job runs in the `production`
GitHub Environment. The channel is chosen by what you push:

| Push | npm dist-tag | Install | Extra |
| --- | --- | --- | --- |
| a commit to `develop` | `dev` (prerelease `X.Y.Z-dev.N`) | `npm i @z29k/notabene@dev` | staging |
| a `vX.Y.Z` tag (on `main`) | `latest` (stable) | `npm i @z29k/notabene` | + a GitHub Release |

- **Staging** (`develop`): each push runs the gates and publishes a prerelease to `dev`.
  Keep `packages/renderer/package.json` at the **in-progress next version** on develop so
  prereleases read e.g. `0.6.0-dev.N`.
- **Production** (tag): bump all three files to the same version, sync the lockfile, commit,
  tag, push — CI verifies tag == version, publishes stable, and cuts a GitHub Release:

  ```bash
  # bump: packages/renderer/package.json · packages/plugin/.claude-plugin/plugin.json
  #       .claude-plugin/marketplace.json (metadata.version)
  npm install
  git commit -am "chore: release vX.Y.Z"
  git tag -a vX.Y.Z -m "notabene vX.Y.Z"
  git push origin main --follow-tags
  ```

**One-time setup** (owner): on npmjs.com → `@z29k/notabene` → Settings → **Trusted
Publisher**, set repo `z29k/notabene`, workflow `publish.yml`, environment `production`
(this matches what the workflow uses). Then create a `develop` branch. You can also run the
workflow by hand (**Run workflow** / `workflow_dispatch`) — pick the `vX.Y.Z` tag to publish
a stable version, or `develop` for a prerelease. The plugin/marketplace ship via the Claude
Code marketplace, not npm.
