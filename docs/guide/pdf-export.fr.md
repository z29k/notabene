---
title: Export PDF
description: Des vues prêtes à imprimer de n'importe quelle portée depuis le navigateur, ou un fichier PDF avec signets depuis la CLI.
sidebar:
  label: Export PDF
  order: 8
---

# Export PDF

Transformez n'importe quelle **page**, n'importe quel **dossier**, n'importe quel
**espace** ou la **doc entière** en un document soigné. Deux chemins, un même rendu
optimisé pour l'impression (page de couverture + table des matières cliquable, palette
forcée en clair pour que les diagrammes en mode sombre restent lisibles sur papier).

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-pdf-demo.gif" alt="menu Export PDF : choisir une portée, obtenir une vue prête à imprimer avec couverture et TOC cliquable" width="820" />
</p>

## Dans le navigateur — zéro dépendance

Le menu **Export PDF** de l'en-tête propose la page courante, son dossier, son espace
ou la doc entière. Il ouvre une vue `/print` dans un nouvel onglet et déclenche
automatiquement l'*Enregistrer au format PDF* de votre navigateur. Les routes `/print`
sont statiques — elles existent en dev **et** dans tout build (y compris les
[sites publics](./publish/index.md)).

## `notabene pdf` — l'artefact haute fidélité

```bash
notabene pdf --scope space:docs --out docs.pdf
```

Construit le site, pilote un Chromium headless et écrit un PDF avec un **vrai plan de
signets** (le panneau latéral navigable) et des numéros de page en pied. Flags :
`--scope doc|space:K|folder:K/P|page:K/I`, `--locale`, `--out`, `--chrome`.

Requiert la peer dependency optionnelle `puppeteer` (ou `puppeteer-core` plus
`--chrome <path>` / `PUPPETEER_EXECUTABLE_PATH` pointant vers un Chrome système) :

```bash
npm i -D puppeteer
```

## Réglages

```js
pdf: { enabled: true, pageSize: "A4", margin: "18mm" },
```

`enabled: false` masque le menu Export et retire les routes `/print`.
`pageSize`/`margin` alimentent la boîte CSS `@page`. Couvertures et titres de section
réutilisent les [labels et l'ordre](./configuration.md) de la sidebar, si bien que le
PDF se lit dans le même ordre que le site.
