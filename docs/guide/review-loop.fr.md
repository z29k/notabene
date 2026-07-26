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

Le plugin Claude Code se déclenche sur « traite les commentaires de la doc ». Pour tout
autre agent, pointez-le vers `packages/plugin/skills/notabene/SKILL.md` dans le repo —
ce fichier **est** la spec du protocole : layout du store, résolution des ancres,
règles de journalisation, étapes de vérification. La forme du store est elle-même un
contrat public versionné — voir la
[référence du store](../reference/store-contract.md).
