---
title: Clés de configuration
description: Toute la surface de notabene.config.mjs, en un seul tableau.
sidebar:
  label: Clés de configuration
  order: 2
---

# Clés de configuration

`notabene.config.mjs` est un module ES **de données uniquement** à la racine de votre
repo ; chaque clé est optionnelle. La version narrative, avec exemples, se trouve dans
le [guide de configuration](../guide/configuration.md).

| Clé | Défaut | Signification |
| --- | --- | --- |
| `siteName` / `tagline` | `"Docs"` / `"docs"` | Marque de l'en-tête |
| `locale` | `"en"` | Langue de l'UI + collation du tri de la nav |
| `format` | `"mdx"` | `"mdx"` (.mdx strict + .md tolérant) ou `"commonmark"` (pas de MDX du tout). `init` génère `"commonmark"` |
| `mdxComponents` | — | [Composants des pages `.mdx`](../guide/configuration.md#composants-mdx-mdxcomponents) : un module JS/TS relatif au repo dont l'**export par défaut** associe des noms à des composants, passé à chaque rendu (page, print/PDF, build public). Exige `format: "mdx"` — validé au chargement, comme l'existence et l'extension du fichier |
| `roots[]` | `[{docs}]` | Espaces de doc : `{ key, label, path, exclude, description, publish, edit, mdxComponents }`. `label`/`description` acceptent une map par locale avec l'i18n ; `publish: false` garde l'espace hors des [builds publics](../guide/publish/private-content.md) ; `mdxComponents` remplace la carte globale pour cet espace |
| `store` | `"docs/.notabene"` | Dossier commentaires + journal — committez-le ([contrat](./store-contract.md)) |
| `home` | — | [Page d'accueil personnalisée](../guide/configuration.md) : un fichier Markdown relatif au repo (ou une map par locale) rendu au-dessus des cartes d'espaces sur `/` |
| `branding` | — | [Assets d'identité](../guide/configuration.md) : `{ logo, logoDark, favicon, socialImage }`, fichiers relatifs au repo servis sous `/_nb/…`. Favicon non défini → une marque par défaut intégrée |
| `theme` | — | [Personnalisation du rendu](../guide/customize.md) : `{ tokens, css, assets, code }` — surcharges de tokens `--nb-*` (validées ; une coquille lève une erreur), une feuille de style chargée après celle du renderer (sûre vis-à-vis des cascade layers), un dossier du repo servi sous `/_nb/assets/…` pour les polices/images (allow-list d'extensions, pas de traversée), un thème Shiki pour le code (`"github-light"` ou `{ light, dark }` — les deux palettes suivent le sélecteur de schéma), et `mermaid: false` pour garder la palette de diagrammes propre à Mermaid |
| `nav` | — | [Liens sortants](../guide/configuration.md) : `{ header[], sidebar: { title, links[] }, footer: { links[], text, poweredBy } }`. Une seule forme d'entrée — `{ label, href, icon, iconOnly, publish }` ; `label` accepte une map par locale, `publish: false` garde un lien hors des builds publics. Validé au chargement (allow-list de schémas, noms d'icônes, doublons) |
| `port` | `3009` | Port d'`astro dev` |
| `host` | `false` | `true`/`NOTABENE_HOST=1`/`--host` expose l'API d'écriture au LAN ([sécurité](./safety.md)) |
| `verify[]` | `[]` | Vérifications post-édition que l'agent exécute (le build du renderer s'exécute toujours) |
| `review` | `"auto"` | `"auto"` = l'agent résout les commentaires ; `"approve"` = l'agent propose (`addressed`), vous validez chacun sur `/review` avec un diff ([boucle de revue](../guide/review-loop.md)) |
| `author` | git `user.name` | Auteur de commentaire par défaut ; chaque navigateur le remplace par appareil via le dialogue d'identité |
| `authorEmail` | git `user.email` | E-mail d'auteur par défaut ; intégré façon git (`Name <email>`) pour garder les identités uniques |
| `edit` | `{ enabled: true, requireGit: true }` | [Éditeur dans la page](../guide/editor.md) (dev uniquement) : `enabled` affiche l'affordance et injecte l'API d'écriture ; `requireGit: false` autorise l'écriture d'un fichier non suivi par git. Par espace : `roots[].edit: false` le passe en lecture seule |
| `editPattern` | — | Lien « Modifier cette page » sous chaque page : une URL avec un placeholder `{path}` (chemin source relatif au repo), ex. `https://github.com/o/r/edit/main/{path}`. Placeholder obligatoire — validé au chargement |
| `pdf` | `{ enabled: true, pageSize: "A4", margin: "18mm" }` | [Export PDF](../guide/pdf-export.md) — `enabled` active le menu Export + les routes `/print` ; `pageSize`/`margin` définissent la boîte `@page` |
| `i18n` | — | [Doc multilingue](../guide/multilingual.md) : `{ locales, defaultLocale, strategy: "directory"\|"suffix" }`. Omettez pour une seule langue |
| `publish` | — | Cible du [build public](../guide/publish/configuration.md) : `{ site, base, exclude }`. `site` optionnel — omis = [artefact agnostique de l'origine](../guide/publish/server-side-domain.md) |

## Surcharges CLI/env

`--site`/`--base` surchargent `publish.site`/`publish.base` ; `NOTABENE_HOST=1` équivaut
à `host: true` ; la CLI passe l'identité git du repo comme repli pour
`author`/`authorEmail`. Rien d'autre n'est configurable hors de ce fichier.
