---
title: La boucle de revue
description: Le protocole file-I/O-first que n'importe quel agent peut suivre — et le mode approve optionnel, avec humain dans la boucle et vrais diffs git.
sidebar:
  label: La boucle de revue
  order: 5
---

# La boucle de revue

La boucle est le produit : des commentaires en entrée, des éditions fidèles en sortie,
le tout journalisé. Elle est conçue pour que **n'importe quel** agent puisse
l'exécuter — le protocole est un fichier de skill en texte brut qui lit et écrit le
store directement.

## Comment l'agent travaille

Tout est découvert depuis `notabene.config.mjs` — rien de codé en dur, ni serveur ni
port requis :

1. **Lire** les commentaires ouverts et non mis en attente depuis `<store>/` (un
   fichier JSON par commentaire).
2. **Localiser** la page source via `roots[]`, puis résoudre l'ancre textuelle avec
   tolérance (l'ancre stocke le texte cité + le contexte environnant + le titre le plus
   proche).
3. **Éditer** les docs fidèlement — un commentaire est une décision de l'utilisateur.
4. **Marquer** le commentaire résolu (ou `addressed` en mode approve) et **compléter le
   journal** : une entrée par passe, un enregistrement de changement par page touchée,
   relié aux ids des commentaires.
5. **Vérifier** : le build du renderer tourne toujours, puis `notabene lint` (les liens
   inter-docs validés contre les routes que le build vient d'émettre), puis vos checks
   `verify[]`.
6. **Rendre compte** et demander avant de committer — jamais de commit silencieux,
   jamais de suppression en masse.

Les commentaires qu'un relecteur met **en attente** (⏸) sont ignorés — ce sont vos
travaux en cours.

Les étapes 4 et 5 ont des primitives CLI, pour qu'un agent n'édite jamais le JSON du store
à la main : `notabene comments done <id…> --note … --journal <entryId>` choisit le bon
statut selon votre mode `review`, et **`notabene comments verify`** audite ce qu'il a écrit
— statuts, liens commentaire↔journal dans les deux sens, disposition des fichiers. Il sort
en code non nul sur un vrai problème : c'est donc aussi un garde-fou de CI sur le store que
vos agents committent.

## Mode approve : un humain valide chaque édition

Par défaut (`review: "auto"`), l'agent résout les commentaires directement. Passez
`review: "approve"` pour un flux avec **humain dans la boucle** :

- l'agent édite et marque chaque commentaire **`addressed`** au lieu de le résoudre ;
- vous validez sur **`/review`** (ou via le filtre *À valider* de `/comments`) ;
- vous voyez le **vrai diff git** de tout ce qui a changé pour ce commentaire —
  **cascades comprises** (un commentaire peut toucher plusieurs pages) ;
- **approuver** → résolu, ou **rejeter** → rouvert avec votre raison, que l'agent lit à
  sa prochaine passe ;
- le diff s'affiche en vue unifiée ou côte à côte, et un badge **Review** dans
  l'en-tête compte ce qui attend.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="mode approve : l'agent propose, vous validez le vrai diff" width="820" />
</p>

## L'utiliser depuis n'importe quel agent

Le protocole est une spec en texte brut, et `notabene init` **l'installe dans votre repo**
pour qu'aucun agent n'ait à la chercher :

- **`<store>/protocol.md`** — la spec complète, committée à côté des commentaires qu'elle
  décrit. Hors ligne, sans npm, sans réseau. C'est ce fichier que vous montrez à un agent.
- **`AGENTS.md`** — un bloc borné `<!-- notabene:begin -->…<!-- notabene:end -->` qui
  indique aux agents qui le lisent au démarrage (Codex CLI, Cursor, Gemini CLI, Zed,
  Amp…) où vivent les commentaires et le protocole. Rien hors des marqueurs n'est touché ;
  désactivable via `init --no-agents-md`.

Les deux se rafraîchissent en relançant `notabene init` (idempotent) — à faire après avoir
déplacé le store ou renommé un espace, et `notabene doctor` signale la dérive. Ce texte,
c'est la page [protocole agent](../reference/agent-protocol.md) de ce site — la version
canonique, avec un jumeau Markdown dans les builds publics pour les agents qui naviguent ;
`npx -y @z29k/notabene@latest protocol` l'imprime hors ligne.

Dans Claude Code, la skill du plugin **est** ce protocole : elle se déclenche sur « traite
les commentaires de la doc » et n'a besoin d'aucun AGENTS.md. La forme du store est
elle-même un contrat public versionné — voir la
[référence du store](../reference/store-contract.md).
