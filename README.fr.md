<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-logo.jpg" width="150" alt="notabene logo" />
</p>

<h1 align="center">notabene</h1>

<p align="center"><em>nota bene</em> - la marque de marge qui signifie <strong>« à bien noter ».</strong></p>

<p align="center">
  <strong>Des notes dans les marges des docs, directement sur la page rendue -<br />
  l'agent IA les applique, résout les fils et journalise <em>ce qui a changé &amp; pourquoi</em>.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@z29k/notabene"><img alt="npm" src="https://img.shields.io/npm/v/@z29k/notabene?logo=npm&amp;color=cb3837" /></a>
  <a href="https://github.com/z29k/notabene/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/z29k/notabene/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Node ≥ 22.12" src="https://img.shields.io/node/v/@z29k/notabene?logo=node.js&amp;color=5FA04E" />
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/npm/l/@z29k/notabene?color=3da638" /></a>
</p>

<p align="center">
  MDX <strong>et</strong> CommonMark/GFM · diagrammes Mermaid · export PDF · dev-local · zéro backend · responsive · <strong>les données restent dans git</strong>
</p>

<p align="center"><a href="https://github.com/z29k/notabene#readme">English</a> · <strong>Français</strong></p>

---

**Itérer sur sa doc avec un LLM - des retours n'importe où, pas tassés dans un seul prompt.**
Un site de doc navigable avec commentaires multi-utilisateurs, auto-hébergé dans git - sans SaaS.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="démo notabene : commenter un passage, l'agent applique l'édition, validation du vrai diff" width="900" />
</p>

## Pourquoi

Corriger ou rédiger de la doc avec un agent IA oblige à mettre chaque changement en mots :
citer le passage, nommer la section - « revoir la formulation de la section 3 » - puis espérer
que l'agent retrouve l'endroit exact dans la source. Passé deux ou trois changements, c'est un
pavé d'instructions, et tout l'échange tient dans un seul champ de chat, en allers-retours.
L'instruction réelle a toujours été plus simple : *ce passage - le changer comme ça.*

notabene en fait l'interface. Sélectionner le texte exact sur la page rendue - ou un diagramme
ou une image en entier - et y laisser un commentaire. Le commentaire ancré **est**
l'instruction : située, sans ambiguïté, rien à citer. L'agent lit les commentaires, édite la
source fidèlement, marque chaque commentaire résolu et journalise *ce qui a changé & pourquoi* -
comme un skill Claude Code, ou un protocole en texte clair que n'importe quel agent peut suivre.

Cette boucle de base a entraîné le reste :

- **Une couche de commentaires partagée.** Plusieurs personnes annotent la même doc - fils,
  résolution, mise en attente, une vue globale `/comments` - la revue n'est plus un prompt en
  solo.
- **Un vrai site de doc navigable.** Tout le Markdown/MDX du repo, rendu et parcourable - MDX
  *et* CommonMark/GFM, diagrammes Mermaid commentables, export PDF, prêt pour le mobile - pas un
  fichier à la fois.
- **Auto-hébergé, dans git.** Pas de SaaS, pas de base de données, aucun outil supplémentaire à
  faire tourner. Commentaires et journal sont du JSON sous `.notabene/` qui voyage avec le repo
  et diffe dans les PR ; l'API d'écriture est dev-local et en loopback par défaut.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-mobile-demo.gif" alt="notabene sur téléphone : sélection d'un passage au doigt, la barre d'action s'ancre en bas, commentaire laissé" width="300" />
</p>

<p align="center"><em>La même boucle sur téléphone - sélection au doigt, commentaire depuis la barre ancrée ; nav et commentaires en sheets.</em></p>

## Comment ça marche (30 secondes)

1. `npx notabene dev` → ouvrir le site, **sélectionner du texte → laisser un commentaire** (ou
   commenter une page entière, ou un **diagramme/une image** en entier). Fils, résolution, mise
   en attente, une vue globale `/comments`.
2. Demander à l'agent : **« traite les commentaires de la doc ».**
3. L'agent lit `.notabene/`, édite les docs fidèlement, marque chaque commentaire **résolu**, et
   ajoute une entrée de **journal** (quoi / pourquoi / quels commentaires).
4. Relire la trace sur `/journal`.

> 📽️ _C'est le clip ci-dessus - commenter un passage, l'agent propose l'édition, validation du vrai diff._

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-diagrams-demo.gif" alt="notabene : cliquer un diagramme Mermaid pour l'agrandir en lightbox, puis commenter le diagramme entier - le commentaire arrive dans le rail de droite" width="820" />
</p>

<p align="center"><em>Les diagrammes sont de première classe - rendu <strong>Mermaid</strong>, <strong>agrandissement</strong> de n'importe quel diagramme ou image, et <strong>commentaire du bloc entier</strong> (il arrive dans le rail comme un commentaire de texte).</em></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-pdf-demo.gif" alt="notabene : ouvrir le menu Export PDF, choisir une portée, et obtenir une vue prête à imprimer avec une page de garde et un sommaire cliquable" width="820" />
</p>

<p align="center"><em>Export de n'importe quelle portée en PDF - une <strong>page</strong>, une <strong>section</strong>, un <strong>espace</strong> ou <strong>toute la doc</strong> - en une vue prête à imprimer avec page de garde et sommaire cliquable (→ le <em>Enregistrer en PDF</em> du navigateur, ou <code>notabene pdf</code> pour un fichier avec signets).</em></p>

## Installation

notabene se compose de **deux briques installables** : le **renderer** (un package npm + CLI) et
le **plugin Claude Code** (setup clé en main + la boucle de revue). L'un, l'autre, ou les deux.

### 1 · Le renderer - package npm

```bash
npm install -D @z29k/notabene   # ou : pnpm add -D @z29k/notabene · bun add -d @z29k/notabene
npx notabene init               # écrit notabene.config.mjs + crée le store .notabene
npx notabene dev                # → http://localhost:3009
```

> Le package npm est scopé (`@z29k/notabene`) ; la commande CLI installée est simplement
> **`notabene`**, donc `npx notabene …` fonctionne tel quel.

`init` est la **seule** chose qui touche le repo : il écrit `notabene.config.mjs` et crée le
store `.notabene/`. Le renderer, lui, **tourne depuis le package** (rien n'est scaffoldé ni
copié dans le repo ; les mises à jour se font par `npm update`).

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
| `notabene pdf` | Exporte un PDF via Chromium headless (vrai volet de signets + numéros de page) ; `--scope doc\|space:K\|folder:K/P\|page:K/I`, `--locale`, `--out`, `--chrome`. Requiert la peer dep optionnelle `puppeteer` (ou `puppeteer-core` + `--chrome`) |
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

Sur un repo vierge, commencer par **« installe notabene »** - le plugin écrit
`notabene.config.mjs`, crée le store et démarre le serveur de revue (aussi via
`/notabene:setup` · `/notabene:dev` · `/notabene:status` · `/notabene:stop`). Fonctionne sur
**n'importe quel stack** (Rust/Python/Go/JS), sans toolchain à installer. Voir
[`packages/plugin/README.md`](packages/plugin/README.md).

Ensuite : **« traite les commentaires de la doc »** (ou *« review les docs »*, *« applique les
retours de revue »*). Le skill lit le `notabene.config.mjs`, traite les commentaires `open`
(hors mise en attente), édite les docs, les marque résolus, ajoute le journal et lance les
checks `verify` - sans jamais committer sans demander.

Install manuelle ? Copier `packages/plugin/skills/notabene/` dans le `.claude/skills/` du
projet. Un autre agent ? Le fichier du skill **est** la spec du protocole - il suffit de l'y
pointer.

## Configurer

`notabene.config.mjs`, à la racine du repo, est le seul câblage. Les chemins sont relatifs au
repo. (`notabene init` scaffolde un template ; `notabene init --detect` préremplit `roots[]` à
partir des dossiers de docs trouvés.)

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

  store: "docs/.notabene",   // commentaires + journal (dossier à committer)
  port: 3009,
  host: false,               // loopback uniquement - l'API d'écriture édite le git
  verify: [],                // checks du consommateur lancés par l'agent après édition
  review: "auto",            // "auto" (l'agent résout) | "approve" (validation humaine - voir plus bas)

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
| `review` | `"auto"` | `"auto"` = l'agent résout ; `"approve"` = l'agent propose (`addressed`), validation de chaque édit sur `/review` avec un diff |
| `author` | git `user.name` | Auteur de commentaire par défaut ; chaque navigateur le surcharge par appareil via la **modale d'identité** (nom + email optionnel) |
| `authorEmail` | git `user.email` | Email d'auteur par défaut ; embarqué façon git (`Name <email>`) pour des identités uniques |
| `pdf` | `{ enabled: true, pageSize: "A4", margin: "18mm" }` | Export PDF — `enabled` active le menu Export + les routes `/print` ; `pageSize`/`margin` règlent la boîte `@page` |
| `i18n` | — | Doc multilingue : `{ locales, defaultLocale, strategy: "directory"\|"suffix" }` (voir plus bas). Omettre pour une seule langue |

### Libellés et ordre de la barre latérale

Par défaut, l'entrée d'une page dans la barre latérale est son **nom de fichier humanisé**,
et les entrées voisines sont triées par ordre alphabétique. On peut redéfinir l'un ou
l'autre par page via le frontmatter — sans préfixer les noms de fichiers par des chiffres :

```yaml
---
title: Cartographie du réseau interne   # <title> de la page + fil d'Ariane (prime sur le H1)
sidebar:
  label: Cartographie                   # texte de la barre latérale (sinon title, sinon fichier)
  order: 9                              # position parmi les voisins (croissant)
---
```

- `order` trie en ordre croissant ; les entrées **sans** `order` restent triées
  alphabétiquement, après celles ordonnées. Groupes et pages partagent un même ordre : un
  dossier numéroté s'insère ainsi dans la séquence numérotée des pages.
- Un **dossier** est nommé et positionné par sa page d'accueil — `<dossier>/index.md` (ou
  `<dossier>/readme.md`) — dont le frontmatter `sidebar` s'applique au groupe entier. Cette
  page apparaît comme une entrée *Aperçu* localisée dans le groupe ; renommez-la avec
  `sidebar.indexLabel`.
- Ces libellés se répercutent aussi sur le fil d'Ariane et l'export PDF.

## Revue à deux temps (optionnel)

Par défaut, l'agent résout les commentaires directement. `review: "approve"` active une boucle
**humain-dans-la-boucle** : l'agent édite et marque chaque commentaire **`addressed`** au lieu
de résolu, puis la validation se fait sur **`/review`** (ou via le filtre *À valider* de
`/comments`). L'écran montre le **vrai diff git** de tout ce qui a changé pour un commentaire -
**cascades incluses** (un commentaire peut toucher plusieurs pages) - pour **valider**
(→ résolu) ou **rejeter** (→ rouvert, avec le motif, que l'agent relit à sa passe suivante). Le
diff s'affiche en **unifié ou côte à côte**, et un badge **Review** dans l'en-tête compte ce qui
attend.

## MDX et CommonMark/GFM

Le renderer choisit le processeur **par extension de fichier** :

- **`.md`** → CommonMark/GFM, **indulgent**. `<email@x>`, `Promise<T>`, `{var}`, du HTML brut
  et les tables GFM rendent sans planter.
- **`.mdx`** → MDX **strict** (JSX/expressions) - composants importables, mais `<`/`{` hors
  des blocs de code doivent être échappés.

`format: "mdx"` (défaut) active les deux, mixables dans un même repo. `format: "commonmark"`
supprime entièrement la dépendance MDX - idéal pour un repo Markdown pur.

> Note : le **défaut** de la config est `"mdx"` (omettre la clé pour l'obtenir), mais
> `notabene init` scaffolde `"commonmark"` - le point de départ sûr, sans dépendance, le plus
> indulgent.

## Doc multilingue (i18n)

`i18n` sert la même doc en plusieurs langues avec des **URLs propres préfixées** (langue par
défaut sans préfixe, autres en `/<locale>/…`), un **sélecteur de langue** (menu déroulant dans
l'en-tête, à côté de l'export), des alternates `hreflang`, et une chrome par page (une page FR
rend nav/boutons/dates en français).

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-i18n-demo.gif" alt="i18n notabene : ouvrir le sélecteur de langue dans l'en-tête, choisir Français - la doc et la chrome passent en français, les pages agrégées suivent la langue, et une page sans traduction affiche un bandeau de repli discret" width="820" />
</p>

<p align="center"><em>Le sélecteur de l'en-tête change de langue - la doc <strong>et</strong> la chrome basculent, les pages agrégées (commentaires, journal…) suivent, et une page non traduite retombe sur la langue source avec un bandeau.</em></p>

```js
i18n: { locales: ["en", "fr"], defaultLocale: "en", strategy: "directory" },
```

L'organisation des fichiers se choisit via `strategy` :

- **`directory`** (par défaut) — un dossier par langue : `docs/en/guide.md` · `docs/fr/guide.md`.
- **`suffix`** — un seul arbre, traduit par fichier : `docs/guide.md` (défaut) ·
  `docs/guide.fr.md`. Idéal pour rendre multilingue une doc **existante** : les fichiers de
  la langue par défaut ne bougent pas, donc leurs URLs *et* leurs fils de commentaires sont
  préservés.

**Préférence de langue & redirection.** Le sélecteur mémorise la langue choisie ; ensuite,
arriver sur une page écrite dans une autre langue qui *possède* une traduction **redirige** vers
celle-ci — suivre n'importe quel lien maintient donc la langue choisie. Une page **sans**
traduction retombe sur la langue source et affiche un bandeau discret (« pas encore disponible
dans votre langue »). Les pages non liées à une langue de contenu — `/comments`, `/journal`,
`/review`, l'**accueil** et la **404** — suivent aussi la langue courante (chrome + dates, côté
client, sans changement d'URL) et portent le même sélecteur.

Les commentaires sont **par langue** (un commentaire sur la page FR est son propre fil).
Recherche et export PDF (`notabene pdf --locale fr`) sont scopés à une langue. Omettre `i18n`
pour une seule langue — comportement inchangé.

## Le contrat `.notabene`

Le store est un **contrat versionné** (`<store>/meta.json` → `schemaVersion`), pour que les
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

> L'`anchor` montrée est un sélecteur texte-citation ; un commentaire **de bloc** (un diagramme
> ou une image en entier) porte une ancre de bloc à la place. `thread[].author` est une string
> qui peut être façon git **`Name <email>`** — séparer sur le `<…>` final pour le nom d'affichage.

## Lire. Commenter. Appliquer.

Sur un repo, notabene réunit trois choses en un seul outil :

- **Lire** les docs de tout le repo comme un vrai site navigable - nav, espaces & dossiers,
  liens inter-docs réécrits, recherche, diagrammes Mermaid, dark mode, export PDF, multilingue.
- **Commenter** n'importe quel passage - ou un diagramme ou une image en entier - directement
  sur la page rendue, façon Google Docs.
- **Appliquer** - l'agent lit les commentaires, les applique, résout les fils et journalise
  *ce qui a changé & pourquoi*. Commentaires et journal sont du **JSON en clair commité dans
  git** (pas de SaaS, pas de base de données), et le protocole de revue est **file-I/O-first** :
  ni serveur qui tourne, ni port, ni MCP - n'importe quel agent peut le suivre.

Le viewer est le support, le protocole est le produit : un **site de doc navigable à l'échelle
du repo + un store de commentaires git-natif + un protocole de revue agentique sans serveur**,
auto-hébergé depuis le `node_modules` du projet.

## Sécurité

L'API des commentaires écrit dans le git. Donc :

- Elle **ne tourne que sous `notabene dev`** - elle ne fait pas partie d'un artefact de build
  (les écritures renvoient `403` hors dev).
- Elle **bind en loopback par défaut** - inatteignable depuis le réseau, sauf exposition
  explicite via `--host` / `NOTABENE_HOST=1` sur un réseau de confiance.
- **Chaque écriture est gardée** au-delà du bind : les requêtes cross-origin sont refusées
  (anti-CSRF), un `Host` non-loopback est refusé en mode loopback (anti-DNS-rebinding), et -
  avec `NOTABENE_TOKEN` posé - chaque écriture doit porter un `x-notabene-token` valide
  (recommandé avec `--host`).
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
