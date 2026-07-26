---
title: Configuration
description: Un seul fichier de config, données uniquement, à la racine du repo — espaces, format, store, mode de revue. Par l'exemple.
sidebar:
  order: 3
---

# Configuration

`notabene.config.mjs` à la racine de votre repo est le seul câblage. Les chemins sont
relatifs au repo. `notabene init` scaffolde un template commenté ; `notabene init
--detect` préremplit `roots[]` à partir des dossiers de doc qu'il trouve. Chaque clé est
optionnelle — cette page montre celles que vous toucherez vraiment ; la
[référence de config](../reference/config.md) les liste toutes.

```js
// notabene.config.mjs
export default {
  siteName: "My Project",
  tagline: "docs",
  locale: "en",

  // Format d'entrée : "commonmark" (tolérant, zéro MDX) ou "mdx" (.mdx strict + .md tolérant).
  format: "commonmark",

  // Espaces de doc. `key` = slug d'URL + espace du store ; `path` = dossier relatif au repo.
  roots: [
    { key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] },
    { key: "adr", label: "Decisions", path: "docs/adr", description: "Architecture decision records" },
  ],

  store: "docs/.notabene",   // commentaires + journal (committez ce dossier)
  review: "auto",            // "approve" = vous validez chaque édition avec un diff
  verify: [],                // vos propres checks post-édition (le build du renderer s'exécute toujours)
};
```

## Espaces (`roots[]`)

Chaque entrée devient un **espace** : sa propre section dans la sidebar, sa propre carte
sur la page d'accueil, son propre préfixe dans les ids de commentaires. Un root imbriqué
(comme `docs/adr` ci-dessus) l'emporte sur son parent pour les pages qu'il contient — le
chemin le plus spécifique fait loi. `label` et `description` acceptent une map par locale
quand l'[i18n](./multilingual.md) est activée.

## MDX et CommonMark/GFM

Le renderer choisit le processeur **selon l'extension du fichier** :

- **`.md`** → CommonMark/GFM, **tolérant**. `<email@x>`, `Promise<T>`, `{var}`, le HTML
  brut et les tableaux GFM se rendent tous sans crash.
- **`.mdx`** → MDX **strict** (JSX/expressions) — composants importables, mais les
  `<`/`{` hors blocs de code doivent être échappés.

`format: "mdx"` (le défaut de la config) active les deux, mélangeables dans un même repo.
`format: "commonmark"` (ce que `init` scaffolde) supprime entièrement la dépendance MDX —
le point de départ sûr et le plus tolérant pour un repo en Markdown pur.

## Branding

Pointez l'en-tête, l'onglet du navigateur et les cartes sociales vers vos propres
assets — des fichiers relatifs au repo, servis par le renderer (rien à copier nulle
part) :

```js
branding: {
  logo: "assets/logo.svg",           // image de la topbar, à côté du nom du site
  logoDark: "assets/logo-dark.svg",  // variante sombre optionnelle (sinon logo partout)
  favicon: "assets/favicon.svg",     // .svg / .ico / .png — non défini → une marque par défaut intégrée
  socialImage: "assets/og.png",      // og:image / twitter:image des builds PUBLICS
},
```

`socialImage` requiert [`publish.site`](./publish/configuration.md) — les crawlers
exigent une URL absolue. Le favicon couvre aussi les [vues print/PDF](./pdf-export.md).

## Page d'accueil personnalisée

Par défaut, la page d'atterrissage (`/`) affiche le nom du site et une carte par espace.
Pointez `home` vers un fichier Markdown pour rendre **votre propre accueil** au-dessus de
ces cartes — le classique est une intro façon README écrite *pour le site*, avec des
liens relatifs qui deviennent des routes :

```js
home: "docs/home.md",
```

- Pipeline complet : Mermaid, coloration du code, et **liens inter-docs réécrits** vers
  les routes du site — liez directement dans vos espaces (`[install](./guide/install.md)`).
- À garder de préférence **hors** de vos espaces (un doc dédié) : dans un espace, il se
  rendrait *aussi* comme une page normale de cet espace.
- Avec l'[i18n](./multilingual.md), passez une map par locale :
  `home: { en: "docs/home.md", fr: "docs/home.fr.md" }` — la page d'atterrissage de
  chaque locale (`/`, `/fr`) rend son propre fichier.
- La [page d'accueil](/notabene/) de ce site, c'est exactement ça — voir
  [`docs/home.md`](https://github.com/z29k/notabene/blob/main/docs/home.md).

## Labels & ordre de la sidebar

Par défaut, l'entrée d'une page dans la sidebar est son **nom de fichier humanisé**, et
les pages sœurs se trient alphabétiquement. Surchargez l'un ou l'autre par page via le
frontmatter — aucun préfixe numérique dans les noms de fichiers requis :

```yaml
---
title: Internal network map      # <title> de la page + fil d'Ariane (surcharge le H1)
sidebar:
  label: Network map             # texte de la sidebar (sinon title, sinon nom de fichier)
  order: 9                       # position parmi les pages sœurs (croissant)
---
```

- `order` trie en croissant ; les entrées qui n'en ont pas continuent de se trier
  alphabétiquement, après celles qui sont ordonnées. Groupes et pages partagent un même
  ordre.
- Un **dossier** est nommé et positionné par sa page d'atterrissage —
  `<folder>/index.md` (ou `readme.md`) — dont le frontmatter `sidebar` s'applique à tout
  le groupe ; cette page apparaît comme une entrée *Aperçu* localisée (renommable via
  `sidebar.indexLabel`).
- Ces labels se propagent aux fils d'Ariane et à l'[export PDF](./pdf-export.md).

La surface complète du frontmatter (y compris `description` et `publish` pour les
[sites publics](./publish/index.md)) est dans la
[référence du frontmatter](../reference/frontmatter.md).
