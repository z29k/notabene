<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-logo.jpg" width="150" alt="notabene - une fiole d'encre estampillée N.B." />
</p>

<h1 align="center">notabene</h1>

<p align="center"><em>nota bene</em> - la marque de marge qui signifie <strong>« à bien noter ».</strong></p>

<p align="center">
  <strong>Laisse des notes dans les marges des docs de ton repo - directement sur la page rendue -<br />
  puis laisse ton agent IA les appliquer, résoudre les fils et journaliser <em>ce qui a changé &amp; pourquoi</em>.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@z29k/notabene"><img alt="npm" src="https://img.shields.io/npm/v/@z29k/notabene?logo=npm&amp;color=cb3837" /></a>
  <a href="https://github.com/z29k/notabene/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/z29k/notabene/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Node ≥ 22.12" src="https://img.shields.io/node/v/@z29k/notabene?logo=node.js&amp;color=5FA04E" />
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/npm/l/@z29k/notabene?color=3da638" /></a>
</p>

<p align="center">
  MDX <strong>et</strong> CommonMark/GFM · dev-local · zéro backend · responsive · <strong>tes données restent dans git</strong>
</p>

<p align="center"><a href="https://github.com/z29k/notabene#readme">English</a> · <strong>Français</strong></p>

---

**notabene rend le Markdown/MDX de ton repo comme un site navigable avec des commentaires de
revue posés directement sur la page, et embarque le protocole de revue humain↔agent qui
transforme ces commentaires en édits. Le viewer est le support - le protocole est le produit.**

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="démo notabene : commente un passage, l'agent applique l'édition, tu valides le vrai diff" width="900" />
</p>

## Pourquoi

La revue de doc, aujourd'hui, est éparpillée entre commentaires de PR, fils de chat et « tu
peux corriger la formulation de la section 3 ? ». Le retour est déconnecté du doc, et
l'appliquer est manuel et source de pertes.

notabene met les commentaires **sur le doc rendu**, les stocke **dans ton git** (pas de SaaS,
pas de base de données), et boucle la boucle : ton agent lit les commentaires, édite les docs,
les marque résolus, et écrit une entrée de journal reliant *ce qui a changé* à *pourquoi*.

- **Outil sans état, données dans ton git.** Commentaires et journal sont des fichiers JSON
  sous `.notabene/`. Ils voyagent avec ton repo, diffent dans les PR, et sont lisibles par
  ton agent. Pas de compte, pas de serveur à déployer, pas d'état central.
- **Agent-native.** La boucle de revue est livrée comme un skill Claude Code - et comme un
  protocole en texte clair que n'importe quel agent peut suivre.
- **MDX *et* CommonMark/GFM.** Pointe-le sur du `.md` (indulgent) ou du `.mdx` (strict), ou
  mélange les deux - au choix via la config.
- **Dev-local & sûr par défaut.** L'API d'écriture ne tourne que sous `notabene dev`, bind en
  loopback (`127.0.0.1`) par défaut, et n'est jamais embarquée dans un build.
- **Mobile, tablette & tactile.** Le viewer est entièrement responsive : en dessous de 1024px
  la nav se replie en tiroir, le sommaire et les commentaires ancrés deviennent des bottom
  sheets, et tu peux **sélectionner du texte et commenter au pouce** depuis une barre d'action
  ancrée (contrôles ≥44px, saisie qui esquive le clavier). Relis les docs depuis le canapé ; le
  bureau ne change pas.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-mobile-demo.gif" alt="notabene sur téléphone : sélectionne un passage au doigt, la barre d'action s'ancre en bas, laisse un commentaire" width="300" />
</p>

<p align="center"><em>La même boucle sur téléphone - sélection au doigt, commentaire depuis la barre ancrée ; nav et commentaires en sheets.</em></p>

## Comment ça marche (30 secondes)

1. `npx notabene dev` → ouvre le site, **sélectionne du texte → laisse un commentaire** (ou
   commente une page entière). Fils, résolution, mise en attente, une vue globale `/comments`.
2. Dis à ton agent : **« traite les commentaires de la doc ».**
3. L'agent lit `.notabene/`, édite les docs fidèlement, marque chaque commentaire **résolu**,
   et ajoute une entrée de **journal** (quoi / pourquoi / quels commentaires).
4. Relis la trace sur `/journal`.

> 📽️ _C'est le clip ci-dessus - commente un passage, l'agent propose l'édition, tu valides le vrai diff._

## Installation

notabene, c'est **deux briques installables** : le **renderer** (un package npm + CLI) et le
**skill de revue** (un plugin Claude Code). Installe l'un, l'autre, ou les deux.

### 1 · Le renderer - package npm

```bash
npm install -D @z29k/notabene   # ou : pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # écrit notabene.config.mjs + crée le store .notabene
npx notabene dev                # → http://localhost:3009
```

> Le package npm est scopé (`@z29k/notabene`) ; la commande CLI installée est simplement
> **`notabene`**, donc `npx notabene …` marche tel quel.

`init` est la **seule** chose qui touche ton repo - il écrit `notabene.config.mjs` et crée le
store `.notabene/`. Le renderer, lui, **tourne depuis le package** (rien n'est scaffoldé ou
copié dans ton repo ; les mises à jour, c'est juste `npm update`).

CLI :

| Commande | Ce qu'elle fait |
| --- | --- |
| `notabene init` | Écrit `notabene.config.mjs` + crée le store (no-op si déjà présent) |
| `notabene dev` | Lance le serveur de revue sur les docs de ce repo (live-reload) |
| `notabene build` | Build le site (Node standalone ; docs prérendues, pas d'API d'écriture dans l'artefact) |
| `notabene preview` | Sert le site buildé |
| `notabene migrate` | Convertit le store en un fichier par commentaire (schéma v2) |
| `notabene comments ls` | Liste les commentaires - `--open` `--json` `--page <p>` (pour agents/scripts) |
| `notabene journal add` | Ajoute une entrée de journal JSON lue sur stdin |

Flags : `--port <n>` · `--config <path>` · `--root <path>` · `--host` (exposer sur le LAN -
réseaux de confiance uniquement).

### 2 · Le skill de revue - plugin Claude Code

Dans Claude Code :

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

Ensuite, dis simplement **« traite les commentaires de la doc »** (ou *« review les docs »*,
*« applique les retours de revue »*). Le skill lit ton `notabene.config.mjs`, traite les
commentaires `open` (hors mise en attente), édite les docs, les marque résolus, ajoute le
journal, et lance tes checks `verify` - sans jamais committer sans demander.

Tu préfères une install manuelle ? Copie `packages/plugin/skills/notabene/` dans le
`.claude/skills/` de ton projet. Un autre agent ? Le fichier du skill **est** la spec du
protocole - pointe ton agent dessus.

## Configurer

`notabene.config.mjs` à la racine de ton repo est le seul câblage. Les chemins sont relatifs
au repo.

```js
// notabene.config.mjs
export default {
  siteName: "Mon Projet",
  tagline: "docs",
  locale: "fr",

  // Format d'entrée. "mdx" : .mdx STRICT + .md CommonMark/GFM indulgent (mixables par
  // extension). "commonmark" : tout en CommonMark/GFM, sans dépendance/strictesse MDX.
  format: "commonmark",

  // Espaces de doc. `key` = slug d'url + espace du store ; `path` = dossier relatif au repo.
  roots: [
    { key: "docs", label: "Docs", path: "docs", exclude: [".notabene/**"] },
  ],

  store: "docs/.notabene",   // commentaires + journal (commite ce dossier)
  port: 3009,
  host: false,               // loopback uniquement - l'API d'écriture édite ton git
  verify: [],                // checks du consommateur que l'agent lance après édition
  review: "auto",            // "auto" (l'agent résout) | "approve" (tu valides - voir plus bas)
};
```

| Clé | Défaut | Signification |
| --- | --- | --- |
| `siteName` / `tagline` | `"Docs"` / `"docs"` | Marque de l'en-tête |
| `locale` | `"en"` | Langue de l'UI + collation du tri de nav |
| `format` | `"mdx"` | `"mdx"` ou `"commonmark"` (voir plus bas) |
| `roots[]` | `[{docs}]` | Espaces de doc : `{ key, label, path, exclude, description }` |
| `store` | `"docs/.notabene"` | Dossier commentaires + journal |
| `port` | `3009` | Port du `astro dev` |
| `host` | `false` | `true`/`NOTABENE_HOST=1`/`--host` expose l'API d'écriture au LAN |
| `verify[]` | `[]` | Checks post-édition lancés par l'agent (le build renderer tourne toujours) |
| `review` | `"auto"` | `"auto"` = l'agent résout ; `"approve"` = l'agent propose (`addressed`), tu valides chaque édit sur `/review` avec un diff |
| `author` | git `user.name` | Auteur de commentaire par défaut ; chaque navigateur le surcharge par appareil via le champ nom de l'en-tête |

## Revue à deux temps (optionnel)

Par défaut, l'agent résout les commentaires directement. Mets `review: "approve"` pour une
boucle **humain-dans-la-boucle** : l'agent édite et marque chaque commentaire **`addressed`**
au lieu de résolu, puis tu valides sur **`/review`** (ou via le filtre *À valider* de
`/comments`). Tu vois le **vrai diff git** de tout ce qui a changé pour un commentaire -
**cascades incluses** (un commentaire peut toucher plusieurs pages) - et tu **valides**
(→ résolu) ou **rejettes** (→ rouvert, avec ton motif, que l'agent relit à sa passe suivante).
Le diff s'affiche en **unifié ou côte à côte**, et un badge **Review** dans l'en-tête compte
ce qui attend.

## MDX et CommonMark/GFM

Le renderer choisit le processeur **par extension de fichier** :

- **`.md`** → CommonMark/GFM, **indulgent**. `<email@x>`, `Promise<T>`, `{var}`, du HTML brut
  et les tables GFM rendent sans planter.
- **`.mdx`** → MDX **strict** (JSX/expressions) - composants importables, mais `<`/`{` hors
  des blocs de code doivent être échappés.

`format: "mdx"` (défaut) active les deux, mixables dans un même repo. `format: "commonmark"`
supprime entièrement la dépendance MDX - idéal pour un repo Markdown pur.

> Note : le **défaut** de la config est `"mdx"` (omets la clé pour l'avoir), mais
> `notabene init` scaffolde `"commonmark"` - le point de départ sûr, sans dépendance, le plus
> indulgent.

## Le contrat `.notabene`

Le store est un **contrat versionné** (`<store>/meta.json` → `schemaVersion`), pour que tes
données restent portables et diffables. Un commentaire :

```jsonc
{ "id", "space", "page", "scope",
  "anchor": { "quote", "prefix", "suffix", "section" } | null,   // ancre texte-citation
  "thread": [{ "author", "body", "ts" }],
  "status": "open" | "addressed" | "resolved",
  "hold": false,                                                 // l'agent saute les commentaires en attente
  "resolution": { "note", "journalEntryId"? } | null,
  "createdAt", "updatedAt" }
```

Une entrée de journal : `{ id, date, title, summary, changes[] { page, commentIds[], what, why } }`.

## En quoi c'est différent

- **Starlight / Docusaurus** rendent superbement les docs - mais pas de commentaires ni de
  boucle de revue.
- **Commentaires de PR & fils de chat** captent le retour - mais il vit *loin* du doc, et
  l'appliquer est manuel et source de pertes.
- **notabene** est le chaînon manquant : annote les docs de **ton repo** dans le navigateur,
  garde **tout dans git**, et laisse ton **agent** boucler la boucle.

## Sécurité

L'API des commentaires écrit dans ton git. Donc :

- Elle **ne tourne que sous `notabene dev`** - elle ne fait pas partie d'un artefact de build
  (les écritures renvoient `403` hors dev).
- Elle **bind en loopback par défaut** - inatteignable depuis ton réseau, sauf si tu l'exposes
  avec `--host` / `NOTABENE_HOST=1` sur un réseau de confiance.
- **Chaque écriture est gardée** au-delà du bind : les requêtes cross-origin sont refusées
  (anti-CSRF), un `Host` non-loopback est refusé en mode loopback (anti-DNS-rebinding), et -
  si tu poses `NOTABENE_TOKEN` - chaque écriture doit porter un `x-notabene-token` valide.
  Poser un token est **recommandé avec `--host`**.
- Le skill agent **ne committe jamais sans demander** et **ne supprime jamais en masse** le
  store.

## Organisation du repo

- **`packages/renderer`** - le package npm `notabene` (renderer Astro + CLI).
- **`packages/plugin`** - le plugin Claude Code (le skill de revue).

## Licence

[MIT](./LICENSE).
