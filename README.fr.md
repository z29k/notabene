<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-logo.jpg" width="150" alt="logo notabene" />
</p>

<h1 align="center">notabene</h1>

<p align="center"><em>nota bene</em> - la marque de marge qui signifie <strong>« à bien noter ».</strong></p>

<p align="center">
  <strong>Des notes dans les marges des docs, directement sur la page rendue -<br />
  l'agent IA les applique, résout les fils et journalise <em>ce qui a changé &amp; pourquoi</em>.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@z29k/notabene"><img alt="npm" src="https://img.shields.io/npm/v/@z29k/notabene?logo=npm&amp;color=cb3837" /></a>
  <a href="https://github.com/z29k/notabene/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/z29k/notabene/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Node ≥ 22.12" src="https://img.shields.io/node/v/@z29k/notabene?logo=node.js&amp;color=5FA04E" />
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/npm/l/@z29k/notabene?color=3da638" /></a>
</p>

<p align="center"><a href="https://github.com/z29k/notabene#readme">English</a> · <strong>Français</strong> · <a href="https://z29k.github.io/notabene/">📖 Documentation</a></p>

---

**Itérer sur sa doc avec un LLM - des retours n'importe où, pas tassés dans un seul prompt.**
Un site de doc navigable avec commentaires multi-utilisateurs, auto-hébergé dans git - sans
SaaS, sans base de données. Le commentaire ancré **est** l'instruction : situé, sans
ambiguïté, rien à citer. L'agent le lit, édite la source et journalise *ce qui a changé &
pourquoi*.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="démo notabene : commenter un passage, l'agent applique l'édition, validation du vrai diff" width="900" />
</p>

## Comment ça marche (30 secondes)

1. `npx notabene dev` → ouvrir le site, **sélectionner du texte → laisser un commentaire**
   (ou commenter une page entière, un diagramme ou une image).
2. Demander à l'agent : **« traite les commentaires de la doc ».**
3. L'agent lit `.notabene/`, édite les docs fidèlement, marque chaque commentaire
   **résolu**, et ajoute une entrée de **journal** (quoi / pourquoi / quels commentaires).
4. Relire la trace sur `/journal` - ou valider chaque **vrai diff git** soi-même en
   [mode approve](https://z29k.github.io/notabene/guide/review-loop).

## Essayer

```bash
npm install -D @z29k/notabene   # ou pnpm / bun
npx notabene init               # écrit notabene.config.mjs + crée le store .notabene
npx notabene dev                # → http://localhost:3009
```

Sous Claude Code ? `/plugin marketplace add z29k/notabene` puis
`/plugin install notabene@z29k` - et dire simplement *« installe notabene »*.
→ [Guide d'installation](https://z29k.github.io/notabene/guide/install)

## Fonctionnalités

Chaque entrée est un lien vers la [documentation](https://z29k.github.io/notabene/)
(disponible en français via le sélecteur de langue du site) - creusez seulement là où
c'est utile :

- **[Commentaires ancrés](https://z29k.github.io/notabene/guide/first-review)** - sur une
  sélection de texte, une page entière, un **diagramme ou une image**. Fils, résolution,
  mise en attente, vue globale `/comments`, tactile sur mobile.
- **[La boucle de revue agent](https://z29k.github.io/notabene/guide/review-loop)** - un
  protocole file-I/O-first que n'importe quel agent peut suivre (ni serveur, ni port, ni
  MCP). Livré comme skill Claude Code ; le fichier de skill *est* la spec.
- **[Revue à deux temps](https://z29k.github.io/notabene/guide/review-loop)** - mode
  approve : l'agent propose, on valide chaque édition sur son **vrai diff git** (cascades
  comprises) sur `/review`.
- **[Un vrai site de doc](https://z29k.github.io/notabene/guide/configuration)** - espaces,
  sidebar pilotée par frontmatter, recherche, diagrammes **Mermaid** commentables avec
  lightbox pan/zoom, sélecteur clair/sombre, responsive.
- **[MDX *et* CommonMark/GFM](https://z29k.github.io/notabene/guide/configuration)** -
  `.md` tolérant, `.mdx` strict, mélangeables par extension.
- **[Doc multilingue](https://z29k.github.io/notabene/guide/multilingual)** - URL propres
  préfixées, sélecteur de langue, commentaires par langue, EN/FR/… .
- **[Export PDF](https://z29k.github.io/notabene/guide/pdf-export)** - page, dossier,
  espace ou doc entière : page de garde + sommaire cliquable dans le navigateur, ou un
  **PDF avec signets** via `notabene pdf`.
- **[À votre image](https://z29k.github.io/notabene/guide/customize)** - page d'accueil
  personnalisée, logo + favicon + carte sociale, et théming via les tokens `--nb-*`
  stables ou votre propre feuille de style (cascade layers : votre CSS gagne toujours).
- **[Publier un site public](https://z29k.github.io/notabene/guide/publish)** - un build
  statique en lecture seule avec **surface lisible par les agents** (`llms.txt`, doubles
  Markdown par page, sitemap, OpenGraph), scoping du contenu privé, **recherche plein
  texte** optionnelle (Pagefind : stemming par langue, extraits surlignés), workflow
  GitHub Pages fourni. Le [site de documentation](https://z29k.github.io/notabene/) est
  notabene qui se publie lui-même.
- **[Validation des liens](https://z29k.github.io/notabene/reference/cli)** - `notabene
  lint` vérifie chaque lien interne contre les routes que le dernier build a **réellement
  émises** - liens morts avec suggestions, et fuites public→privé après `build --public`.
- **[Un store natif git](https://z29k.github.io/notabene/reference/store-contract)** -
  commentaires + journal en JSON versionné dans le repo : diffs dans les PR, merges sans
  conflit, un schéma sur lequel les agents peuvent compter.
- **[Sûr par défaut](https://z29k.github.io/notabene/reference/safety)** - l'API d'écriture
  est dev-only, liée au loopback, gardée anti-CSRF/rebinding ; les builds publics n'en
  contiennent rien.

## Organisation du repo

- **`packages/renderer`** - le package npm `@z29k/notabene` (renderer Astro + CLI).
- **`packages/plugin`** - le plugin Claude Code (setup + la skill/protocole de revue).
- **`docs/`** - cette documentation, revue et publiée par notabene lui-même.

## Licence

[MIT](./LICENSE)
