---
title: CLI
description: Chaque commande et flag notabene.
sidebar:
  label: CLI
  order: 1
---

# CLI

Le package npm est scopé (`@z29k/notabene`) ; la commande installée est simplement
**`notabene`**, donc `npx notabene …` fonctionne tel quel.

| Commande | Ce qu'elle fait |
| --- | --- |
| `notabene doctor` | État en lecture seule au format JSON : config/store/port + dossiers de doc détectés — `--json` |
| `notabene init` | Écrit `notabene.config.mjs` + crée le store (sans effet s'il existe déjà) ; `--detect` auto-détecte les dossiers de doc |
| `notabene dev` | Démarre le serveur de revue sur les docs de ce repo (rechargement à chaud) ; `--detach` le lance en démon d'arrière-plan. Avec la dépendance de dev optionnelle `pagefind`, sa recherche devient [plein texte](../guide/publish/index.md#recherche-plein-texte-optionnelle) aussi |
| `notabene status` | Le serveur détaché tourne-t-il ? (pid, port, URL) — `--json` |
| `notabene stop` | Arrête le serveur détaché |
| `notabene build` | Construit le site (Node standalone ; docs prérendues, pas d'API d'écriture dans l'artefact) |
| `notabene build --public` | Site **statique** en lecture seule pour hébergement public — [voir le guide](../guide/publish/index.md). `[--site URL] [--base /sub] [--out DIR]`. Avec la dépendance de dev optionnelle `pagefind`, l'artefact gagne une [recherche plein texte statique](../guide/publish/index.md#recherche-plein-texte-optionnelle) |
| `notabene preview` | Sert le site construit |
| `notabene lint` | Valide les liens inter-docs contre les routes émises par le **dernier build** (suggestions « did you mean » ; `--json`). Après `build --public`, attrape aussi les liens de pages publiques vers du [contenu privé](../guide/publish/private-content.md). Exit 1 = liens cassés, 2 = pas encore de build |
| `notabene pdf` | Exporte un PDF via Chromium headless (sommaire de signets + numéros de page) ; `--scope doc\|space:K\|folder:K/P\|page:K/I`, `--locale`, `--out`, `--chrome`. Nécessite la peer dep optionnelle `puppeteer` (ou `puppeteer-core` + `--chrome`) |
| `notabene migrate` | Convertit le store vers la disposition un-fichier-par-commentaire (estampille `schemaVersion` 3) |
| `notabene comments ls` | Liste les commentaires — `--open` `--json` `--page <p>` (pour agents/scripts) |
| `notabene journal add` | Ajoute une entrée de journal JSON lue depuis stdin |

## Flags globaux

| Flag | Signification |
| --- | --- |
| `--root <path>` | Racine du repo consommateur (défaut : cwd) |
| `--config <path>` | Chemin de la config (défaut : `<root>/notabene.config.mjs`) |
| `--port <n>` | Port du serveur de dev (sinon la config `port`, sinon un port libre) |
| `--detach` | `dev` uniquement : démon d'arrière-plan (géré par `status`/`stop`) |
| `--detect` | `init` uniquement : préremplit `roots[]` avec les dossiers de doc trouvés |
| `--host` | Expose sur le LAN — réseaux de confiance uniquement ([sécurité](./safety.md)) |
| `--public` / `--site` / `--base` / `--out` | `build` uniquement : l'artefact de [site public](../guide/publish/index.md) |
