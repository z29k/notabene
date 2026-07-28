---
title: Le contrat du store .notabene
description: Le schéma JSON versionné que les agents lisent et écrivent — commentaires, journal, migrations.
sidebar:
  label: Contrat du store
  order: 4
---

# Le contrat du store `.notabene`

Le store est un **contrat public versionné** — committé dans votre repo, lu et écrit par
les agents. Sa forme ne change jamais silencieusement : `<store>/meta.json` porte
`{ "schemaVersion": n }` (actuellement **3**), et tout changement de forme s'accompagne
d'un migrateur (`notabene migrate`).

## Disposition

```
<store>/
  meta.json                # { "schemaVersion": 3 }
  journal.json             # un tableau d'entrées de journal
  protocol.md              # le protocole agent (écrit par `init` ; ce n'est pas de la donnée)
  <page>/<comment-id>.json # UN FICHIER PAR COMMENTAIRE → merges git sans conflit
```

`meta.json`, `journal.json` et `protocol.md` sont des **noms réservés** à la racine du
store ; tout le reste est de la donnée de commentaire. Les lecteurs ne parsent que du
`.json`, donc `protocol.md` est inerte — il voyage avec le store pour que la spec soit
toujours à côté des commentaires.

`<page>` est le chemin logique de la page (`docs/guide/setup` — avec l'i18n c'est l'id
brut encodant la locale, les commentaires sont donc par langue). Les anciens stores v1
(un tableau par page) sont toujours lus ; toute écriture migre la page concernée.

## Un commentaire

```jsonc
{ "id", "space", "page", "scope",            // scope : "selection" | "page" | "block"
  "anchor": {                                 // selection : citation de texte façon W3C
    "quote", "prefix", "suffix", "section"    // texte rendu + contexte + titre le plus proche
  } | { "kind", "key", "label",               // block (diagramme/image) : clé dérivée du contenu
        "section", "index" } | null,
  "thread": [{ "author", "body", "ts" }],     // author peut être façon git "Name <email>"
  "status": "open" | "addressed" | "resolved",
  "hold": false,                              // true → l'agent l'ignore (WIP du relecteur)
  "resolution": { "note", "journalEntryId" } | null,
  "createdAt", "updatedAt" }
```

`addressed` est l'état de la [revue en deux phases](../guide/review-loop.md) : proposé
par l'agent, en attente de validation humaine sur `/review`.

## Une entrée de journal

```jsonc
{ "id", "date",                               // YYYY-MM-DD
  "title", "summary",
  "changes": [{ "page", "commentIds": [], "what", "why" }] }
```

Un enregistrement `changes[]` **par page réellement touchée** — le diff de `/review` est
construit en inversant le journal, donc une page qui n'y figure pas n'apparaîtra pas
dans le diff du relecteur. Le `resolution.journalEntryId` de chaque commentaire résolu
pointe vers son entrée.

## Règles que les agents doivent honorer

- Les écritures sont **atomiques** (fichier temporaire + rename) — ne jamais écrire du
  JSON partiel à la main. La CLI (`comments done` / `reopen`, `journal add`) s'en charge ;
  `comments verify` audite le résultat.
- **Ne jamais supprimer le store en masse** ; supprimez un commentaire précis par id si
  on vous le demande.
- Ne traiter que `status: "open"` **et** `hold: false`.
- Le protocole complet vit dans **[`<store>/protocol.md`](./agent-protocol.md)** — écrit par
  `notabene init`, committé avec le store, rafraîchi en relançant `init`. Pointez-y
  n'importe quel agent.
