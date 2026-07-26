---
title: Frontmatter
description: Chaque clé qu'une page peut porter — titres, placement dans la sidebar, métadonnées de build public et scoping.
sidebar:
  label: Frontmatter
  order: 3
---

# Frontmatter

Du YAML optionnel tout en haut d'une page. Tout a un défaut raisonnable — un repo sans
aucun frontmatter se rend très bien (noms de fichiers humanisés, ordre alphabétique).

```yaml
---
title: Internal network map        # <title> de la page + fil d'Ariane (prime sur le premier H1)
description: Segments and VLANs.   # builds publics : meta description + OpenGraph + JSON-LD
publish: false                     # builds publics : exclut cette page entièrement
lastUpdated: 2026-05-04            # pied de page : prime sur la date git « Mis à jour le »
sidebar:
  label: Network map               # texte de la sidebar (sinon title, sinon nom de fichier humanisé)
  order: 9                         # position parmi les pages sœurs (croissant)
  indexLabel: Start here           # pages d'accueil de dossier : renomme l'entrée « Aperçu »
---
```

| Clé | Effet |
| --- | --- |
| `title` | `<title>` de la page, fil d'Ariane, titre du résultat de recherche. Se replie sur le premier `# H1`, puis sur le nom du fichier |
| `description` | [Builds publics](../guide/publish/index.md) : `<meta name="description">`, description OpenGraph/Twitter, JSON-LD |
| `publish: false` | [Builds publics](../guide/publish/private-content.md) : la page n'est **pas construite** — ni route, ni nav, ni recherche, ni llms, ni double, ni sitemap. Les builds dev/normaux la montrent toujours |
| `lastUpdated` | Prime sur la [date dérivée de git](../guide/configuration.fr.md#pied-de-page--lien-dédition--dernière-mise-à-jour) dans le *Mis à jour le* du pied de page. Toute date que YAML sait parser. Utile quand l'historique git induit en erreur (contenu importé ou généré) |
| `sidebar.label` | Texte de l'entrée dans la sidebar. Résolution : `sidebar.label` → `title` → nom de fichier humanisé |
| `sidebar.order` | Clé de tri parmi les pages sœurs, croissante. Les entrées sans valeur gardent l'ordre alphabétique, après celles qui sont ordonnées. Groupes et pages partagent un seul ordre |
| `sidebar.indexLabel` | Sur la page d'accueil d'un dossier : renomme son entrée *Aperçu* localisée |

## Dossiers

Un **dossier** est nommé et positionné par sa page d'accueil — `<folder>/index.md` (ou
`readme.md`) : son frontmatter `sidebar` s'applique au groupe entier, et la page
elle-même apparaît comme l'entrée *Aperçu* du groupe. Labels et ordre se propagent aux
fils d'Ariane et aux [couvertures PDF](../guide/pdf-export.md).

Les clés inconnues sont ignorées et préservées — les agents qui éditent une page doivent
garder le frontmatter existant intact (le skill de revue le fait).
