---
title: Éditer dans la page
description: Corriger un bloc de prose là où on le lit — et laisser cette même sauvegarde fermer les commentaires auxquels elle répond et journaliser le changement.
sidebar:
  label: Éditer dans la page
  order: 6
---

# Éditer dans la page

La boucle de revue donne à un agent un moyen d'écrire. Ceci en donne un **à l'humain**,
sans quitter la page qu'il est en train de lire.

Un clic sur un paragraphe et vous l'éditez. Aucun mode à activer, aucune boîte qui
remplace le texte : le bloc reste exactement où il était, dans la typographie de la page,
et un curseur apparaît là où vous avez cliqué. Seule la source de ce bloc est réécrite — le
reste du fichier n'est pas touché, donc le diff que relisent les collègues est la ligne
réellement modifiée.

C'est un outil **de dev uniquement**, exactement comme le commentaire : l'API d'écriture
n'existe que sous `notabene dev`. Un site construit ou publié n'a ni éditeur, ni endpoint,
ni la moindre trace de l'un ou de l'autre.

## Les gestes

Deux intentions, deux gestes — d'où l'absence de bascule de mode :

| Action | Effet |
|---|---|
| **Clic** sur un bloc | vous l'éditez, curseur là où vous avez cliqué |
| **Sélection** de texte | la bulle de commentaire, comme avant |
| Sélection *pendant l'édition* | une petite barre de mise en forme, à la sélection |
| **Échap**, ou clic ailleurs | terminé — la modification est écrite s'il y en a une |
| `⌘Z` | annuler la frappe, comme partout |
| `⌘⇧M` | passer ce bloc en Markdown brut, et revenir |

Il n'y a pas de bouton Enregistrer : quitter un bloc le valide, comme dans un éditeur de
document. Rien de changé signifie rien d'écrit — se déplacer dans la page ne touche jamais
au dépôt. Au survol d'un bloc, un discret ✎ apparaît dans la marge : c'est tout le chrome.

Tout ce qui entoure le bloc reste rendu pendant la saisie : le rail de commentaires, les
surlignages, le sommaire, les diagrammes. C'est tout l'intérêt — le geste visé est de lire
un commentaire tout en corrigeant la phrase qu'il concerne.

## Fermer la boucle

Dès que quelque chose a réellement changé, une ligne discrète apparaît sous le bloc : les
commentaires ouverts de la page, et de quoi décrire la modification. Cocher ceux auxquels
elle répond les passe en **resolved** dans la même sauvegarde, liés à une entrée de journal
— le registre même où écrit une passe d'agent. Rien ne s'affiche tant qu'il n'y a rien à y
rattacher.

En mode `review: "approve"`, un commentaire fermé ainsi passe directement en `resolved`, pas
`addressed` : la page a été éditée, donc le validateur qu'attend ce mode, c'est vous. Sur la
page `/review`, chaque carte porte un lien **Corriger dans la page** qui ouvre directement le
bloc concerné, en mode édition — approuver en corrigeant, en un clic.

`notabene comments verify` audite ce qui a été écrit exactement comme il audite une passe
d'agent.

## Ce qu'il refuse de faire

L'éditeur écrit dans le contenu : il est donc délibérément difficile de lui faire faire
autre chose que ce qui était voulu.

- **Il ne perturbera pas un bloc voisin.** Après insertion, il re-parse le fichier et
  vérifie que tous les autres blocs top-level reviennent octet pour octet. Transformer un
  paragraphe en liste à côté d'une liste existante fusionnerait les deux ; une fence non
  terminée avalerait le reste de la page. Les deux sont refusés, rien n'est écrit. Quand la
  fusion est justement ce qu'on voulait, le refus propose d'**inclure le bloc suivant** et
  de réessayer.
- **Il n'éditera pas ce qu'il ne sait pas représenter.** Seuls les blocs que le rendu a pu
  marquer sont éditables ; le HTML brut et le JSX restent en lecture seule et ne
  s'éclairent jamais.
- **Il n'écrira pas un fichier que git ne suit pas**, car la modification serait alors
  irrécupérable. Le message indique de faire `git add`. `edit: { requireGit: false }` lève
  la garde si l'on tient à éditer hors gestion de version.
- **Il prévient avant de casser une ancre.** Si la modification retire le texte que cite un
  commentaire, la ligne sous le bloc le signale pendant la saisie — ce commentaire
  deviendrait orphelin.

## Images

Coller une image dans l'éditeur l'écrit dans le dépôt, à côté de la page, sous un nom
suffixé d'un hash de contenu, et insère le lien Markdown. Elle atterrit dans le même commit
que la prose qui la référence.

## Configuration

```js
export default {
  edit: {
    enabled: true,      // défaut — false masque entièrement l'éditeur
    requireGit: true,   // défaut — refuse d'écrire un fichier non suivi par git
  },
  roots: [
    { key: "reference", path: "docs/reference", edit: false },  // espace en lecture seule
  ],
};
```

`notabene doctor` rapporte l'état, y compris la seule combinaison qui refuserait toute
sauvegarde : édition activée, `requireGit` activé, et pas de dépôt git.

## Ce que ce n'est pas

Pas un CMS. Aucun éditeur dans un site déployé, pas de médiathèque, pas d'édition du
frontmatter, pas de collaboration temps réel — **git est la couche de fusion**. Éditer une
page dans une langue ne touche pas ses traductions : celles-ci restent un acte explicite.
