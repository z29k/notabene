# Contributing to notabene

Thanks for your interest! notabene is a small, focused tool — a docs renderer plus
a human↔agent review protocol. Contributions are welcome.

## Repo layout

- **`packages/renderer`** — the `@z29k/notabene` npm package: a generic Astro
  renderer + the `notabene` CLI (`init` / `dev` / `build` / `preview` / `pdf`, plus
  `doctor` / `status` / `stop` / `migrate` / `protocol` / `journal` and
  `comments ls|done|reopen|verify`). Runs *from the package* against a consumer repo
  (`NOTABENE_ROOT` / `NOTABENE_CONFIG`).
- **`packages/claude-plugin`** — the Claude Code plugin (3 skills + `overlays/`, the
  plugin-specific front-doors prepended to the generated skills).
- **The protocol is `docs/reference/agent-protocol.md`** (and the authoring palette
  `docs/guide/authoring.md`): canonical, hand-written, published. **Both plugin skills and
  `packages/renderer/protocol.md` are GENERATED from those pages** (`npm run
  gen:protocol`) — edit the page, never the outputs; CI regenerates and fails on any diff.

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
# bilingual demo (adds the other of en/fr): --i18n directory|suffix
# site-chrome seeds — branding assets, the theme contract (tokens + stylesheet + asset
# folder + dual code theme) and nav links (topbar icon, sidebar block, footer):
node scripts/gen-fixture.mjs --chrome
# public-scoping seeds (a private space, a publish.exclude'd wip/ sub-tree, a
# frontmatter publish:false page, `description` frontmatter, a `publish` block):
node scripts/gen-fixture.mjs --publish --i18n directory
node packages/renderer/bin/notabene.mjs build --root .demo --public --out /tmp/demo-public
grep -r "PRIVATE marker" /tmp/demo-public   # must find nothing
```

`--chrome` and `--publish` compose: with **both**, the chrome seeds add a `publish: false`
nav link (`NAV-PRIVATE`) on top of the non-asset file already sitting in the assets folder
(`ASSET-PRIVATE`), so the same grep covers the nav/theme surfaces. `--chrome` alone stays
demo-clean — it also feeds the customization GIFs (below).

The demo lands in a gitignored `.demo/` at the repo root (a nested git repo when `--git`),
so it's easy to browse and never gets committed.

### Demo GIFs

The GIFs in the READMEs and the docs are **recorded, never hand-made** — each is a script
that regenerates the fixture, starts a dev server on its own port, drives headless Chrome
and encodes with ffmpeg, so any of them can be re-shot after a UI change:

```bash
npm run gen:hero-gif      # the review loop (README hero)
npm run gen:mobile-gif    # the mobile drawer + comment sheet
npm run gen:diagrams-gif  # diagram lightbox + block comment
npm run gen:pdf-gif       # the Export PDF menu
npm run gen:i18n-gif      # the language switcher
npm run gen:nav-gif       # nav links: topbar · sidebar block · site footer
npm run gen:theme-gif     # theming: the scheme toggle recolours chrome, code and diagrams
```

Requires Google Chrome, ffmpeg on PATH, and `playwright-core` (a dev dep). Two traps
worth knowing before you write another one:

- **Never `locator.click()`/`hover()` on the topbar.** Playwright scrolls the target into
  view first, and for an element in a `position: sticky` header that means scrolling back
  to the header's static position — the page jumps to the top mid-take. Move/click the
  real mouse at the element's viewport coordinates instead (see `record-theme-demo.mjs`).
- **Seed the state you want to demo.** The scheme toggle cycles auto → light → dark, so
  the theme recorder writes `nb-scheme = "light"` before the first paint; otherwise the
  first click is an invisible auto→light no-op.

GIFs are encoded at **820px** — the width the docs embed them at, so nothing is resampled
in the browser. Keep them under ~3 MB: they're committed and served on every page view.

## The documentation site (dogfood)

`docs/` is the user documentation, and this repo is its own notabene consumer (root
`notabene.config.mjs`, store at `docs/.notabene`). **Review the docs with the tool they
document** — that is the fastest way to see a rendering change in a real corpus:

```bash
# The review server over THIS repo's docs → http://127.0.0.1:3009
node packages/renderer/bin/notabene.mjs dev --root .
node packages/renderer/bin/notabene.mjs dev --root . --detach   # background; survives the shell
node packages/renderer/bin/notabene.mjs status --root .         # running? which port?
node packages/renderer/bin/notabene.mjs stop   --root .         # stop the detached one
```

Run **one dev server at a time**: they share the renderer's `.astro` cache, and two
servers on different consumers produce spurious errors. `--detach` is idempotent (it
reuses a live daemon) and logs to the per-repo work dir printed at startup.

The site is in `review: "approve"`, so you can select text on any page, leave a comment,
let the agent apply it, and validate the diff at `/review` — the loop reviewing its own
documentation. What to look at beyond the pages themselves:

```bash
# The artifact GitHub Pages will serve (base sub-path included — catches link/base bugs)
node packages/renderer/bin/notabene.mjs build --root . --public \
  --site https://z29k.github.io --base /notabene --out /tmp/nb-site
node packages/renderer/bin/notabene.mjs lint --root .    # internal links, against the last build
```

…plus `/print` (the paper view: no topbar, no footer) and the header's scheme toggle —
a rendering change should be checked in **both** color schemes and at a compact width
(the topbar utils collapse into the drawer under 1024px).

`.github/workflows/docs.yml` deploys to z29k.github.io/notabene on push to `main`. The
READMEs are short landings — user-facing detail belongs in `docs/`, in one place.

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
- **The protocol is generated** — `docs/reference/agent-protocol.md` is the source of
  truth; run `npm run gen:protocol` after touching it and commit the outputs. Bump
  `PROTOCOL_VERSION` (`src/lib/protocol-gen.mjs`) when the spec changes materially — it
  is deliberately independent of the package version (a version that moved on every
  release would break the CI diff gate on every release commit).
- **The config module graph is `.mjs`-only** — anything `astro.config.mjs` can reach
  (integrations, remark plugins, `config.mjs`, and their imports). A `.ts` in that graph
  changes how Astro loads the config and breaks dynamic `import()` from integration
  closures at runtime (*"Vite module runner has been closed"*), which is subtle and only
  shows up in dev. Put shared helpers in `.mjs` with JSDoc types; `.ts` is for modules
  reached from pages/components only.
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
  # bump: packages/renderer/package.json · packages/claude-plugin/.claude-plugin/plugin.json
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
