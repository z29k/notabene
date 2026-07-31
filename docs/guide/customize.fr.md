---
title: Personnaliser le rendu
description: Branding, le contrat de tokens --nb-*, votre feuille de style, polices, thèmes de code et de diagrammes — thémez le site sans le forker.
sidebar:
  label: Personnaliser le rendu
  order: 4
---

# Personnaliser le rendu

notabene s'exécute depuis le paquet — vous ne forkez jamais son UI. Tout ce qui suit
passe par la config à la place :

1. **[Branding](./configuration.md)** — logo, favicon, image sociale.
2. **Tokens** — surchargez les custom properties `--nb-*` (ci-dessous).
3. **Votre propre feuille de style** — un fichier CSS chargé après les styles du
   renderer.
4. **Polices et images** — un dossier de votre repo, servi pour cette feuille de style.
5. **Code et diagrammes** — un thème Shiki pour les blocs de code ; Mermaid suit les tokens.

Les liens sortants (topbar, sidebar, pied de page) n'en font **pas** partie : ce sont des
données du dépôt, pas de l'apparence — voir
[liens de navigation](./configuration.md#liens-de-navigation).

```js
theme: {
  // Surcharges rapides, aucun fichier requis. Une valeur simple s'applique aux DEUX schémas ;
  // une paire light-dark() personnalise chacun : clair à gauche, sombre à droite.
  tokens: { accent: "light-dark(#7c3aed, #b79bff)", radius: "4px" },
  css: "docs/notabene-theme.css",                 // ou/et une feuille de style complète
},
```

Les deux ciblent le même contrat ; un nom de token mal orthographié **lève une erreur au
démarrage** (jamais un no-op silencieux). Les styles du renderer vivent dans des cascade
layers CSS, donc votre CSS hors layer **gagne toujours** — pas de guerre de spécificité,
pas de loterie d'ordre.

Tout suit cette palette — le chrome, les blocs de code et les diagrammes — et le
sélecteur de schéma de l'en-tête la bascule en direct, sans rebuild :

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-theme-demo.gif" alt="théming notabene : un clic sur le sélecteur de schéma bascule la palette — le chrome, le bloc de code et le diagramme Mermaid suivent, sans rebuild" width="820" />
</p>

## Diagrammes

Les [diagrammes Mermaid](./authoring.md) suivent les tokens d'emblée : les nœuds sont
remplis en `accent-soft` et bordés d'`accent`, les libellés utilisent la couleur du
texte, les arêtes `text-soft` — et ils se re-rendent au changement de schéma, donc un
diagramme en mode sombre est un vrai diagramme sombre, pas une image inversée. Rien à
configurer.

Si un diagramme rend mieux avec la palette de Mermaid, désactivez :

```js
theme: { mermaid: false },   // retour aux thèmes default/dark intégrés de Mermaid
```

## Coloration syntaxique (`theme.code`)

Les blocs de code sont colorés au build : leurs couleurs sont donc *figées* — d'où le
décalage habituel, un thème clair avec des blocs de code sombres. Nommez un thème
[Shiki](https://shiki.style/themes) et cela change :

```js
theme: {
  code: "github-light",                            // même thème dans les deux schémas
  // ou un par schéma :
  code: { light: "github-light", dark: "vesper" },
},
```

- Avec `code`, les deux palettes voyagent en variables CSS et le **sélecteur de schéma
  recolore le code instantanément** — sans rebuild, sans clignotement.
- Le thème de code prend alors aussi la main sur le **fond du bloc** (les tokens d'un
  thème clair sur la dalle sombre par défaut seraient illisibles). `--nb-code-bg` reste
  le fond pour quiconque ne définit pas `theme.code`.
- Le [PDF/print](./pdf-export.md) force le schéma clair : c'est donc votre thème de code
  *clair* qui atterrit sur le papier.
- Nom de thème inconnu → erreur au démarrage, comme pour chaque réglage de thème.

## Polices et images (`theme.assets`)

Une feuille de style a généralement besoin de fichiers : une police web, un fond, une
texture. Pointez `theme.assets` vers un dossier de votre repo : il est servi au chemin
fixe `/_nb/assets/…` — en dev, dans les builds et dans les
[artefacts publics](./publish/index.md), pour qu'un site publié reste autonome (pas de CDN) :

```js
theme: { css: "docs/theme/site.css", assets: "docs/theme/assets" },
```

```css
/* docs/theme/site.css */
@font-face {
  font-family: "Inter";
  src: url("./assets/fonts/Inter.woff2") format("woff2");   /* ← relatif, toujours */
}
:root { --nb-sans: "Inter", system-ui, sans-serif; }
```

- **Écrivez les `url()` en relatif, jamais en absolu depuis la racine.** Les URL se
  résolvent contre la feuille *servie* (`/_nb/theme.css`), pas contre votre fichier
  source — donc `./assets/…` est la forme correcte, et elle absorbe gratuitement un
  [sous-chemin `base`](./publish/configuration.md) (site projet GitHub Pages), là où
  `/_nb/…` casserait.
- **Déclarez un dossier dédié**, pas `docs/` : tout ce qui y est servable est émis,
  référencé ou non.
- Seuls des assets sont servis — polices (`woff2`, `woff`, `ttf`, `otf`), images (`svg`,
  `png`, `jpg`, `webp`, `avif`, `gif`, `ico`) et `css`. Tout le reste (`.md`, `.env`,
  scripts), chaque fichier caché et tout lien symbolique pointant hors du dossier sont
  refusés.

## Le contrat de tokens (`--nb-*`)

Ces custom properties sont la **surface de theming publique** — stable d'une version à
l'autre. Les défauts de couleur sont donnés sous leur paire `light-dark(light, dark)` :

| Token | Défaut (clair / sombre) | Rôle |
| --- | --- | --- |
| `bg` | `#ffffff` / `#0e1116` | Fond de page |
| `bg-soft` | `#f6f7f9` / `#151a21` | Panneaux, champs de saisie |
| `bg-elev` | `#ffffff` / `#161b22` | Surfaces élevées (topbar, popovers) |
| `border` | `#e4e7ec` / `#272e38` | Filets |
| `text` | `#1c2024` / `#e7ebf0` | Premier plan principal |
| `text-soft` | `#5b6470` / `#aab2bd` | Premier plan secondaire |
| `text-faint` | `#8a929e` / `#768091` | Premier plan tertiaire |
| `accent` | `#2f6feb` / `#6ea0ff` | Liens, focus, surlignages |
| `accent-soft` | `#e8f0ff` / `#182539` | Fonds d'accent |
| `ref` / `work` | `#2f6feb` / `#6ea0ff` · `#b5651d` / `#e0a060` | Pastilles d'espace dans les résultats de recherche |
| `code-bg` | `#0d1117` / `#0b0e13` | Fond des blocs de code — le défaut, quand aucun [`theme.code`](#coloration-syntaxique-themecode) n'est défini (les couleurs Shiki sont alors figées clair-sur-sombre, donc le code reste sombre dans les deux schémas) |
| `topbar-h` / `sidebar-w` / `toc-w` / `content-max` | `52px` / `290px` / `320px` / responsive | Mise en page (invariante au schéma) |
| `radius` | `8px` | Arrondi des coins |
| `sans` / `mono` | piles système | Familles de polices |

Chaque token de couleur est une **paire `light-dark()`** — une seule déclaration couvre
les deux schémas, et le **sélecteur clair/sombre** de l'en-tête (auto / clair / sombre,
persisté par navigateur) les bascule tous d'un coup. Un thème qui change les couleurs
fait de même :

```css
/* docs/notabene-theme.css */
:root {
  --nb-accent: light-dark(#7c3aed, #b79bff);
  --nb-accent-soft: light-dark(#f1e9ff, #241a3d);
}
```

Le sélecteur fonctionne via `color-scheme` + un attribut `data-scheme` que le renderer
pose sur `<html>` — un thème ne doit **pas** définir cet attribut (ni `color-scheme` sur
`:root`) ; surchargez des tokens, et le sélecteur continue de fonctionner sans effort.
`light-dark()` ne couvre que les couleurs ; pour le rare style par schéma hors couleur,
*sélectionner* sur `:root[data-scheme="dark"]` dans votre feuille de style est très
bien — c'est *poser* l'attribut qui est réservé.

## Au-delà des tokens

Votre feuille de style peut aussi cibler un petit ensemble de **points d'accroche
stables** : `.topbar`, `.brand`, `.sidebar`, `.prose` (le contenu rendu), `.home-cards`,
`.rail`, plus les [liens de navigation](./configuration.md#liens-de-navigation) —
`.nb-nav-link` (tout lien sortant), `.nb-sidebar-links` (le bloc sous l'arbre des
espaces) et `.site-footer`. Tout le reste — et chaque variable CSS sans préfixe — est
**interne** et peut changer d'une version à l'autre.

Un thème **style** ces liens ; il n'en **déclare** jamais. Les entrées de nav, le texte
du pied de page et les assets de branding sont des données du dépôt (`nav`, `branding` au
premier niveau de la config), pas de l'apparence : une feuille de style installée ne doit
pas pouvoir injecter des liens sortants dans un site publié, ni porter des libellés dans
des langues qu'elle ne peut pas connaître.

Deux règles vous gardent en sécurité :

- **Ne surchargez que les tokens `--nb-*` et les points d'accroche ci-dessus.** En
  particulier, ne touchez jamais aux variables sans préfixe : les vues print/PDF forcent
  une palette claire à travers elles, donc un thème limité aux tokens peut restyler tout
  le site sans jamais casser l'[export PDF](./pdf-export.md).
- Vérifiez les deux schémas de couleur — le sélecteur de l'en-tête en fait un test à
  deux clics.

Les thèmes s'appliquent partout : dev, builds normaux, [sites publics](./publish/index.md)
et les vues print (couleurs exceptées, à dessein).
