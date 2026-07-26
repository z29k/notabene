---
title: Deploy via GitHub Pages
description: The ready-made workflow — build --public in CI, upload, deploy. This site runs on it.
sidebar:
  label: GitHub Pages
  order: 4
---

# Deploy via GitHub Pages

Deploy anywhere static. For **GitHub Pages**: Settings → Pages → Source =
**GitHub Actions**, then:

```yaml
# .github/workflows/docs.yml
name: docs
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx notabene build --public
          --site https://${{ github.repository_owner }}.github.io
          --base /${{ github.event.repository.name }}
          --out ./_site
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./_site }
      - id: deployment
        uses: actions/deploy-pages@v4
```

Notes:

- With `publish: { site, base }` [set in your config](./configuration.md), the
  `--site`/`--base` flags can be dropped entirely.
- Hosting at a **custom domain** or a user/org root site? Drop `--base` and set `--site`
  to your domain.
- The artifact ships a `.nojekyll`, so `_astro/` assets survive even classic
  gh-pages-branch hosting.
- This documentation site is deployed by exactly this workflow —
  [see it in the repo](https://github.com/z29k/notabene/blob/main/.github/workflows/docs.yml).
