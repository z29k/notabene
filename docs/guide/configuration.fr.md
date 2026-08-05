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

## Liens de navigation

Une fois *dans* une page, plus rien ne ramène au repo, au produit ou aux releases. `nav`
ajoute ces liens sortants à trois endroits — une seule forme d'entrée partout :

```js
nav: {
  // Topbar, groupe de droite. Répliqué automatiquement dans le tiroir mobile.
  header: [
    { label: "GitHub", href: "https://github.com/vous/repo", icon: "github", iconOnly: true },
    { label: { en: "Product", fr: "Produit" }, href: "https://example.com" },
  ],
  // Un bloc titré sous l'arbre des espaces (le tiroir mobile l'affiche aussi).
  sidebar: {
    title: { en: "Resources", fr: "Ressources" },
    links: [
      { label: "Releases", href: "https://github.com/vous/repo/releases", icon: "star" },
      { label: "npm", href: "https://www.npmjs.com/package/votre-pkg", icon: "npm" },
    ],
  },
  // Le pied de page du site. Rien de configuré → aucun élément de pied de page.
  footer: {
    links: [{ label: "Licence", href: "/reference/licence" }],
    text: { en: "© 2026 vous — MIT", fr: "© 2026 vous — MIT" },
    poweredBy: false,
  },
},
```

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-nav-demo.gif" alt="liens de navigation notabene : l'icône du repo dans la topbar, un bloc Ressources sous l'arbre de la sidebar, un pied de page, et un lien de pied de page qui ramène à l'accueil" width="820" />
</p>

| Champ | Signification |
| --- | --- |
| `label` | Obligatoire. Une chaîne, ou une map `{ <locale>: string }` comme `roots[].label`. Sert aussi de nom accessible quand `iconOnly` |
| `href` | Obligatoire. Une URL `https://`/`http://`/`mailto:` (ouverte dans un nouvel onglet, `rel="noopener"`), **ou** un chemin du site `/…` (votre `publish.base` est appliqué pour vous) |
| `icon` | Au choix : `github`, `gitlab`, `npm`, `discord`, `slack`, `x`, `mastodon`, `rss`, `mail`, `book`, `home`, `star`, `download`, `external`. Monochrome — l'icône suit la couleur du lien, donc votre [thème](./customize.md) |
| `iconOnly` | Topbar uniquement : n'affiche que l'icône (le label devient son `aria-label`/infobulle). Ignoré ailleurs |
| `publish` | `false` garde le lien **hors** des [builds publics](./publish/index.md) — même idée que `roots[].publish` |

- Tout est **validé au chargement de la config** : une clé inconnue, une icône inconnue,
  un href en double ou une URL `javascript:` lèvent une erreur immédiatement plutôt que
  d'expédier un lien cassé — ou piégé — dans un site publié.
- Ces liens relèvent de l'*identité*, pas de l'outillage de revue : contrairement à
  Commentaires/Revue/Journal, ils apparaissent **en dev et dans les builds publics**. Ils
  n'apparaissent jamais dans les [vues print/PDF](./pdf-export.md) et restent hors de
  l'index de recherche.
- Gardez trois ou quatre entrées en topbar — `iconOnly` existe précisément parce que
  cette rangée est chargée. Les listes longues vont dans le bloc sidebar ou le pied de page.

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

## Pied de page : lien d'édition & dernière mise à jour

Deux touches sans configuration sous chaque page :

- **Mis à jour le** — la **date d'auteur** git de la page (un seul `git log` streamé par
  build ; une date `lastUpdated` en frontmatter la remplace ; silencieusement absente
  hors d'un repo git). Les builds publics l'émettent aussi en `article:modified_time`.
- **Modifier cette page** — posez `editPattern` et chaque page pointe vers sa source :

```js
editPattern: "https://github.com/vous/repo/edit/main/{path}",
```

  Il n'est rendu que là où l'[éditeur dans la page](./editor.md) n'est *pas* disponible :
  builds et sites publiés. Sous `notabene dev`, l'éditeur fait la même chose en mieux.

## Édition dans la page

Sous `notabene dev`, un ✎ dans la marge ouvre n'importe quel bloc à l'édition directement
dans la page — voir [Éditer dans la page](./editor.md). Actif par défaut et sans
configuration ; voici les réglages si besoin :

```js
edit: {
  enabled: true,      // false masque entièrement l'éditeur
  requireGit: true,   // false autorise l'écriture d'un fichier non suivi par git
},
roots: [
  { key: "reference", path: "docs/reference", edit: false },  // espace en lecture seule
],
```

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
