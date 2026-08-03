---
title: Doc multilingue
description: Servez les mêmes docs en plusieurs langues — URL propres préfixées, sélecteur dans l'en-tête, commentaires par langue.
sidebar:
  label: Doc multilingue
  order: 8
---

# Doc multilingue (i18n)

Ajoutez `i18n` pour servir les mêmes docs en plusieurs langues avec des **URL propres
préfixées** (la locale par défaut sans préfixe, les autres en `/<locale>/…`), un
**sélecteur de langue** dans l'en-tête, des alternates `hreflang` et un chrome par
page — une page française affiche nav, boutons et dates en français.

```js
i18n: { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory" },
```

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-i18n-demo.gif" alt="i18n notabene : choisir une langue dans le sélecteur de l'en-tête, docs et chrome basculent" width="820" />
</p>

## Deux organisations des fichiers

Choisissez l'organisation des fichiers avec `strategy` :

- **`directory`** (par défaut) — un dossier par locale : `docs/en/guide.md` · `docs/fr/guide.md`.
- **`suffix`** — une seule arborescence, traduite fichier par fichier : `docs/guide.md`
  (défaut) · `docs/guide.fr.md`. Idéal pour ajouter des langues à une doc
  **existante** : les fichiers de la langue par défaut ne bougent pas, donc leurs URL
  *et* leurs fils de commentaires sont préservés.

## Préférence de langue & repli

Le sélecteur enregistre la langue choisie par le visiteur ; dès lors, arriver sur une
page écrite dans une autre langue qui *a* une traduction **redirige** vers celle-ci —
suivre n'importe quel lien vous garde dans votre langue. Une page **sans** traduction
se replie sur la langue source et affiche un bandeau discret. Les pages non liées à une
langue de contenu — `/comments`, `/journal`, `/review`, la page d'accueil et la
`404` — suivent votre langue courante côté client et embarquent le même sélecteur.

## Tout est par langue

- **Les commentaires sont par langue** — un commentaire sur la page FR est un fil à
  part, relié au fichier source FR.
- La recherche et l'[export PDF](./pdf-export.md) (`notabene pdf --locale fr`) sont
  limités à une langue ; un [site public](./publish/index.md) embarque des `llms.txt`
  et des doubles Markdown par locale.
- Toute chaîne humaine de la config accepte une map par locale : les
  `label`/`description` d'un espace (`label: { en: "Docs", fr: "Documentation" }`), la
  [page d'accueil personnalisée](./configuration.md) (`home: { en: …, fr: … }`), et chaque
  libellé de [lien de navigation](./configuration.md#liens-de-navigation), titre du bloc
  sidebar et ligne de pied de page. Non défini pour une locale → repli sur celle par défaut.

Omettez `i18n` pour une seule langue — le comportement est inchangé.
