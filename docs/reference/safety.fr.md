---
title: Modèle de sécurité
description: Pourquoi l'API d'écriture ne peut pas vous nuire — dev uniquement, liée au loopback, écritures gardées, identité par personne.
sidebar:
  label: Modèle de sécurité
  order: 5
---

# Modèle de sécurité

L'API de commentaires écrit dans votre git — elle est donc cloisonnée, par
construction :

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
- **Une identité par personne.** Sur un hôte non-loopback, chaque visiteur est invité à
  renseigner son nom (+ e-mail optionnel) avant de naviguer, pour que les commentaires
  soient attribués à de vraies personnes plutôt qu'au défaut git du propriétaire du
  repo.
- **L'agent ne committe jamais sans demander** et ne supprime jamais le store en
  masse — cela fait partie du [protocole](./store-contract.md).

L'artefact public est l'image miroir : pas d'API d'écriture, pas de données du store,
pas d'identité —
[rien à garder, parce que rien n'est construit](../guide/publish/private-content.md).
