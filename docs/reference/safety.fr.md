---
title: Modèle de sécurité
description: Pourquoi l'API d'écriture ne peut pas vous nuire — dev uniquement, liée au loopback, écritures gardées, identité par personne.
sidebar:
  label: Modèle de sécurité
  order: 6
---

# Modèle de sécurité

Les API d'écriture touchent votre git — elles sont donc cloisonnées, par construction.
Il y en a deux : l'**API de commentaires**, qui écrit le store, et l'**[éditeur dans la
page](../guide/editor.md)**, qui écrit votre source Markdown. Les règles ci-dessous
valent pour les deux ; l'éditeur en ajoute une qui lui est propre.

- **Dev uniquement.** Le chemin d'écriture n'existe que sous `notabene dev`. En
  `build`/`preview` les mutations renvoient `403`, et un
  [build public](../guide/publish/index.md) ne contient pas ces routes du tout.
- **Loopback par défaut.** Le serveur se lie à `127.0.0.1` ; l'API d'écriture n'est pas
  joignable depuis votre réseau sans opt-in explicite via `--host` /
  `NOTABENE_HOST=1` — réseaux de confiance uniquement.
- **Chaque écriture est gardée** au-delà du bind : les requêtes cross-origin sont
  refusées (anti-CSRF), un en-tête `Host` non-loopback est refusé en mode loopback
  (anti-DNS-rebinding), et — quand vous définissez `NOTABENE_TOKEN` — chaque écriture
  doit porter un `x-notabene-token` correspondant. Définir un token est **recommandé
  avec `--host`**.
- **L'éditeur refuse d'écrire un fichier non suivi.** Il touche votre *contenu*, pas
  seulement le store : git est donc le seul retour arrière qu'il puisse offrir — et
  `notabene dev` n'exige pas un dépôt. Un fichier que git ne suit pas est refusé,
  bruyamment, avec le remède. Contournable via `edit: { requireGit: false }`, ou éditeur
  désactivé entièrement via `edit: { enabled: false }`.
- **Une identité par personne.** Sur un hôte non-loopback, chaque visiteur est invité à
  renseigner son nom (+ e-mail optionnel) avant de naviguer, pour que les commentaires
  soient attribués à de vraies personnes plutôt qu'au défaut git du propriétaire du
  repo.
- **L'agent ne committe jamais sans demander** et ne supprime jamais le store en
  masse — cela fait partie du [protocole](./agent-protocol.md).
- **La CLI est une surface distincte.** Les règles ci-dessus encadrent l'API d'écriture
  **HTTP**. Les commandes qui écrivent dans le store (`comments done` / `reopen`,
  `journal add`) sont des commandes locales que *vous* — ou un agent dans votre terminal —
  lancez délibérément : ni serveur, ni port, ni réseau. Écriture atomique, un commentaire
  à la fois, et [`comments verify`](./cli.md) audite le résultat.

L'artefact public est l'image miroir : pas d'API d'écriture, pas de données du store,
pas d'identité —
[rien à garder, parce que rien n'est construit](../guide/publish/private-content.md).
