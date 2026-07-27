---
title: Publier un site public
description: Un site statique en lecture seule, lisible par les agents, à partir de vos docs — sans UI de revue, sans données du store, déployable partout.
sidebar:
  label: Publier un site public
  order: 8
---

# Publier un site public

L'app de revue est un **outil local de dev** — mais les docs qu'elle rend méritent
souvent un foyer public. `build --public` produit un artefact **purement statique, en
lecture seule** fait pour ça :

```bash
notabene build --public --site https://you.github.io --base /your-repo --out ./_site
```

> Ce site même est construit ainsi — les docs de notabene, rendues et publiées par notabene.

## Ce qui reste, ce qui part

- **Tout l'interactif disparaît — structurellement.** Pas d'UI de commentaires, pas
  d'invite d'identité, pas de `/comments` / `/review` / `/journal`, pas d'API, et
  **rien du store `.notabene`**. Les routes ne sont pas verrouillées ; elles ne sont
  **pas construites**.
- **Ce qui reste** est l'expérience de lecture complète : nav, recherche, Mermaid +
  lightbox d'images, mode sombre, [i18n](../multilingual.md) (pages par locale,
  sélecteur, `hreflang`), [routes print/PDF](../pdf-export.md), `404`.
- **Né lisible par les agents.** Chaque page embarque un double Markdown à
  `<page>/index.md` (annoncé via `<link rel="alternate" type="text/markdown">`), le
  site embarque `/llms.txt` (un index machine de chaque page, par locale) et
  `/llms-full.txt` (la doc entière en un seul document Markdown dans l'ordre de
  lecture), plus `robots.txt`, un sitemap, des URL canoniques, des meta
  OpenGraph/Twitter et du JSON-LD. Essayez ici : [/llms.txt](/notabene/llms.txt).

## Recherche plein texte (optionnelle)

Le site public hérite de la recherche intégrée telle quelle. Installez
[Pagefind](https://pagefind.app) en dépendance de dev et `build --public` la promeut en
**recherche plein texte statique** :

```bash
npm i -D pagefind
```

Le build indexe l'artefact final : stemming par langue (un visiteur de `/fr/` cherche
dans un index français, avec les formes fléchies du français), extraits surlignés sous
chaque résultat, et un poids réseau qui reste faible quand la doc grandit — le
navigateur ne télécharge que les morceaux d'index utiles à la requête. Zéro
configuration, même champ de recherche. Non installé → le site public garde la
recherche JSON intégrée. Et le contenu privé ne peut pas fuiter dans l'index :
l'indexation s'exécute sur l'artefact, où les
[pages hors périmètre](./private-content.md) n'existent pas.

La même dépendance améliore aussi **l'app de revue `notabene dev`** : son index est
construit en direct depuis vos sources Markdown et rafraîchi quand elles changent —
aucun build en jeu. Deux différences propres au dev : le site de dev (donc son index)
inclut vos pages privées, et les résultats profonds par section (ancres de titres)
restent réservés au public.

## Où aller ensuite

- [Configurer `publish`](./configuration.md) — `site`, `base`, `exclude`, avec exemples.
- [Garder du contenu privé](./private-content.md) — portée par espace / sous-arborescence / page.
- [Domaine géré côté serveur](./server-side-domain.md) — omettre `site`, rester
  agnostique à l'origine.
- [Déployer via GitHub Pages](./github-pages.md) — le workflow prêt à l'emploi.

La boucle de dev est intacte : `notabene dev` et le simple `notabene build` se
comportent exactement comme avant — la publication est opt-in, par build.
