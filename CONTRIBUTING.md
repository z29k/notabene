# Contributing to notabene

Thanks for your interest! notabene is a small, focused tool — a docs renderer plus
a human↔agent review protocol. Contributions are welcome.

## Repo layout

- **`packages/renderer`** — the `@z29k/notabene` npm package: a generic Astro
  renderer + the `notabene` CLI (`init` / `dev` / `build` / `preview`). Runs
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

## Pull requests

Keep PRs focused. Describe what changed and why. For anything touching the
`.notabene` contract or the CLI surface, call it out explicitly.

## Releasing

Two channels, two branches, two GitHub Environments — all auto-published to npm via
**trusted publishing** (OIDC, no stored secret, provenance on):

| Branch | Environment | npm dist-tag | Workflow | Install |
| --- | --- | --- | --- | --- |
| `develop` | `staging` | `next` (prerelease `X.Y.Z-dev.N`) | `staging.yml` | `npm i @z29k/notabene@next` |
| `main` + `vX.Y.Z` tag | `production` | `latest` (stable) + GitHub Release | `publish.yml` | `npm i @z29k/notabene` |

- **Staging**: every push to `develop` runs the gates and publishes a prerelease to `next`.
  Keep `packages/renderer/package.json` at the **in-progress next version** on develop so
  prereleases read e.g. `0.4.0-dev.N`.
- **Production**: bump all three files to the same version, sync the lockfile, commit, tag,
  push the tag — CI verifies tag == version, publishes to `latest`, and cuts a GitHub
  Release with generated notes:

  ```bash
  # bump: packages/renderer/package.json · packages/plugin/.claude-plugin/plugin.json
  #       .claude-plugin/marketplace.json (metadata.version)
  npm install
  git commit -am "chore: release vX.Y.Z"
  git tag -a vX.Y.Z -m "notabene vX.Y.Z"
  git push origin main --follow-tags
  ```

**One-time setup** (owner):

1. Create the `develop` branch, and (optionally) protect the `production` GitHub
   Environment with a required reviewer (repo Settings → Environments → production).
2. On npmjs.com → `@z29k/notabene` → Settings → **Trusted Publisher**, add **two** GitHub
   Actions publishers (repo `z29k/notabene`): workflow `publish.yml` / env `production`,
   and workflow `staging.yml` / env `staging`.

Either workflow can also be run by hand (**Run workflow** / `workflow_dispatch`). The
plugin/marketplace ship via the Claude Code marketplace, not npm.
