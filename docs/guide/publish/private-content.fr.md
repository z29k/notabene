---
title: Garder du contenu privé
description: Trois niveaux de scoping — un espace entier, une sous-arborescence, une seule page — et la garantie qui les sous-tend.
sidebar:
  label: Contenu privé
  order: 2
---

# Garder du contenu privé

Trois niveaux, du plus grossier au plus fin — chacun vit là où vit ce qu'il délimite.

**Un espace entier** — marquez l'entrée `roots[]` :

```js
roots: [
  { key: "docs",  label: "Docs",  path: "docs" },
  { key: "notes", label: "Notes", path: "notes", publish: false },  // l'espace entier reste privé
],
```

**Une sous-arborescence** — des globs `publish.exclude` sur `<space key>/<page id>`
(c'est le chemin d'URL de la page sans préfixe de locale, donc **un seul motif masque
toutes les traductions**) :

```js
publish: { exclude: ["docs/internal/**", "docs/*/draft"] },
```

**Une seule page** — son propre frontmatter :

```yaml
---
publish: false   # cette page n'apparaît jamais dans un build public
---
```

**Un lien de navigation** — pas du contenu, mais la même idée : une
[entrée `nav`](../configuration.md#liens-de-navigation) marquée `publish: false` reste en
dev et n'atteint jamais l'artefact (un dashboard, un wiki interne) :

```js
nav: { header: [{ label: "Dashboard ops", href: "https://ops.internal", publish: false }] },
```

## La garantie

Le contenu privé n'est pas caché, il n'est **pas construit** — pas de route (l'URL
renvoie un 404), pas d'entrée dans la sidebar, pas de résultat de recherche, pas de
ligne `llms.txt`, pas de double `.md`, pas d'entrée de sitemap, pas d'inclusion
print/PDF, et le nom et le chemin de l'espace n'atteignent jamais le HTML public.

`notabene dev` et les builds normaux montrent toujours tout — vous
[passez en revue](../review-loop.md) vos docs privées exactement comme le reste. La
notion de `publish` n'existe **que** pour les builds publics.

## Une réserve : les liens vers du contenu privé

Si une page *publique* pointe vers une page *privée*, ce lien renvoie un 404 dans
l'artefact public — le build ne le réécrit pas et n'émet aucun avertissement.
**`notabene lint` attrape exactement cela** : lancez-le après `build --public` et chaque
lien d'une page publique vers du contenu exclu par le scoping est signalé (la vérité des
routes publique ne contient tout simplement pas ces pages — voir la
[référence CLI](../../reference/cli.md)).
