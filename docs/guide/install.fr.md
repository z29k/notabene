---
title: Installation
description: Deux briques installables — le plugin Claude Code et le renderer npm. Installez l'une ou les deux.
sidebar:
  order: 1
---

# Installation

notabene, c'est **deux briques installables** : le **plugin Claude Code** (mise en place
clé en main + la boucle de revue) et le **renderer** (un paquet npm + une CLI). Elles
s'installent indépendamment — le plugin n'a **pas** besoin du paquet npm : il récupère le
renderer tout seul.

## Le plugin Claude Code — mise en place + revue

Dans Claude Code :

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

C'est toute l'installation — **aucun `npm install` requis**. Le plugin récupère et
exécute lui-même une version épinglée du renderer via `npx` (le premier lancement la
télécharge, ~30 s) ; rien n'est scaffoldé dans votre repo, qui n'a même pas besoin d'un
`package.json`. Le seul prérequis est Node (voir [prérequis](#prérequis) plus bas).

Puis dites simplement **« configure notabene »** (repo vierge) ou **« traite les
commentaires de la doc »** (déjà configuré) — la bonne skill se déclenche d'elle-même.

Vous préférez une installation manuelle ? Copiez `packages/plugin/skills/notabene/` dans
le `.claude/skills/` de votre projet. Vous utilisez un tout autre agent ? Le plugin ne vous
sert à rien : `notabene init` écrit le même protocole dans `<store>/protocol.md` et le
référence depuis `AGENTS.md` (voir
[l'utiliser depuis n'importe quel agent](./review-loop.md#lutiliser-depuis-nimporte-quel-agent)).

## Le renderer — paquet npm (sans Claude)

Pour piloter la CLI vous-même — à la main, en CI, ou depuis un autre outil — installez le
paquet npm :

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

Installer les deux ne pose aucun problème : le plugin exécute toujours **sa propre
version épinglée du renderer** (alignée sur la version du plugin), indépendante de celle
de votre `package.json` — les deux ne se marchent jamais dessus.

## Prérequis

Les deux voies partagent les mêmes prérequis :

- **Node ≥ 22.12** et `npx` dans votre PATH (les deux sont fournis avec Node).
- N'importe quel repo avec des fichiers Markdown ou MDX — voir
  [MDX et CommonMark](./configuration.md) pour la façon dont les deux formats sont gérés.

Ensuite : [votre première revue](./first-review.md).
