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
  MDX <strong>et</strong> CommonMark/GFM · diagrammes Mermaid · export PDF · dev-local · zéro backend · responsive · <strong>tes données restent dans git</strong>
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
- **Diagrammes, de première classe & commentables.** Écris du **Mermaid** (logigrammes,
  séquence, ER…) dans une fence ` ```mermaid ` - rendu inline. **Commente ou agrandis**
  n'importe quel diagramme *ou image* en entier (un commentaire de bloc dans le rail), pas
  seulement du texte.
- **Exporte un PDF soigné.** Depuis le menu **Export PDF**, transforme une page, un dossier,
  un espace ou toute la doc en une vue prête à imprimer (page de garde + sommaire cliquable) →
  le *Enregistrer en PDF* de ton navigateur, sans dépendance. Pour un fichier qualité livre
  avec un vrai **volet de signets**, lance `notabene pdf` (Chromium headless, optionnel).
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
   commente une page entière, ou un **diagramme/une image** en entier). Fils, résolution, mise
   en attente, une vue globale `/comments`.
2. Dis à ton agent : **« traite les commentaires de la doc ».**
3. L'agent lit `.notabene/`, édite les docs fidèlement, marque chaque commentaire **résolu**,
   et ajoute une entrée de **journal** (quoi / pourquoi / quels commentaires).
4. Relis la trace sur `/journal`.

> 📽️ _C'est le clip ci-dessus - commente un passage, l'agent propose l'édition, tu valides le vrai diff._

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-diagrams-demo.gif" alt="notabene : clique un diagramme Mermaid pour l'agrandir en lightbox, puis commente le diagramme entier - le commentaire arrive dans le rail de droite" width="820" />
</p>

<p align="center"><em>Les diagrammes sont de première classe - rendu <strong>Mermaid</strong>, <strong>agrandis</strong> n'importe quel diagramme ou image, et <strong>commente le bloc entier</strong> (il arrive dans le rail comme un commentaire de texte).</em></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-pdf-demo.gif" alt="notabene : ouvre le menu Export PDF, choisis une portée, et obtiens une vue prête à imprimer avec une page de garde et un sommaire cliquable" width="820" />
</p>

<p align="center"><em>Exporte n'importe quelle portée en PDF - une <strong>page</strong>, une <strong>section</strong>, un <strong>espace</strong> ou <strong>toute la doc</strong> - en une vue prête à imprimer avec page de garde et sommaire cliquable (→ le <em>Enregistrer en PDF</em> du navigateur, ou <code>notabene pdf</code> pour un fichier avec signets).</em></p>

## Installation

notabene, c'est **deux briques installables** : le **renderer** (un package npm + CLI) et le
**plugin Claude Code** (setup clé en main + la boucle de revue). Installe l'un, l'autre, ou les deux.

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
| `notabene doctor` | État en lecture seule (JSON) : config/store/port + dossiers de docs détectés - `--json` |
| `notabene init` | Écrit `notabene.config.mjs` + crée le store (no-op si déjà présent) ; `--detect` détecte les dossiers de docs |
| `notabene dev` | Lance le serveur de revue sur les docs de ce repo (live-reload) ; `--detach` = daemon en arrière-plan |
| `notabene status` | Le serveur détaché tourne-t-il ? (pid, port, URL) - `--json` |
| `notabene stop` | Arrête le serveur détaché |
| `notabene build` | Build le site (Node standalone ; docs prérendues, pas d'API d'écriture dans l'artefact) |
| `notabene preview` | Sert le site buildé |
| `notabene pdf` | Exporte un PDF via Chromium headless (vrai volet de signets + numéros de page) ; `--scope doc\|space:K\|folder:K/P\|page:K/I`, `--out`, `--chrome`. Requiert la peer dep optionnelle `puppeteer` |
| `notabene migrate` | Convertit le store vers le format un-fichier-par-commentaire (estampille `schemaVersion` 3) |
| `notabene comments ls` | Liste les commentaires - `--open` `--json` `--page <p>` (pour agents/scripts) |
| `notabene journal add` | Ajoute une entrée de journal JSON lue sur stdin |

Flags : `--port <n>` · `--detach` (dev : daemon en arrière-plan) · `--detect` (init : détecte
les roots) · `--scope`/`--out`/`--chrome` (pdf) · `--config <path>` · `--root <path>` · `--host`
(exposer sur le LAN - réseaux de confiance uniquement).

### 2 · Le plugin Claude Code - setup + revue

Dans Claude Code :

```
/plugin marketplace add z29k/notabene
/plugin install notabene@z29k
```

Sur un repo vierge, dis d'abord **« installe notabene »** - le plugin écrit
`notabene.config.mjs`, crée le store, et démarre le serveur de revue pour toi
(aussi via `/notabene:setup` · `/notabene:dev` · `/notabene:status` · `/notabene:stop`).
Ça marche sur **n'importe quel stack** (Rust/Python/Go/JS) - aucun toolchain à installer.
Voir [`packages/plugin/README.md`](packages/plugin/README.md).

Ensuite, dis **« traite les commentaires de la doc »** (ou *« review les docs »*,
*« applique les retours de revue »*). Le skill lit ton `notabene.config.mjs`, traite les
commentaires `open` (hors mise en attente), édite les docs, les marque résolus, ajoute le
journal, et lance tes checks `verify` - sans jamais committer sans demander.

Tu préfères une install manuelle ? Copie `packages/plugin/skills/notabene/` dans le
`.claude/skills/` de ton projet. Un autre agent ? Le fichier du skill **est** la spec du
protocole - pointe ton agent dessus.

## Configurer

`notabene.config.mjs` à la racine de ton repo est le seul câblage. Les chemins sont relatifs
au repo. (`notabene init` scaffolde un template ; `notabene init --detect` préremplit
`roots[]` à partir des dossiers de docs trouvés.)

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

  // author: "Alex", authorEmail: "alex@x.io",  // identité de commentaire par défaut (sinon git user.name / user.email)
  // pdf: { enabled: true, pageSize: "A4", margin: "18mm" },  // export PDF (menu Export + /print)
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
| `author` | git `user.name` | Auteur de commentaire par défaut ; chaque navigateur le surcharge par appareil via la **modale d'identité** (nom + email optionnel) |
| `authorEmail` | git `user.email` | Email d'auteur par défaut ; embarqué façon git (`Name <email>`) pour des identités uniques |
| `pdf` | `{ enabled: true, pageSize: "A4", margin: "18mm" }` | Export PDF — `enabled` active le menu Export + les routes `/print` ; `pageSize`/`margin` règlent la boîte `@page` |

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

> L'`anchor` montrée est un sélecteur texte-citation ; un commentaire **de bloc** (un
> diagramme ou une image en entier) porte une ancre de bloc à la place. `thread[].author` est
> une string qui peut être façon git **`Name <email>`** — coupe sur le `<…>` final pour le nom.

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
- Sur un hôte **non-loopback** (LAN via `--host`, ou un build déployé), chaque visiteur doit
  renseigner son **identité** (nom + email optionnel) avant de naviguer, pour que les
  commentaires soient attribués à une vraie personne plutôt qu'au git du propriétaire du repo.

## Organisation du repo

- **`packages/renderer`** - le package npm `notabene` (renderer Astro + CLI).
- **`packages/plugin`** - le plugin Claude Code (le skill de revue).

## Licence

[MIT](./LICENSE).
