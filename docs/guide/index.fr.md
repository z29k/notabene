---
title: Qu'est-ce que notabene ?
description: Un site navigable sur le Markdown du repo, des commentaires façon Google Docs, et un agent qui applique les retours — le tout dans votre git.
sidebar:
  label: Qu'est-ce que notabene ?
  order: 0
---

# Qu'est-ce que notabene ?

*nota bene* — la marque de marge qui signifie **« à bien noter ».**

notabene rend le Markdown/MDX de votre repo comme un **site navigable avec des
commentaires de revue directement sur la page**, et fournit le **protocole de revue
humain↔agent** qui transforme ces commentaires en éditions. Le viewer est le support —
le protocole est le produit.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="démo notabene : commenter un passage, l'agent applique l'édition, validation du vrai diff" width="820" />
</p>

## Le problème qu'il résout

Corriger ou rédiger de la doc avec un agent IA oblige à mettre chaque changement en
mots : citer le passage, nommer la section — *« revoir la formulation de la section
3 »* — puis espérer que l'agent retrouve l'endroit exact dans la source. Passé deux ou
trois changements, c'est un pavé d'instructions dans un seul champ de chat.
L'instruction réelle a toujours été plus simple : *ce passage — le changer comme ça.*

notabene en fait l'interface. Sélectionnez le texte exact sur la page rendue — ou un
diagramme ou une image en entier — et laissez un commentaire à cet endroit. Le
commentaire ancré **est** l'instruction : situé, sans ambiguïté, rien à citer. L'agent
lit les commentaires, édite la source fidèlement, marque chaque commentaire résolu et
journalise *ce qui a changé & pourquoi*.

## La boucle, en 30 secondes

1. `npx notabene dev` → ouvrir le site, **sélectionner du texte → laisser un
   commentaire** (ou commenter une page, un diagramme ou une image en entier). Fils,
   résolution, mise en attente, une vue globale `/comments`.
2. Demander à l'agent : **« traite les commentaires de la doc ».**
3. L'agent lit `.notabene/`, édite les docs fidèlement, marque chaque commentaire
   **résolu** et ajoute une entrée de **journal** (quoi / pourquoi / quels
   commentaires).
4. Relire la trace sur `/journal` — ou [valider chaque diff vous-même](./review-loop.md)
   en mode approve.

## Tout est dans votre git

Commentaires et journal sont des **fichiers JSON** sous `.notabene/` — pas de SaaS, pas
de base de données, pas de compte. Ils voyagent avec le repo, diffent dans les PR, et
sont lisibles par n'importe quel agent : le protocole de revue est **file-I/O-first**
(ni serveur, ni port, ni MCP requis).

## Où aller ensuite

- [Installation](./install.md) — le renderer npm, le plugin Claude Code, ou les deux.
- [Votre première revue](./first-review.md) — du commentaire à l'édition journalisée.
- [Configuration](./configuration.md) — le fichier de config unique, par l'exemple.
- [Personnaliser le rendu](./customize.md) — branding, tokens, feuille de style.
- [La boucle de revue](./review-loop.md) — auto ou approve (diffs avec humain dans la boucle).
- [Doc multilingue](./multilingual.md) — EN/FR/… avec URL propres et sélecteur.
- [Export PDF](./pdf-export.md) — vues imprimables et PDF avec signets.
- [Publier un site public](./publish/index.md) — un site statique en lecture seule,
  lisible par les agents.

Plutôt les tableaux exhaustifs ? Direction l'espace **Référence** : la
[CLI](../reference/cli.md), chaque [clé de config](../reference/config.md), le
[frontmatter](../reference/frontmatter.md), le
[contrat du store](../reference/store-contract.md) et le
[modèle de sécurité](../reference/safety.md).
