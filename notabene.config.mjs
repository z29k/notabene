// notabene, reviewed and published by notabene (dogfood). This repo is its own
// consumer: `docs/` holds the user documentation, reviewed with the local loop
// (`node packages/renderer/bin/notabene.mjs dev`) and published to GitHub Pages
// by .github/workflows/docs.yml (`build --public` → z29k.github.io/notabene).
export default {
  siteName: "notabene",
  tagline: "note this well",
  locale: "en",
  format: "commonmark",

  roots: [
    {
      key: "guide",
      label: "Guide",
      path: "docs/guide",
      description: {
        en: "Install notabene, run your first review loop, and grow into every feature.",
        fr: "Installer notabene, boucler une première revue, puis explorer chaque fonctionnalité.",
      },
    },
    {
      key: "reference",
      label: { en: "Reference", fr: "Référence" },
      path: "docs/reference",
      description: {
        en: "The exhaustive surfaces: CLI, config keys, frontmatter, the store contract, safety.",
        fr: "Les surfaces exhaustives : CLI, clés de config, frontmatter, contrat du store, sécurité.",
      },
    },
  ],

  store: "docs/.notabene",

  // "Edit this page" on every doc page → GitHub editor.
  editPattern: "https://github.com/z29k/notabene/edit/main/{path}",

  // Bilingual docs (suffix strategy: EN files keep their paths/URLs; FR = *.fr.md
  // siblings). Also the public demo of the language switcher + per-locale llms.txt.
  i18n: { locales: ["en", "fr"], defaultLocale: "en", strategy: "suffix" },

  // Custom landing page: rendered above the space cards on "/" (README-like welcome,
  // written for the site — relative links become routes). Deliberately OUTSIDE the
  // two spaces so it isn't also a doc page. Per-locale, like the docs.
  home: { en: "docs/home.md", fr: "docs/home.fr.md" },

  // Identity: the ink-bottle logo in the topbar + as favicon + as the social card.
  branding: {
    logo: "assets/notabene-logo.jpg",
    favicon: "assets/notabene-logo.jpg",
    socialImage: "assets/notabene-logo.jpg",
  },

  // Outbound navigation: from any doc page, back to the repo, the releases, the package.
  // Topbar stays to a single icon; the long list lives under the space tree.
  nav: {
    header: [{ label: "GitHub", href: "https://github.com/z29k/notabene", icon: "github", iconOnly: true }],
    sidebar: {
      title: { en: "Resources", fr: "Ressources" },
      links: [
        { label: "GitHub", href: "https://github.com/z29k/notabene", icon: "github" },
        { label: "Releases", href: "https://github.com/z29k/notabene/releases", icon: "star" },
        { label: "npm", href: "https://www.npmjs.com/package/@z29k/notabene", icon: "npm" },
      ],
    },
    footer: {
      links: [
        { label: { en: "Issues", fr: "Tickets" }, href: "https://github.com/z29k/notabene/issues" },
        { label: { en: "MIT licence", fr: "Licence MIT" }, href: "https://github.com/z29k/notabene/blob/main/LICENSE" },
      ],
      text: "© 2026 z29k",
    },
  },

  // Dogfood the flagship feature: agent proposes, humans validate at /review.
  review: "approve",

  // Post-edit check of the review loop. The protocol page is CANONICAL: editing it must
  // regenerate the plugin skills + the npm-shipped copy, or the CI diff gate goes red.
  verify: ["npm run gen:protocol"],

  publish: { site: "https://z29k.github.io", base: "/notabene" },
};
