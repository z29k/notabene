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

  // Dogfood the flagship feature: agent proposes, humans validate at /review.
  review: "approve",

  publish: { site: "https://z29k.github.io", base: "/notabene" },
};
