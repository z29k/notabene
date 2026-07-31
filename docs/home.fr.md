# notabene

*nota bene* — la marque de marge qui signifie **« à bien noter ».**

**Des notes dans les marges des docs du repo — directement sur la page rendue — puis
l'agent IA les applique, résout les fils et journalise *ce qui a changé & pourquoi*.**
Le commentaire ancré **est** l'instruction : situé, sans ambiguïté, rien à citer. Sans
SaaS, sans base de données — tout vit en JSON dans votre git.

<p align="center">
  <img src="https://raw.githubusercontent.com/z29k/notabene/main/assets/notabene-demo.gif" alt="démo notabene : commenter un passage, l'agent applique l'édition, validation du vrai diff" width="820" />
</p>

## La boucle, en 30 secondes

1. `npx notabene dev` → ouvrir le site, **sélectionner du texte → laisser un
   commentaire** (ou commenter une page entière, un diagramme ou une image).
2. Demander à l'agent : **« traite les commentaires de la doc ».**
3. L'agent lit `.notabene/`, édite les docs fidèlement, marque chaque commentaire
   **résolu** et ajoute une entrée de **journal** — ou, en
   [mode approve](./guide/review-loop.md), attend que vous validiez le **vrai diff
   git** de chaque édition.
4. Relire la trace sur `/journal`.

## Commencer ici

- **[Installation](./guide/install.md)** — le renderer npm, le plugin Claude Code, ou
  les deux ; puis **[votre première revue](./guide/first-review.md)** de bout en bout.
- **[Configuration](./guide/configuration.md)** — un seul fichier de données : espaces,
  format, sidebar, mode de revue.

## Aller plus loin

- **[La boucle de revue](./guide/review-loop.md)** — le protocole file-I/O-first que
  n'importe quel agent peut suivre, et le mode approve avec humain dans la boucle.
- **[Personnaliser le rendu](./guide/customize.md)** — branding, tokens `--nb-*`,
  votre propre feuille de style, polices, thèmes de code et de diagrammes.
- **[Liens de navigation](./guide/configuration.md#liens-de-navigation)** — ramenez le
  lecteur au repo, aux releases, au produit : topbar, bloc de sidebar, pied de page.
- **[Doc multilingue](./guide/multilingual.md)** — URL propres préfixées, sélecteur de
  langue, commentaires par langue.
- **[Export PDF](./guide/pdf-export.md)** — vues prêtes à imprimer, PDF avec signets.
- **[Publier un site public](./guide/publish/index.md)** — le build statique en lecture
  seule, lisible par les agents. **Ce site en est un** : il expose
  [`/llms.txt`](/notabene/llms.txt), un double Markdown par page, et il est déployé par
  le [workflow GitHub Pages](./guide/publish/github-pages.md).

Les tableaux exhaustifs vivent dans la [Référence](./reference/index.md) : la
[CLI](./reference/cli.md), chaque [clé de config](./reference/config.md), le
[frontmatter](./reference/frontmatter.md), le
[contrat du store](./reference/store-contract.md) et le
[modèle de sécurité](./reference/safety.md).
