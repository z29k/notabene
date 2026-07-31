# notabene

*nota bene* — the margin mark that means **"note this well."**

**Leave notes in the margins of your repo's docs — right on the rendered page — then let
your AI agent apply them, resolve the threads, and journal *what changed & why*.** The
anchored comment **is** the instruction: located, unambiguous, nothing to quote. No SaaS,
no database — everything lives as JSON in your git.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="notabene demo: comment a passage, the agent applies the edit, you approve the real diff" width="820" />
</p>

## The loop, in 30 seconds

1. `npx notabene dev` → open the site, **select any text → leave a comment** (or comment
   a whole page, diagram or image).
2. Tell your agent: **"address the doc comments."**
3. The agent reads `.notabene/`, edits the docs faithfully, marks each comment
   **resolved**, and appends a **journal** entry — or, in
   [approve mode](./guide/review-loop.md), waits for you to validate the **real git
   diff** of every edit.
4. Read the trail at `/journal`.

## Start here

- **[Install](./guide/install.md)** — the npm renderer, the Claude Code plugin, or both;
  then **[your first review](./guide/first-review.md)** end to end.
- **[Configuration](./guide/configuration.md)** — one data-only file: spaces, format,
  sidebar, review mode.

## Go deeper

- **[The review loop](./guide/review-loop.md)** — the file-I/O-first protocol any agent
  can follow, and the human-in-the-loop approve mode.
- **[Customize the look](./guide/customize.md)** — branding, `--nb-*` design tokens,
  your own stylesheet, fonts, code and diagram themes.
- **[Navigation links](./guide/configuration.md#navigation-links)** — send readers back to
  the repo, the releases, the product: topbar, a sidebar block, a site footer.
- **[Multi-language docs](./guide/multilingual.md)** — clean prefixed URLs, a switcher,
  per-language comments.
- **[PDF export](./guide/pdf-export.md)** — print-ready views, bookmarked PDFs.
- **[Publish a public site](./guide/publish/index.md)** — the read-only, agent-readable
  static build. **This site is one**: it ships [`/llms.txt`](/notabene/llms.txt), a
  Markdown twin per page, and was deployed by the
  [GitHub Pages workflow](./guide/publish/github-pages.md).

Exhaustive tables live in the [Reference](./reference/index.md): the
[CLI](./reference/cli.md), every [config key](./reference/config.md), the
[frontmatter](./reference/frontmatter.md), the
[store contract](./reference/store-contract.md) and the
[safety model](./reference/safety.md).
