---
title: Installation
description: Deux briques installables — le renderer npm et le plugin Claude Code. Installez l'une ou les deux.
sidebar:
  order: 1
---

# Installation

notabene, c'est **deux briques installables** : le **renderer** (un paquet npm + une CLI)
et le **plugin Claude Code** (mise en place clé en main + la boucle de revue). Installez
l'une ou les deux.

## Le renderer — paquet npm

```bash
npm install -D @z29k/notabene   # or: pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # writes notabene.config.mjs + creates the .notabene store
npx notabene dev                # → http://localhost:3009
```

> Le paquet npm est scopé (`@z29k/notabene`) ; la commande CLI qu'il installe est
> simplement **`notabene`**, donc `npx notabene …` fonctionne tel quel.

`init` est la **seule** chose qui touche votre repo — il écrit `notabene.config.mjs` et
crée le store `.notabene/` (`init --detect` préremplit `roots[]` à partir des dossiers de
doc qu'il trouve). Le renderer lui-même **s'exécute depuis le paquet** : rien n'est
scaffoldé ni copié dans votre repo, et la mise à jour se résume à `npm update`.

La surface de commandes complète (build, pdf, status, migrate, comments, journal…) est
dans la [référence CLI](../reference/cli.md).

## Le plugin Claude Code — mise en place + revue

Dans Claude Code :

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

Puis dites simplement **« configure notabene »** (repo vierge) ou **« traite les
commentaires de la doc »** (déjà configuré) — la bonne skill se déclenche d'elle-même. Le
plugin récupère et exécute le renderer pour vous via `npx` ; rien n'est scaffoldé dans
votre repo.

Vous préférez une installation manuelle ? Copiez `packages/plugin/skills/notabene/` dans
le `.claude/skills/` de votre projet. Vous utilisez un tout autre agent ? Le fichier de
skill **est** la spec du protocole — pointez votre agent dessus (voir
[la boucle de revue](./review-loop.md)).

## Prérequis

- **Node ≥ 22.12** et `npx` dans votre PATH (les deux sont fournis avec Node).
- N'importe quel repo avec des fichiers Markdown ou MDX — voir
  [MDX et CommonMark](./configuration.md) pour la façon dont les deux formats sont gérés.

Ensuite : [votre première revue](./first-review.md).
