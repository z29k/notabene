---
title: Personnaliser le rendu
description: Assets de branding, le contrat de tokens --nb-*, et votre propre feuille de style — thémez le site sans le forker.
sidebar:
  label: Personnaliser le rendu
  order: 4
---

# Personnaliser le rendu

notabene s'exécute depuis le paquet — vous ne forkez jamais son UI. À la place, trois
couches de personnalisation, toutes pilotées par la config :

1. **[Branding](./configuration.md)** — logo, favicon, image sociale.
2. **Tokens** — surchargez les custom properties `--nb-*` (ci-dessous).
3. **Votre propre feuille de style** — un fichier CSS chargé après les styles du
   renderer.

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
| `code-bg` | `#0d1117` / `#0b0e13` | Fond des blocs de code (le code reste sombre dans les deux schémas — les couleurs Shiki sont figées clair-sur-sombre) |
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
`.rail`. Tout le reste — et chaque variable CSS sans préfixe — est **interne** et peut
changer d'une version à l'autre.

Deux règles vous gardent en sécurité :

- **Ne surchargez que les tokens `--nb-*` et les points d'accroche ci-dessus.** En
  particulier, ne touchez jamais aux variables sans préfixe : les vues print/PDF forcent
  une palette claire à travers elles, donc un thème limité aux tokens peut restyler tout
  le site sans jamais casser l'[export PDF](./pdf-export.md).
- Vérifiez les deux schémas de couleur — le sélecteur de l'en-tête en fait un test à
  deux clics.

Les thèmes s'appliquent partout : dev, builds normaux, [sites publics](./publish/index.md)
et les vues print (couleurs exceptées, à dessein).
