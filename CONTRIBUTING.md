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

The renderer has no unit tests yet; validate by building against a scratch consumer:

```bash
cd /tmp/nb-scratch && node …/bin/notabene.mjs build   # must complete with 0 errors
```

Test both formats (`format: "mdx"` and `"commonmark"`) and both a fresh EN config and
a `locale: "fr"` config when touching UI strings.

## Pull requests

Keep PRs focused. Describe what changed and why. For anything touching the
`.notabene` contract or the CLI surface, call it out explicitly.
