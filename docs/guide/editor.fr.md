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

Au survol d'un paragraphe, trois poignées apparaissent dans la marge — **✎** édite le
bloc, **+** en ajoute un dessous, **⋮⋮** ouvre le menu du bloc. Un clic sur le crayon et
vous éditez ce bloc, en place : il conserve la typographie de la page et ne bouge pas, il
prend seulement un fond teinté pour qu'on voie lequel est actif. Seule la source de ce
bloc est réécrite — le reste du fichier n'est pas touché, donc le diff que relisent les
collègues est la ligne réellement modifiée.

C'est un outil **de dev uniquement**, exactement comme le commentaire : l'API d'écriture
n'existe que sous `notabene dev`. Un site construit ou publié n'a ni éditeur, ni endpoint,
ni la moindre trace de l'un ou de l'autre.

## Les gestes

Deux intentions, deux gestes — d'où l'absence de bascule de mode :

| Action | Effet |
|---|---|
| **✎** dans la marge | vous éditez ce bloc |
| **⋮⋮** dans la marge | le menu du bloc — dupliquer, copier le lien, commenter, supprimer — sans ouvrir l'éditeur |
| **Sélection** de texte, partout | la bulle de commentaire, comme avant |
| Sélection *pendant l'édition* | la barre de mise en forme, à la sélection — **Transformer en** en tête |
| **+** dans la marge | un nouveau bloc sous celui-ci |
| `/` pendant l'édition | la palette de blocs — elle **insère dessous** ; taper pour filtrer |
| **Terminer**, ou `⌘↵` | enregistrer — la modification est écrite |
| Clic ailleurs | un bloc intact se ferme ; un bloc modifié reste ouvert et pose la question |
| **Annuler**, ou **Échap** | abandonner — le bloc revient tel qu'il était |
| `⌘Z` | annuler la frappe, comme partout |
| `⌘⇧M` | passer ce bloc en Markdown brut, et revenir |

Lecture et édition ne se disputent jamais le même geste : sélectionner du texte veut
toujours dire « commenter ceci », et éditer part toujours du crayon. **Écrire est un geste
explicite** : seul **Terminer** (ou `⌘↵`) touche au dépôt. Cliquer ailleurs ferme un bloc
intact — se déplacer dans la page n'écrit jamais — mais un bloc modifié reste ouvert et
pose la question : un clic égaré ne peut ni écrire votre modification, ni la perdre.

Abandonner est la seule sortie qui jette du travail : quand le bloc a des modifications non
enregistrées, une confirmation est demandée — appuyer à nouveau, ou cliquer sur
**Annuler** — là où le regard est déjà. Sur un bloc intact, la fermeture est immédiate.
Rien n'est envoyé au serveur dans les deux cas, et le brouillon est supprimé : rouvrir le
bloc redonne le texte du fichier.

Pendant l'édition, une **carte compacte se place directement sous le bloc** : Terminer,
Annuler, l'annulation de frappe et la bascule Markdown sur sa première ligne, puis — dès
que quelque chose a changé — tout ce que la sauvegarde peut emporter (voir *Fermer la
boucle*). Il n'y a aucun autre chrome : pas de mode, pas de rail, pas de panneau ailleurs
à l'écran.

**Les tableaux portent leurs commandes sur la grille elle-même**, pas sur une barre qui
suit le curseur. Survoler une cellule fait apparaître une poignée sur sa ligne et sur sa
colonne ; la poignée de colonne ouvre l'alignement (`:--`, `:-:`, `--:` — une propriété de
colonne en Markdown) et la suppression, celle de ligne la suppression, et les bords du
tableau offrent des boutons **+** pour une nouvelle ligne ou colonne. Lignes et colonnes
se réordonnent en les faisant glisser — le tout à l'intérieur du seul bloc que possède
l'éditeur.

Deux actions de la barre d'outils font lire toute une **ligne** ou toute une **colonne**
comme un en-tête — elles apparaissent quand la sélection est dans un tableau. Elles
existent sous contrainte : Markdown ne transporte aucun style, la seule chose qu'elles
peuvent écrire est du gras. Elles mettent donc en gras chaque cellule de la ligne ou de la
colonne, et le rendu donne à une ligne ou une colonne entièrement en gras la surface de
l'en-tête. Un second appui annule. La ligne d'en-tête elle-même est épargnée : c'en est
déjà une.

Ce seuil est voulu. Une cellule *isolée* en gras reste de l'emphase : `| **✎** dans la
marge | … |` n'est pas un libellé, et le teinter serait une devinette. Seule une série
complète est traitée comme une décision — ce que produisent précisément les boutons. Le
fichier reste portable dans les deux cas : sur GitHub ou dans n'importe quel éditeur, ces
cellules se lisent simplement en gras.

Au-delà de ça, il n'y a pas d'option d'en-tête ni de pied, et c'est le format qui le veut, non un oubli :
un tableau GFM a **exactement une ligne d'en-tête**, toujours, et Markdown ne connaît ni
ligne de pied ni colonne d'en-tête. Les proposer supposerait d'émettre des tableaux HTML
bruts — qui cessent d'être du Markdown, cessent de passer la vérification de confinement, et
cessent de s'afficher partout ailleurs où vos fichiers `.md` sont lus.

La barre d'outils, elle, n'apparaît **qu'à la sélection de texte** — un simple curseur
n'obtient rien. Une barre qui suit le curseur se pose sur le texte même qu'on édite ; la
structure vit donc ailleurs : les tableaux sur leur grille, les listes au clavier (`Tab` /
`⇧Tab` pour indenter et désindenter) et dans la barre quand du texte y est sélectionné.
`Tab` passe de cellule en cellule dans un tableau — sur la dernière cellule il ajoute une
ligne au lieu de faire sortir du bloc.

Un tableau édité revient dans la convention du fichier, jusqu'à la ligne de séparation : un
fichier en `| --- |` compact le reste, un fichier aligné reste aligné. Ce n'est pas un
détail : un tableau incapable de faire l'aller-retour serait réécrit en entier par
quelqu'un qui s'est contenté de l'ouvrir et d'appuyer sur Terminer.

## Les blocs

Un bloc vide le dit de lui-même : il porte un texte indicatif *Taper « / » pour les
commandes*, comme celui de Notion. Un geste qu'il faut apprendre dans une documentation est
un geste que la plupart des gens ne trouvent jamais.

`/` ouvre la palette que Notion a appris à tout le monde, avec le verbe de Notion : elle
**insère un nouveau bloc sous** celui où l'on est — **Texte, Titre 1 à 4, Liste à puces,
Liste numérotée, Liste de tâches, Citation, Code, Tableau, Séparateur, Image**, chacun
avec son raccourci Markdown affiché à côté. Seul un bloc *vide* est typé en place, le seul
cas où insérer et transformer veulent dire la même chose. Taper pour filtrer, `↑`/`↓` pour
se déplacer, `↵` pour appliquer ; le `/requête` saisi est absorbé.

Changer ce qu'un bloc existant *est* vit dans la barre d'outils : sélectionner du texte,
et la barre commence par **Transformer en** — le type courant du bloc, avec le menu de
tout ce que GFM sait en faire. Deux verbes, deux surfaces, jamais confondus.

Gérer le bloc, c'est le **menu ⋮⋮**, et il ne demande aucune session d'édition :
**dupliquer** et **supprimer** sont des écritures de plage en un coup (dupliquer écrit le
bloc deux fois, supprimer n'écrit rien et emporte un séparateur — les voisins reviennent
identiques octet pour octet, et supprimer demande confirmation avant d'agir) ; **copier le
lien du bloc** met l'ancre du titre le plus proche dans le presse-papier ; **commenter**
confie le bloc au flux de commentaire par sélection.

Ce que Notion propose et que Markdown ne sait pas transporter : la **couleur**,
l'**alignement de bloc** (il n'y a pas de text-align en Markdown ; seules les *colonnes de
tableau* ont un alignement, réglé depuis la poignée de colonne), **monter/descendre** (cela
réécrit deux blocs à la fois, ce que la vérification de confinement refuse par construction),
les encadrés, les blocs dépliants et les colonnes.

La barre de mise en forme couvre ce que GFM possède : **gras**, *italique*, `code`,
~~barré~~, liens — le bouton lien ouvre un petit champ pour l'URL, et survoler un lien
existant propose de l'éditer, le copier ou le retirer — et un bouton **effacer la mise en
forme** qui retire toutes les marques de la sélection. Les boutons s'allument quand la
sélection porte déjà leur marque. Le souligné, la couleur et le surlignage n'ont pas de
syntaxe Markdown : ils ne sont pas proposés plutôt qu'écrits en HTML en douce.

Les raccourcis Markdown fonctionnent aussi, et l'ont toujours fait : `- `, `1. `, `# `,
`> `, ` ``` `, `![alt](src)`, et `|3x2|` pour un tableau 3×2. La palette existe parce qu'un
raccourci qu'il faut déjà connaître n'est pas une interface.

**+** dans la marge, à côté du ✎, démarre un **nouveau bloc sous celui-ci**. Le bloc à côté
duquel on clique reste *rendu* — ce n'est pas lui qu'on édite — et une surface vide s'ouvre
en dessous, prête pour `/`. La laisser vide n'écrit rien du tout : cliquer sur + puis changer
d'avis ne coûte rien.

Sous le capot, la sauvegarde réécrit la plage de ce seul bloc avec deux blocs — d'où des
voisins qui reviennent identiques octet pour octet. (Éditer l'original pour taper en dessous
était la première version, et cela se lisait comme un saut de ligne ajouté au bloc.)

**Images** : coller, ou choisir `Image…` dans la palette. Dans les deux cas le fichier est
écrit dans le dépôt à côté de la page, sous un nom au hash du contenu, et le lien est
inséré — il arrive donc dans le même commit que la prose qui le référence.

Ce qui n'a délibérément **pas** été repris de Notion : le glisser-déposer pour réordonner.
Déplacer un bloc au-delà de son voisin réécrit deux blocs à la fois, ce que la vérification
de confinement refuse — et c'est elle qui garde les diffs à la ligne réellement modifiée.

Les blocs de prose s'ouvrent en **texte enrichi** : ce que vous tapez ressemble à ce que la
page affichera, et sélectionner à l'intérieur fait apparaître la barre de mise en forme.
Les blocs de code (et tout ce que le rendu ne sait pas représenter comme de la prose)
s'ouvrent en **Markdown brut** — une vue WYSIWYG d'un bloc de code serait un moins bon
éditeur de code qu'un simple champ, et la page re-rend le vrai résultat dès
l'enregistrement. `⌘⇧M` bascule dans les deux sens.

Si un rechargement vous interrompt — le HMR se déclenche à chaque sauvegarde, et dès que
l'agent écrit — le texte déjà saisi est conservé et restauré à la réouverture du bloc.

**Sur téléphone**, les deux mêmes étapes survivent, avec le geste dont un téléphone
dispose : un **tap** arme le bloc — il le souligne et fait apparaître un bouton *Éditer ce
bloc* — et c'est ce bouton qui l'ouvre. Un tap seul n'édite jamais rien, car sur téléphone
le tap est le geste de lecture : on tape en défilant, en visant un lien, ou avant un appui
long. L'appui long sélectionne toujours, et propose toujours de commenter.

Tout ce chrome s'ancre en **haut** de l'écran, pas en bas. Le bas appartient à la
plateforme — Android y empile sa pastille « appuyer pour rechercher » et sa barre de
gestes, iOS y fait monter le clavier — et ce qu'on y place devient inatteignable.

Tout ce qui entoure le bloc reste rendu pendant la saisie : le rail de commentaires, les
surlignages, le sommaire, les diagrammes. C'est tout l'intérêt — le geste visé est de lire
un commentaire tout en corrigeant la phrase qu'il concerne.

## Fermer la boucle

Dès que quelque chose a réellement changé, la carte sous le bloc s'étoffe : les
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
  s'éclairent jamais. Les fichiers `.mdx` ne sont pas éditables du tout : leurs offsets ne
  sont pas dans le même repère, l'éditeur décline plutôt que de deviner.
- **Il ne touchera pas un espace que vous avez fermé.** `roots[].edit: false` passe un
  espace en lecture seule, et `edit: { enabled: false }` retire l'éditeur partout.
- **Il n'écrira pas un fichier que git ne suit pas**, car la modification serait alors
  irrécupérable. Le message indique de faire `git add`. `edit: { requireGit: false }` lève
  la garde si l'on tient à éditer hors gestion de version.
- **Il prévient avant de casser une ancre.** Si la modification retire le texte que cite un
  commentaire, la carte sous le bloc le signale pendant la saisie — ce commentaire
  deviendrait orphelin.

## Images

Coller une image dans l'éditeur l'écrit dans le dépôt, à côté de la page, sous un nom
suffixé d'un hash de contenu, et insère le lien Markdown. Elle atterrit dans le même commit
que la prose qui la référence. PNG, JPEG, GIF, WebP, AVIF et SVG, jusqu'à 8 Mo — le reste
est refusé ; coller deux fois la même capture réutilise un seul fichier.

## Ce qu'une sauvegarde ne peut pas vérifier à votre place

Une passe d'agent se termine par un build, `notabene lint` et vos commandes `verify[]`.
Une édition humaine ne fait rien de tout cela — et la sauvegarde ne prétend pas le
contraire : elle répond **enregistré** ou elle refuse, rien entre les deux. Les
vérifications exhaustives restent où elles ont toujours été — `notabene lint` pour les
liens, vos `verify[]` en CI et dans chaque passe d'agent. L'éditeur n'exécute
**délibérément pas** vos commandes depuis le serveur de dev.

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
