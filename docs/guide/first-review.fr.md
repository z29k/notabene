---
title: Votre première revue
description: Du commentaire sur la page rendue à l'édition journalisée dans votre git — la boucle cœur, pas à pas.
sidebar:
  label: Première revue
  order: 2
---

# Votre première revue

Vous avez [installé](./install.md) le renderer et lancé `npx notabene dev`. Voici la
boucle complète, une fois, de bout en bout.

## 1 · Commenter la page rendue

Ouvrez `http://localhost:3009`, naviguez vers n'importe quelle page et **sélectionnez un
passage** — une barre d'action apparaît ; laissez votre commentaire là, directement. Vous
pouvez aussi :

- commenter une **page entière** (la zone de commentaire en bas de chaque page) ;
- commenter un **diagramme ou une image en entier** — survolez-le et utilisez le 💬 de
  la barre d'outils (le ⤢ juste à côté ouvre une lightbox pan/zoom) ;
- **répondre** dans les fils, placer un commentaire en **mise en attente** (⏸ — l'agent
  le sautera), et tout voir, toutes pages confondues, sur **`/comments`**.

Sur téléphone ou tablette, la même boucle fonctionne d'abord au tactile : la nav se
replie dans un tiroir, les commentaires deviennent des bottom sheets, et vous pouvez
sélectionner du texte et commenter au pouce.

## 2 · Confier les commentaires à votre agent

Dites-le à votre agent — avec le plugin Claude Code, c'est simplement :

> traite les commentaires de la doc

L'agent lit le store `.notabene/` directement (aucun serveur requis), localise chaque
passage commenté dans le fichier **source**, applique le retour fidèlement, marque le
commentaire **résolu**, et ajoute une entrée de **journal** reliant *ce qui a changé* à
*pourquoi*. Il vérifie ensuite : le build du renderer s'exécute toujours, plus les checks
que vous listez dans [`verify[]`](../reference/config.md). Il ne commite jamais sans
demander.

## 3 · Relire la trace

- **`/journal`** — chaque passe, avec quoi/pourquoi/quels commentaires, par page.
- Chaque commentaire résolu pointe vers son entrée de journal.

Vous voulez **valider chaque édition vous-même** avant qu'elle compte comme résolue —
avec le vrai diff git ? C'est le mode approve : voir
[la boucle de revue](./review-loop.md).

## Travailler à plusieurs relecteurs

Les commentaires portent une **identité** (nom + email optionnel), définie par navigateur
via la pastille 👤 de l'en-tête — les fils s'attribuent donc par personne, pas par
machine. Le store, c'est **un fichier JSON par commentaire**, donc les branches
parallèles fusionnent sans conflit.
