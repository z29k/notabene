---
title: Déployer via GitHub Pages
description: Le workflow prêt à l'emploi — build --public en CI, upload, déploiement. Ce site tourne dessus.
sidebar:
  label: GitHub Pages
  order: 4
---

# Déployer via GitHub Pages

Déployez sur n'importe quel hébergement statique. Pour **GitHub Pages** : Settings →
Pages → Source = **GitHub Actions**, puis :

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

Notes :

- Avec `publish: { site, base }` [défini dans votre config](./configuration.md), les
  flags `--site`/`--base` peuvent être omis entièrement.
- Hébergement sur un **domaine personnalisé** ou un site racine utilisateur/organisation ?
  Retirez `--base` et pointez `--site` vers votre domaine.
- L'artefact embarque un `.nojekyll`, donc les assets `_astro/` survivent même à
  l'hébergement classique par branche gh-pages.
- Ce site de documentation est déployé par exactement ce workflow —
  [voyez-le dans le repo](https://github.com/z29k/notabene/blob/main/.github/workflows/docs.yml).
