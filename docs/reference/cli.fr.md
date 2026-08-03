---
title: CLI
description: Chaque commande et flag notabene.
sidebar:
  label: CLI
  order: 1
---

# CLI

Le package npm est scopé (`@z29k/notabene`) ; la commande installée est simplement
**`notabene`**, donc `npx notabene …` fonctionne tel quel **dès lors que le package est
une dépendance de votre repo**. Sans installation locale, utilisez toujours le nom scopé —
`npx -y @z29k/notabene@latest …` — car `notabene` non scopé n'est **pas** notre package.

| Commande | Ce qu'elle fait |
| --- | --- |
| `notabene doctor` | État en lecture seule au format JSON : config/store/port/éditeur + dossiers de doc détectés — `--json` |
| `notabene init` | Écrit `notabene.config.mjs` + crée le store (sans effet s'il existe déjà) ; `--detect` auto-détecte les dossiers de doc. Écrit aussi le [point d'entrée agent](./agent-protocol.md) : `<store>/protocol.md` + un bloc borné dans `AGENTS.md` — désactivables via `--no-protocol` / `--no-agents-md`. Idempotent : relancez-le pour rafraîchir les deux |
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
| `notabene comments done` | Marque des commentaires traités : `done <id…> [--note <texte>] [--journal <entryId>]`. **Le statut vient de `review`** (auto → `resolved`, approve → `addressed`) — `--status` force, `--force` agit sur un commentaire en attente (hold). Écriture atomique ; tous les autres champs préservés |
| `notabene comments reopen` | Renvoie des commentaires à `open` : `reopen <id…> [--reply <texte>] [--author <nom>]` — la raison devient une réponse du thread que l'agent lira à la passe suivante (le pendant CLI du rejet sur `/review`) |
| `notabene comments verify` | Audite le store : statuts, liens commentaire↔journal **dans les deux sens**, disposition des fichiers, doublons, pages disparues. `--json` ; exit 1 si erreurs, 2 sans store. À lancer après une passe d'agent, ou en CI |
| `notabene journal add` | Ajoute une entrée de journal JSON lue depuis stdin (écriture atomique ; `--json` renvoie `{ id }` pour chaîner côté agent) |
| `notabene protocol` | Imprime le [protocole agent](./agent-protocol.md) sur stdout — `--path` affiche son chemin, `--write` rafraîchit `<store>/protocol.md` |

## Flags globaux

| Flag | Signification |
| --- | --- |
| `--root <path>` | Racine du repo consommateur (défaut : cwd) |
| `--config <path>` | Chemin de la config (défaut : `<root>/notabene.config.mjs`) |
| `--port <n>` | Port du serveur de dev (sinon la config `port`, sinon un port libre) |
| `--detach` | `dev` uniquement : démon d'arrière-plan (géré par `status`/`stop`) |
| `--detect` | `init` uniquement : préremplit `roots[]` avec les dossiers de doc trouvés |
| `--no-protocol` / `--no-agents-md` | `init` uniquement : ne pas écrire la copie `<store>/protocol.md` / le bloc `AGENTS.md` |
| `--host` | Expose sur le LAN — réseaux de confiance uniquement ([sécurité](./safety.md)) |
| `--public` / `--site` / `--base` / `--out` | `build` uniquement : l'artefact de [site public](../guide/publish/index.md) |
