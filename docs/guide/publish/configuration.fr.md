---
title: Configurer publish
description: Le bloc de config publish — site, base, exclude — avec les trois configurations d'hébergement typiques.
sidebar:
  label: Configurer publish
  order: 1
---

# Configurer `publish`

Tout vit sous une seule clé de config optionnelle — les flags CLI (`--site`/`--base`)
la surchargent, et `--out` copie l'artefact vers un chemin stable (il refuse d'écraser
quoi que ce soit qu'il n'a pas généré) :

```js
// notabene.config.mjs
export default {
  // …
  publish: {
    // ORIGINE déployée. Grave des URL absolues dans canonical, og:url, JSON-LD,
    // hreflang, llms.txt, le sitemap et la ligne Sitemap de robots.txt.
    // OPTIONNELLE — omettez-la pour garder le domaine hors du repo (voir
    // « Domaine géré côté serveur »). Origine seule, sans chemin : un sous-chemin va dans `base`.
    site: "https://you.github.io",

    // Sous-chemin quand le site est servi sous un préfixe (site de projet
    // GitHub Pages → "/<repo>"). Préfixe chaque lien et URL d'asset — contrairement
    // au domaine, un sous-chemin affecte toujours le rendu, il ne peut pas être côté serveur.
    base: "/your-repo",

    // Sous-arborescences à garder hors des builds publics — globs comparés à
    // `<space key>/<page id>` (indépendant de la locale : un motif masque chaque
    // traduction d'une page). `*` = un segment de chemin, `**` = toute profondeur.
    exclude: ["docs/internal/**", "docs/*/draft"],
  },
};
```

## Trois configurations typiques

```js
publish: { site: "https://you.github.io", base: "/my-repo" }  // GitHub Pages, site de projet
publish: { site: "https://docs.example.com" }                 // domaine personnalisé à la racine
publish: { exclude: ["docs/internal/**"] }                    // domaine gardé hors du repo
```

La troisième est le [mode agnostique à l'origine](./server-side-domain.md) — le même
artefact derrière n'importe quel domaine.

## Métadonnées par page

Deux clés de frontmatter alimentent les surfaces publiques (voir la
[référence complète du frontmatter](../../reference/frontmatter.md)) :

```yaml
---
description: One-line summary — becomes the meta description / OpenGraph.
publish: false   # cette page ne part jamais dans un build public
---
```

Exclure du contenu du build a sa propre page :
[garder du contenu privé](./private-content.md).
